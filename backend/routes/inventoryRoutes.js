const express = require('express');
const { adminMiddleware } = require('../middleware/auth');
const { getLowStockStatus, triggerLowStockCheck } = require('../utils/lowStockAlertService');

const router = express.Router();

// Get low stock status for dashboard
router.get('/low-stock-status', adminMiddleware, async (req, res, next) => {
  try {
    const status = await getLowStockStatus();

    if (status.error) {
      return res.status(500).json({
        success: false,
        message: status.error
      });
    }

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    next(error);
  }
});

// Manually trigger low stock check for a specific service
router.post('/check-low-stock/:serviceId', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    await triggerLowStockCheck(serviceId);

    res.json({
      success: true,
      message: 'Low stock check triggered successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Trigger low stock check for all services
router.post('/check-all-low-stock', adminMiddleware, async (req, res, next) => {
  try {
    // Import the checkLowStockAlerts function
    const { checkLowStockAlerts } = require('../utils/lowStockAlertService');

    await checkLowStockAlerts();

    res.json({
      success: true,
      message: 'Low stock check completed for all services'
    });
  } catch (error) {
    next(error);
  }
});

// Get inventory summary with batch details
router.get('/summary', adminMiddleware, async (req, res, next) => {
  try {
    const Service = require('../models/Service');
    const summary = await Service.getInventorySummary();

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// Get batch details for a specific service
router.get('/service/:serviceId/batches', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const Service = require('../models/Service');

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const batchDetails = service.getBatchInventoryDetails();

    res.json({
      success: true,
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        totalQuantity: service.quantity
      },
      batchDetails
    });
  } catch (error) {
    next(error);
  }
});

// Add a new batch to a service
router.post('/service/:serviceId/batches', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const batchData = req.body;

    const Service = require('../models/Service');
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.serviceType !== 'equipment' && service.serviceType !== 'supply') {
      return res.status(400).json({
        success: false,
        message: 'Batch tracking is only available for equipment and supply items'
      });
    }

    await service.addBatch(batchData);

    // Trigger low stock check
    const { triggerLowStockCheck } = require('../utils/lowStockAlertService');
    await triggerLowStockCheck(serviceId);

    res.json({
      success: true,
      message: 'Batch added successfully',
      service: {
        id: service._id,
        name: service.name,
        quantity: service.quantity
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update batch information
router.put('/service/:serviceId/batches/:batchId', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId, batchId } = req.params;
    const updateData = req.body;

    const Service = require('../models/Service');
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const batch = service.batches.find(b => b.batchId === batchId && b.isActive);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // Update batch fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'batchId' && key !== '_id') { // Don't allow updating batchId
        batch[key] = updateData[key];
      }
    });

    await service.save();

    res.json({
      success: true,
      message: 'Batch updated successfully',
      batch
    });
  } catch (error) {
    next(error);
  }
});

// Get expiring batches across all services
router.get('/expiring-batches', adminMiddleware, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const Service = require('../models/Service');

    const services = await Service.find({
      serviceType: { $in: ['equipment', 'supply'] },
      isAvailable: true
    });

    const expiringBatches = [];

    for (const service of services) {
      const expiring = service.getExpiringBatches(parseInt(days));
      expiring.forEach(batch => {
        expiringBatches.push({
          serviceId: service._id,
          serviceName: service.name,
          category: service.category,
          ...batch.toObject()
        });
      });
    }

    // Sort by expiry date
    expiringBatches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    res.json({
      success: true,
      daysAhead: parseInt(days),
      count: expiringBatches.length,
      expiringBatches
    });
  } catch (error) {
    next(error);
  }
});

// Update inventory quantity for a service
router.put('/service/:serviceId/quantity', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { quantity, reason } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const Service = require('../models/Service');
    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.serviceType !== 'equipment' && service.serviceType !== 'supply') {
      return res.status(400).json({
        success: false,
        message: 'Quantity updates are only allowed for equipment and supply items'
      });
    }

    const oldQuantity = service.quantity;
    service.quantity = parseInt(quantity);

    // Create audit log for inventory change
    const auditService = require('../utils/auditService');
    auditService.logEvent('inventory_update', req.user.id, {
      serviceId: service._id,
      serviceName: service.name,
      oldQuantity,
      newQuantity: service.quantity,
      change: service.quantity - oldQuantity,
      reason: reason || 'Manual stock update'
    });

    await service.save();

    // Trigger low stock check
    const { triggerLowStockCheck } = require('../utils/lowStockAlertService');
    await triggerLowStockCheck(serviceId);

    // Emit real-time update
    const io = global.io;
    if (io) {
      io.emit('inventory-updated', {
        serviceId: service._id,
        serviceName: service.name,
        oldQuantity,
        newQuantity: service.quantity,
        category: service.category,
        serviceType: service.serviceType,
        isAvailable: service.isAvailable
      });
    }

    res.json({
      success: true,
      message: 'Inventory quantity updated successfully',
      service: {
        id: service._id,
        name: service.name,
        quantity: service.quantity,
        oldQuantity
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get inventory analytics and forecasting
router.get('/analytics/health-report', adminMiddleware, async (req, res, next) => {
  try {
    const { getInventoryHealthReport } = require('../utils/inventoryAnalyticsService');
    const report = await getInventoryHealthReport();

    res.json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
});

// Get demand forecast
router.get('/analytics/demand-forecast', adminMiddleware, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const { getDemandForecast } = require('../utils/inventoryAnalyticsService');
    const forecast = await getDemandForecast(parseInt(days));

    res.json({
      success: true,
      forecast
    });
  } catch (error) {
    next(error);
  }
});

// Get optimal reorder quantities
router.get('/analytics/reorder-recommendations', adminMiddleware, async (req, res, next) => {
  try {
    const { getOptimalReorderQuantities } = require('../utils/inventoryAnalyticsService');
    const recommendations = await getOptimalReorderQuantities();

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    next(error);
  }
});

// Get analytics for specific service
router.get('/analytics/service/:serviceId', adminMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { days = 30 } = req.query;
    const { analyzeInventoryPatterns } = require('../utils/inventoryAnalyticsService');

    const analysis = await analyzeInventoryPatterns(serviceId, parseInt(days));

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;