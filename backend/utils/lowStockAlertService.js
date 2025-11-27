const Service = require('../models/Service');
const User = require('../models/User');
const { sendTemplateNotification } = require('./notificationService');
const { sendLowStockAlert } = require('./emailService');

// Configuration for low stock thresholds
const LOW_STOCK_THRESHOLDS = {
  CRITICAL: 1,    // Critical alert when <= 1 item
  WARNING: 5,     // Warning alert when <= 5 items
  INFO: 10        // Info alert when <= 10 items
};

// Track alerts to prevent spam
const alertHistory = new Map();
const ALERT_COOLDOWN_HOURS = 24; // Don't send alerts for the same item more than once per day

/**
 * Check if an alert should be sent based on cooldown
 * @param {string} serviceId - Service ID
 * @param {string} alertType - Type of alert (critical, warning, info)
 * @returns {boolean} - Whether alert should be sent
 */
const shouldSendAlert = (serviceId, alertType) => {
  const key = `${serviceId}-${alertType}`;
  const lastAlert = alertHistory.get(key);

  if (!lastAlert) return true;

  const hoursSinceLastAlert = (Date.now() - lastAlert) / (1000 * 60 * 60);
  return hoursSinceLastAlert >= ALERT_COOLDOWN_HOURS;
};

/**
 * Record that an alert was sent
 * @param {string} serviceId - Service ID
 * @param {string} alertType - Type of alert
 */
const recordAlertSent = (serviceId, alertType) => {
  const key = `${serviceId}-${alertType}`;
  alertHistory.set(key, Date.now());
};

/**
 * Get alert level based on quantity
 * @param {number} quantity - Current quantity
 * @returns {string|null} - Alert level or null if no alert needed
 */
const getAlertLevel = (quantity) => {
  if (quantity <= LOW_STOCK_THRESHOLDS.CRITICAL) return 'critical';
  if (quantity <= LOW_STOCK_THRESHOLDS.WARNING) return 'warning';
  if (quantity <= LOW_STOCK_THRESHOLDS.INFO) return 'info';
  return null;
};

/**
 * Get alert message based on level
 * @param {string} level - Alert level
 * @param {Object} service - Service object
 * @returns {Object} - Alert message data
 */
const getAlertMessage = (level, service) => {
  const messages = {
    critical: {
      title: '🚨 CRITICAL: Item Out of Stock',
      message: `${service.name} is completely out of stock! Immediate restocking required.`,
      priority: 'high'
    },
    warning: {
      title: '⚠️ WARNING: Low Stock Alert',
      message: `${service.name} has only ${service.quantity} items remaining. Consider restocking soon.`,
      priority: 'medium'
    },
    info: {
      title: 'ℹ️ INFO: Stock Running Low',
      message: `${service.name} has ${service.quantity} items remaining. Monitor inventory levels.`,
      priority: 'low'
    }
  };

  return messages[level];
};

/**
 * Send low stock alert to admin users
 * @param {string} level - Alert level
 * @param {Object} service - Service object
 */
const sendAdminAlerts = async (level, service) => {
  try {
    const alertData = getAlertMessage(level, service);

    // Get all admin users
    const adminUsers = await User.find({ role: 'admin' });

    if (adminUsers.length === 0) {
      console.warn('No admin users found to send low stock alerts');
      return;
    }

    // Send notifications to all admins
    const notificationPromises = adminUsers.map(admin =>
      sendTemplateNotification(admin._id, 'LOW_STOCK_ALERT', {
        message: alertData.message,
        metadata: {
          serviceId: service._id,
          serviceName: service.name,
          currentStock: service.quantity,
          alertLevel: level,
          category: service.category,
          priority: alertData.priority
        },
      })
    );

    await Promise.all(notificationPromises);

    // Send email alerts for critical and warning levels
    if (level === 'critical' || level === 'warning') {
      const emailPromises = adminUsers.map(admin =>
        sendLowStockAlert(admin.email, {
          serviceName: service.name,
          currentStock: service.quantity,
          alertLevel: level,
          category: service.category
        })
      );

      await Promise.all(emailPromises);
    }

    console.log(`Low stock alert sent to ${adminUsers.length} admins for ${service.name} (${level} level)`);

  } catch (error) {
    console.error('Error sending admin low stock alerts:', error);
  }
};

/**
 * Check inventory levels and send alerts if needed
 * @param {string} serviceId - Specific service ID to check (optional)
 */
const checkLowStockAlerts = async (serviceId = null) => {
  try {
    // Find services that need inventory tracking
    const query = {
      serviceType: { $in: ['equipment', 'supply'] },
      isAvailable: true
    };

    if (serviceId) {
      query._id = serviceId;
    }

    const services = await Service.find(query);

    for (const service of services) {
      const alertLevel = getAlertLevel(service.quantity);

      if (alertLevel && shouldSendAlert(service._id.toString(), alertLevel)) {
        // Send alerts
        await sendAdminAlerts(alertLevel, service);

        // Record that alert was sent
        recordAlertSent(service._id.toString(), alertLevel);

        console.log(`Low stock alert triggered for ${service.name}: ${alertLevel} (${service.quantity} remaining)`);
      }
    }

  } catch (error) {
    console.error('Error checking low stock alerts:', error);
  }
};

/**
 * Manually trigger low stock check for a specific service
 * @param {string} serviceId - Service ID
 */
const triggerLowStockCheck = async (serviceId) => {
  await checkLowStockAlerts(serviceId);
};

/**
 * Get current low stock status for dashboard
 * @returns {Object} - Low stock statistics
 */
const getLowStockStatus = async () => {
  try {
    const services = await Service.find({
      serviceType: { $in: ['equipment', 'supply'] },
      isAvailable: true
    });

    const stats = {
      total: services.length,
      critical: 0,
      warning: 0,
      info: 0,
      outOfStock: 0,
      items: []
    };

    for (const service of services) {
      if (service.quantity === 0) {
        stats.outOfStock++;
        stats.critical++;
        stats.items.push({
          id: service._id,
          name: service.name,
          quantity: service.quantity,
          level: 'out_of_stock',
          category: service.category
        });
      } else {
        const level = getAlertLevel(service.quantity);
        if (level) {
          stats[level]++;
          stats.items.push({
            id: service._id,
            name: service.name,
            quantity: service.quantity,
            level,
            category: service.category
          });
        }
      }
    }

    return stats;

  } catch (error) {
    console.error('Error getting low stock status:', error);
    return { error: 'Failed to get low stock status' };
  }
};

/**
 * Clean up old alert history (remove entries older than 7 days)
 */
const cleanupAlertHistory = () => {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  for (const [key, timestamp] of alertHistory.entries()) {
    if (timestamp < sevenDaysAgo) {
      alertHistory.delete(key);
    }
  }
};

// Clean up alert history every 24 hours (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupAlertHistory, 24 * 60 * 60 * 1000);
}

module.exports = {
  checkLowStockAlerts,
  triggerLowStockCheck,
  getLowStockStatus,
  LOW_STOCK_THRESHOLDS
};