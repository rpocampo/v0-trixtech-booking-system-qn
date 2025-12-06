const Service = require('../models/Service');
const InventoryTransaction = require('../models/InventoryTransaction');
const Booking = require('../models/Booking');
const { sendTemplateNotification } = require('./notificationService');
const { triggerLowStockCheck } = require('./lowStockAlertService');

/**
 * Auto-inventory optimization and reordering service
 * Automatically analyzes inventory levels, predicts demand, and manages reordering
 */
class AutoInventoryService {
  /**
   * Analyze inventory levels and generate optimization recommendations
   * @param {string} serviceId - Service ID (optional, analyze all if not provided)
   * @returns {Object} Inventory analysis and recommendations
   */
  static async analyzeInventoryLevels(serviceId = null) {
    try {
      const query = serviceId ? { _id: serviceId } : {};
      query.serviceType = { $in: ['equipment', 'supply'] }; // Only inventory-tracked items
      query.quantity = { $exists: true, $gte: 0 }; // Has quantity field

      const services = await Service.find(query);

      const analysis = {
        totalServices: services.length,
        lowStockItems: [],
        overStockItems: [],
        optimalItems: [],
        reorderRecommendations: [],
        predictedShortages: [],
        analysisTimestamp: new Date()
      };

      for (const service of services) {
        const itemAnalysis = await this.analyzeSingleItem(service);
        analysis[itemAnalysis.category].push(itemAnalysis);

        if (itemAnalysis.reorderRecommended) {
          analysis.reorderRecommendations.push(itemAnalysis.reorderInfo);
        }

        if (itemAnalysis.predictedShortage) {
          analysis.predictedShortages.push(itemAnalysis.shortageInfo);
        }
      }

      return analysis;

    } catch (error) {
      console.error('Error analyzing inventory levels:', error);
      return {
        totalServices: 0,
        lowStockItems: [],
        overStockItems: [],
        optimalItems: [],
        reorderRecommendations: [],
        predictedShortages: [],
        error: error.message
      };
    }
  }

  /**
   * Analyze a single inventory item
   */
  static async analyzeSingleItem(service) {
    try {
      const currentStock = service.quantity || 0;

      // Get recent usage data (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentTransactions = await InventoryTransaction.find({
        serviceId: service._id,
        createdAt: { $gte: thirtyDaysAgo }
      }).sort({ createdAt: -1 });

      // Calculate daily usage rate
      const dailyUsage = this.calculateDailyUsage(recentTransactions);

      // Predict future demand
      const demandPrediction = await this.predictDemand(service._id, 30); // 30 days prediction

      // Calculate optimal stock levels
      const optimalLevels = this.calculateOptimalStockLevels(service, dailyUsage, demandPrediction);

      // Determine category and recommendations
      let category = 'optimalItems';
      let reorderRecommended = false;
      let reorderInfo = null;
      let predictedShortage = false;
      let shortageInfo = null;

      if (currentStock <= optimalLevels.reorderPoint) {
        category = 'lowStockItems';
        reorderRecommended = true;
        reorderInfo = {
          serviceId: service._id,
          serviceName: service.name,
          currentStock,
          recommendedOrder: optimalLevels.reorderQuantity,
          urgency: currentStock <= optimalLevels.criticalPoint ? 'critical' : 'normal',
          estimatedDaysUntilStockout: Math.floor(currentStock / dailyUsage.avgDailyUsage),
          reason: 'Below reorder point'
        };
      } else if (currentStock > optimalLevels.maximumStock) {
        category = 'overStockItems';
      }

      // Check for predicted shortages
      const predictedStockIn30Days = currentStock - (dailyUsage.avgDailyUsage * 30);
      if (predictedStockIn30Days <= optimalLevels.reorderPoint) {
        predictedShortage = true;
        shortageInfo = {
          serviceId: service._id,
          serviceName: service.name,
          predictedStockIn30Days: Math.max(0, predictedStockIn30Days),
          recommendedAction: 'Increase reorder quantity or frequency',
          confidence: demandPrediction.confidence
        };
      }

