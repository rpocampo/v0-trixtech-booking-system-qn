const express = require('express');
const InventoryTransaction = require('../models/InventoryTransaction');
const Service = require('../models/Service');
const { inventoryAnalyticsService } = require('../utils/inventoryAnalyticsService');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get inventory transaction history for a service
router.get('/transactions/:serviceId', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const transactions = await InventoryTransaction.getInventoryHistory(serviceId, parseInt(limit));
    const total = await InventoryTransaction.countDocuments({ serviceId });

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all inventory transactions with filtering
router.get('/transactions', adminMiddleware, async (req, res, next) => {
  try {
    const {
      serviceId,
      transactionType,
      startDate,
      endDate,
      limit = 100,
      page = 1
    } = req.query;

    let query = {};

    if (serviceId) query.serviceId = serviceId;
    if (transactionType) query.transactionType = transactionType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await InventoryTransaction.find(query)
      .populate('serviceId', 'name category')
      .populate('bookingId', 'customerId quantity bookingDate')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await InventoryTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get inventory health report
router.get('/health-report', adminMiddleware, async (req, res, next) => {
  try {
    const report = await inventoryAnalyticsService.getInventoryHealthReport();
    res.json({ success: true, report });
  } catch (error) {
    next(error);
  }
});

// Get demand forecast
router.get('/demand-forecast', adminMiddleware, async (req, res, next) => {
  try {
    const { daysAhead = 30 } = req.query;
    const forecast = await inventoryAnalyticsService.getDemandForecast(parseInt(daysAhead));
    res.json({ success: true, forecast });
  } catch (error) {
    next(error);
  }
});

// Get optimal reorder quantities
router.get('/reorder-recommendations', adminMiddleware, async (req, res, next) => {
  try {
    const recommendations = await inventoryAnalyticsService.getOptimalReorderQuantities();
    res.json({ success: true, recommendations });
  } catch (error) {
    next(error);
  }
});

// Manual inventory adjustment (admin only)
router.post('/adjust/:serviceId', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { quantity, reason } = req.body;

    if (!quantity || quantity === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity adjustment is required and cannot be zero'
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.serviceType !== 'equipment' && service.serviceType !== 'supply') {
      return res.status(400).json({
        success: false,
        message: 'Inventory adjustments can only be made for equipment and supply items'
      });
    }

    const previousStock = service.quantity;
    const newStock = Math.max(0, previousStock + quantity);

    // Update service quantity
    service.quantity = newStock;
    await service.save();

    // Log the transaction
    await InventoryTransaction.logTransaction({
      serviceId,
      transactionType: 'manual_adjustment',
      quantity,
      previousStock,
      newStock,
      reason: reason || 'Manual inventory adjustment',
      performedBy: req.user.id,
      metadata: {
        adjustedBy: req.user.id,
        adjustmentReason: reason
      }
    });

    res.json({
      success: true,
      message: `Inventory adjusted by ${quantity} units`,
      service: {
        id: service._id,
        name: service.name,
        previousStock,
        newStock
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get real-time inventory summary
router.get('/summary', adminMiddleware, async (req, res, next) => {
  try {
    const services = await Service.find({
      serviceType: { $in: ['equipment', 'supply'] },
      isAvailable: true
    });

    const summary = {
      totalServices: services.length,
      totalStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      services: []
    };

    for (const service of services) {
      summary.totalStock += service.quantity || 0;

      if (service.quantity === 0) {
        summary.outOfStockCount++;
      } else if (service.quantity <= 5) {
        summary.lowStockCount++;
      }

      summary.services.push({
        id: service._id,
        name: service.name,
        category: service.category,
        quantity: service.quantity || 0,
        status: service.quantity === 0 ? 'out_of_stock' :
                service.quantity <= 5 ? 'low_stock' : 'healthy'
      });
    }

    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
});

// Get stock history for date-to-date monitoring
router.get('/stock-history', adminMiddleware, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date

    // Get all inventory transactions within the date range
    const transactions = await InventoryTransaction.find({
      createdAt: {
        $gte: start,
        $lte: end
      }
    })
    .populate('serviceId', 'name category image serviceType')
    .populate('performedBy', 'name')
    .sort({ createdAt: 1 });

    // Process transactions to create stock history
    const stockHistory = [];
    let totalStockAdded = 0;
    let totalStockReduced = 0;

    for (const transaction of transactions) {
      const change = transaction.quantity; // This is the change amount (positive for additions, negative for reductions)
      const type = change > 0 ? 'addition' : 'reduction';

      if (change > 0) {
        totalStockAdded += change;
      } else {
        totalStockReduced += Math.abs(change);
      }

      stockHistory.push({
        date: transaction.createdAt,
        itemId: transaction.serviceId._id,
        itemName: transaction.serviceId.name,
        itemImage: transaction.serviceId.image,
        itemCategory: transaction.serviceId.category,
        type,
        previousStock: transaction.previousStock,
        change,
        newStock: transaction.newStock,
        reason: transaction.reason || transaction.transactionType,
        performedBy: transaction.performedBy?.name || 'System'
      });
    }

    const summary = {
      totalTransactions: stockHistory.length,
      totalStockAdded,
      totalStockReduced,
      netChange: totalStockAdded - totalStockReduced,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };

    res.json({
      success: true,
      summary,
      transactions: stockHistory
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;