      return {
        serviceId: service._id,
        serviceName: service.name,
        category,
        currentStock,
        optimalLevels,
        dailyUsage,
        demandPrediction,
        reorderRecommended,
        reorderInfo,
        predictedShortage,
        shortageInfo,
        lastAnalyzed: new Date()
      };

    } catch (error) {
      console.error(`Error analyzing item ${service._id}:`, error);
      return {
        serviceId: service._id,
        serviceName: service.name,
        category: 'error',
        error: error.message
      };
    }
  }

  /**
   * Calculate daily usage rate from transactions
   */
  static calculateDailyUsage(transactions) {
    if (transactions.length === 0) {
      return {
        avgDailyUsage: 0,
        totalUsage: 0,
        usageVariance: 0,
        daysAnalyzed: 0
      };
    }

    // Group by day
    const dailyUsage = {};
    transactions.forEach(transaction => {
      const day = transaction.createdAt.toISOString().split('T')[0];
      const quantity = Math.abs(transaction.quantity); // Absolute value for usage
      dailyUsage[day] = (dailyUsage[day] || 0) + quantity;
    });

    const days = Object.keys(dailyUsage);
    const totalUsage = Object.values(dailyUsage).reduce((sum, usage) => sum + usage, 0);
    const avgDailyUsage = totalUsage / Math.max(days.length, 1);

    // Calculate variance
    const squaredDifferences = days.map(day => Math.pow(dailyUsage[day] - avgDailyUsage, 2));
    const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / Math.max(days.length, 1);

    return {
      avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      totalUsage,
      usageVariance: Math.round(variance * 100) / 100,
      daysAnalyzed: days.length,
      dailyBreakdown: dailyUsage
    };
  }

  /**
   * Predict demand for the next N days
   */
  static async predictDemand(serviceId, daysAhead = 30) {
    try {
      // Get historical booking data (last 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const historicalBookings = await Booking.find({
        serviceId,
        status: 'confirmed',
        createdAt: { $gte: ninetyDaysAgo }
      });

      if (historicalBookings.length === 0) {
        return {
          predictedDailyDemand: 0,
          confidence: 0,
          method: 'no_historical_data'
        };
      }

      // Simple moving average prediction
      const dailyBookings = {};
      historicalBookings.forEach(booking => {
        const day = booking.createdAt.toISOString().split('T')[0];
        dailyBookings[day] = (dailyBookings[day] || 0) + booking.quantity;
      });

      const dailyValues = Object.values(dailyBookings);
      const avgDailyDemand = dailyValues.reduce((sum, val) => sum + val, 0) / dailyValues.length;

      // Calculate trend (simple linear regression on last 30 days)
      const recentDays = Object.keys(dailyBookings)
        .sort()
        .slice(-30);

      let trend = 0;
      if (recentDays.length >= 7) {
        const recentValues = recentDays.map(day => dailyBookings[day] || 0);
        const n = recentValues.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = recentValues.reduce((sum, val) => sum + val, 0);
        const sumXY = recentValues.reduce((sum, val, idx) => sum + (val * idx), 0);
        const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        trend = slope;
      }

      // Apply trend to prediction
      const predictedDailyDemand = Math.max(0, avgDailyDemand + (trend * daysAhead / 30));

      // Calculate confidence based on data consistency
      const variance = this.calculateVariance(dailyValues);
      const coefficientOfVariation = avgDailyDemand > 0 ? Math.sqrt(variance) / avgDailyDemand : 1;
      const confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation));

      return {
        predictedDailyDemand: Math.round(predictedDailyDemand * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        method: 'moving_average_with_trend',
        historicalDataPoints: dailyValues.length,
        trend: Math.round(trend * 100) / 100
      };

    } catch (error) {
      console.error('Error predicting demand:', error);
      return {
        predictedDailyDemand: 0,
        confidence: 0,
        method: 'error',
        error: error.message
      };
    }
  }

  /**
   * Calculate variance of an array
   */
  static calculateVariance(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    return squaredDifferences.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Calculate optimal stock levels for an item
   */
  static calculateOptimalStockLevels(service, dailyUsage, demandPrediction) {
    const avgDailyUsage = dailyUsage.avgDailyUsage || 1;
    const predictedDemand = demandPrediction.predictedDailyDemand || avgDailyUsage;

    // Safety stock: 2 weeks worth
    const safetyStock = Math.ceil(avgDailyUsage * 14);

    // Reorder point: 1 week worth + safety stock
    const reorderPoint = Math.ceil(avgDailyUsage * 7) + safetyStock;

    // Reorder quantity: 4 weeks worth
    const reorderQuantity = Math.ceil(predictedDemand * 28);

    // Maximum stock: 8 weeks worth
    const maximumStock = Math.ceil(predictedDemand * 56);

    // Critical point: 3 days worth
    const criticalPoint = Math.ceil(avgDailyUsage * 3);

    return {
      safetyStock,
      reorderPoint,
      reorderQuantity,
      maximumStock,
      criticalPoint,
      leadTimeDays: 7, // Assumed lead time
      calculatedAt: new Date()
    };
  }

  /**
   * Generate and send automatic reorder alerts
   * @returns {Object} Alert results
   */
  static async sendReorderAlerts() {
    try {
      const analysis = await this.analyzeInventoryLevels();
      const alertsSent = {
        critical: 0,
        normal: 0,
        total: 0
      };

      // Send alerts for reorder recommendations
      for (const recommendation of analysis.reorderRecommendations) {
        try {
          const alertType = recommendation.urgency === 'critical'
            ? 'INVENTORY_REORDER_CRITICAL'
            : 'INVENTORY_REORDER_NORMAL';

          // Get admin users
          const User = require('../models/User');
          const adminUsers = await User.find({ role: 'admin' });

          for (const admin of adminUsers) {
            await sendTemplateNotification(admin._id, alertType, {
              message: `Inventory reorder needed for ${recommendation.serviceName}`,
              metadata: {
                serviceId: recommendation.serviceId,
                serviceName: recommendation.serviceName,
                currentStock: recommendation.currentStock,
                recommendedOrder: recommendation.recommendedOrder,
                urgency: recommendation.urgency,
                estimatedDaysUntilStockout: recommendation.estimatedDaysUntilStockout,
                reason: recommendation.reason
              }
            });
          }

          alertsSent[recommendation.urgency === 'critical' ? 'critical' : 'normal']++;
          alertsSent.total++;

        } catch (error) {
          console.error(`Error sending reorder alert for ${recommendation.serviceId}:`, error);
        }
      }

      // Send alerts for predicted shortages
      for (const shortage of analysis.predictedShortages) {
        try {
          const User = require('../models/User');
          const adminUsers = await User.find({ role: 'admin' });

          for (const admin of adminUsers) {
            await sendTemplateNotification(admin._id, 'INVENTORY_SHORTAGE_PREDICTED', {
              message: `Predicted shortage for ${shortage.serviceName} in 30 days`,
              metadata: {
                serviceId: shortage.serviceId,
                serviceName: shortage.serviceName,
                predictedStockIn30Days: shortage.predictedStockIn30Days,
                recommendedAction: shortage.recommendedAction,
                confidence: shortage.confidence
              }
            });
          }

          alertsSent.total++;

        } catch (error) {
          console.error(`Error sending shortage alert for ${shortage.serviceId}:`, error);
        }
      }

      console.log(`Sent ${alertsSent.total} inventory alerts (${alertsSent.critical} critical, ${alertsSent.normal} normal)`);

      return alertsSent;

    } catch (error) {
      console.error('Error sending reorder alerts:', error);
      throw error;
    }
  }

  /**
   * Auto-generate purchase orders for low-stock items
   * @param {boolean} executeOrders - Whether to actually create orders or just simulate
   * @returns {Object} Order generation results
   */
  static async generatePurchaseOrders(executeOrders = false) {
    try {
      const analysis = await this.analyzeInventoryLevels();
      const orders = [];

      for (const recommendation of analysis.reorderRecommendations) {
        if (recommendation.urgency === 'critical' || executeOrders) {
          const order = {
            serviceId: recommendation.serviceId,
            serviceName: recommendation.serviceName,
            quantity: recommendation.recommendedOrder,
            estimatedCost: await this.estimateOrderCost(recommendation.serviceId, recommendation.recommendedOrder),
            priority: recommendation.urgency,
            reason: recommendation.reason,
            generatedAt: new Date(),
            status: executeOrders ? 'pending_approval' : 'simulated'
          };

          orders.push(order);

          if (executeOrders) {
            // Here you would integrate with your procurement system
            // For now, we'll just log it
            console.log(`Auto-generated purchase order: ${JSON.stringify(order, null, 2)}`);
          }
        }
      }

      return {
        ordersGenerated: orders.length,
        totalEstimatedCost: orders.reduce((sum, order) => sum + (order.estimatedCost || 0), 0),
        criticalOrders: orders.filter(o => o.priority === 'critical').length,
        orders: executeOrders ? orders : orders.slice(0, 5), // Limit details if simulated
        executed: executeOrders
      };

    } catch (error) {
      console.error('Error generating purchase orders:', error);
      throw error;
    }
  }

  /**
   * Estimate cost of an order
   */
  static async estimateOrderCost(serviceId, quantity) {
    try {
      // This would integrate with your pricing/cost system
      // For now, use a simple estimation
      const service = await Service.findById(serviceId);
      if (!service || !service.basePrice) return 0;

      // Assume cost is 60% of selling price (rough estimate)
      return Math.round(service.basePrice * quantity * 0.6 * 100) / 100;

    } catch (error) {
      console.error('Error estimating order cost:', error);
      return 0;
    }
  }

  /**
   * Optimize inventory levels across all items
   * @returns {Object} Optimization results
   */
  static async optimizeInventoryLevels() {
    try {
      const analysis = await this.analyzeInventoryLevels();

      const optimizations = {
        totalItems: analysis.totalServices,
        optimizationsApplied: 0,
        reorderPointsAdjusted: 0,
        alertsTriggered: 0,
        recommendations: []
      };

      // Apply optimizations
      for (const item of [...analysis.lowStockItems, ...analysis.overStockItems, ...analysis.optimalItems]) {
        try {
          const optimization = await this.optimizeSingleItem(item);
          if (optimization.applied) {
            optimizations.optimizationsApplied++;
            if (optimization.reorderPointAdjusted) {
              optimizations.reorderPointsAdjusted++;
            }
            optimizations.recommendations.push(optimization.recommendation);
          }
        } catch (error) {
          console.error(`Error optimizing item ${item.serviceId}:`, error);
        }
      }

      // Trigger low stock checks for items that need attention
      const itemsNeedingAttention = analysis.lowStockItems.filter(item =>
        item.reorderRecommended && item.reorderInfo.urgency === 'critical'
      );

      for (const item of itemsNeedingAttention) {
        try {
          await triggerLowStockCheck(item.serviceId);
          optimizations.alertsTriggered++;
        } catch (error) {
          console.error(`Error triggering low stock alert for ${item.serviceId}:`, error);
        }
      }

      return optimizations;

    } catch (error) {
      console.error('Error optimizing inventory levels:', error);
      throw error;
    }
  }

  /**
   * Optimize a single inventory item
   */
  static async optimizeSingleItem(itemAnalysis) {
    try {
      const service = await Service.findById(itemAnalysis.serviceId);
      if (!service) {
        return { applied: false, reason: 'Service not found' };
      }

      let applied = false;
      let reorderPointAdjusted = false;
      let recommendation = {
        serviceId: itemAnalysis.serviceId,
        serviceName: itemAnalysis.serviceName,
        actions: [],
        reasoning: []
      };

      // Adjust reorder points based on usage patterns
      const optimalLevels = itemAnalysis.optimalLevels;
      if (service.reorderPoint !== optimalLevels.reorderPoint) {
        service.reorderPoint = optimalLevels.reorderPoint;
        reorderPointAdjusted = true;
        applied = true;
        recommendation.actions.push(`Updated reorder point to ${optimalLevels.reorderPoint}`);
        recommendation.reasoning.push('Based on usage analysis and demand prediction');
      }

      // Add optimization metadata
      if (!service.inventoryOptimization) {
        service.inventoryOptimization = {};
      }

      service.inventoryOptimization.lastOptimized = new Date();
      service.inventoryOptimization.optimalLevels = optimalLevels;
      service.inventoryOptimization.dailyUsage = itemAnalysis.dailyUsage;
      service.inventoryOptimization.demandPrediction = itemAnalysis.demandPrediction;

      await service.save();

      return {
        applied,
        reorderPointAdjusted,
        recommendation
      };

    } catch (error) {
      console.error(`Error optimizing single item ${itemAnalysis.serviceId}:`, error);
      return { applied: false, reason: error.message };
    }
  }

  /**
   * Get inventory optimization dashboard data
   * @returns {Object} Dashboard data
   */
  static async getInventoryDashboard() {
    try {
      const analysis = await this.analyzeInventoryLevels();

      // Get recent transactions for activity feed
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentTransactions = await InventoryTransaction.find({
        createdAt: { $gte: sevenDaysAgo }
      })
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

      // Calculate key metrics
      const totalValue = await this.calculateTotalInventoryValue();
      const turnoverRate = await this.calculateInventoryTurnoverRate();

      return {
        summary: {
          totalItems: analysis.totalServices,
          lowStockItems: analysis.lowStockItems.length,
          overStockItems: analysis.overStockItems.length,
          optimalItems: analysis.optimalItems.length,
          reorderRecommendations: analysis.reorderRecommendations.length,
          predictedShortages: analysis.predictedShortages.length,
          totalValue,
          turnoverRate
        },
        alerts: {
          critical: analysis.reorderRecommendations.filter(r => r.urgency === 'critical').length,
          warnings: analysis.reorderRecommendations.filter(r => r.urgency === 'normal').length,
          predictions: analysis.predictedShortages.length
        },
        topRecommendations: analysis.reorderRecommendations.slice(0, 5),
        recentActivity: recentTransactions.map(t => ({
          id: t._id,
          serviceName: t.serviceId?.name || 'Unknown',
          type: t.transactionType,
          quantity: t.quantity,
          reason: t.reason,
          timestamp: t.createdAt
        })),
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Error getting inventory dashboard:', error);
      throw error;
    }
  }

  /**
   * Calculate total inventory value
   */
  static async calculateTotalInventoryValue() {
    try {
      const services = await Service.find({
        serviceType: { $in: ['equipment', 'supply'] },
        quantity: { $exists: true, $gt: 0 }
      });

      let totalValue = 0;
      for (const service of services) {
        // Assume cost is 60% of base price
        const estimatedCost = service.basePrice * 0.6;
        totalValue += estimatedCost * service.quantity;
      }

      return Math.round(totalValue * 100) / 100;

    } catch (error) {
      console.error('Error calculating total inventory value:', error);
      return 0;
    }
  }

  /**
   * Calculate inventory turnover rate
   */
  static async calculateInventoryTurnoverRate() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      // Get total inventory value
      const totalValue = await this.calculateTotalInventoryValue();

      // Get cost of goods sold (from transactions)
      const soldTransactions = await InventoryTransaction.find({
        transactionType: 'booking_reservation',
        createdAt: { $gte: ninetyDaysAgo }
      });

      let cogSold = 0;
      for (const transaction of soldTransactions) {
        const service = await Service.findById(transaction.serviceId);
        if (service) {
          const estimatedCost = service.basePrice * 0.6;
          cogSold += Math.abs(transaction.quantity) * estimatedCost;
        }
      }

      // Turnover rate = COGS / Average Inventory Value
      const avgInventoryValue = totalValue; // Simplified
      const turnoverRate = avgInventoryValue > 0 ? cogSold / avgInventoryValue : 0;

      return Math.round(turnoverRate * 100) / 100;

    } catch (error) {
      console.error('Error calculating inventory turnover rate:', error);
      return 0;
    }
  }
}

module.exports = AutoInventoryService;