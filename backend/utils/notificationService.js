const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendBookingConfirmation, sendAdminBookingNotification, sendLowStockAlert, sendSMSNotification } = require('./emailService');

// Create and send notification
const createNotification = async (userId, notificationData) => {
  try {
    const notification = new Notification({
      userId,
      ...notificationData,
    });

    await notification.save();

    // Send via different channels
    if (notificationData.channels.includes('email')) {
      await sendEmailNotification(userId, notificationData);
    }

    if (notificationData.channels.includes('sms')) {
      await sendSMSNotification(userId, notificationData);
    }

    // Emit real-time notification via Socket.IO
    try {
      const io = global.io;
      if (io) {
        console.log('Emitting notification to user:', userId, notificationData.title);

        // Emit to specific user
        io.to(`user_${userId}`).emit('notification', {
          id: notification._id,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          priority: notificationData.priority,
          createdAt: notification.createdAt,
          metadata: notificationData.metadata || {},
        });

        // If it's an admin notification, also emit to admin room
        if (notificationData.type === 'admin') {
          io.to('admin').emit('admin-notification', {
            id: notification._id,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type,
            priority: notificationData.priority,
            createdAt: notification.createdAt,
            metadata: notificationData.metadata || {},
          });
        }
      } else {
        console.log('Socket.IO not available for notification emission');
      }
    } catch (socketError) {
      console.error('Error emitting notification via Socket.IO:', socketError);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Send email notification
const sendEmailNotification = async (userId, notificationData) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.email) return;

    // For now, we'll use existing email functions
    // In a real implementation, you'd have a more generic email sender
    console.log('Email notification sent to:', user.email, notificationData);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

// Get user notifications
const getUserNotifications = async (userId, options = {}) => {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const query = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('metadata.bookingId', 'serviceId bookingDate status')
    .populate('metadata.serviceId', 'name category');

  const total = await Notification.countDocuments(query);

  return {
    notifications,
    total,
    hasMore: total > offset + limit,
  };
};

// Mark notification as read
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  return notification;
};

// Mark all notifications as read for user
const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return { success: true };
};

// Get unread count
const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({ userId, isRead: false });
};

// Delete old notifications (cleanup)
const cleanupOldNotifications = async (daysOld = 30) => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await Notification.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });

  return result.deletedCount;
};

// Notification templates
const NOTIFICATION_TEMPLATES = {
  BOOKING_CONFIRMED: {
    title: 'Reservation Confirmed',
    message: 'Your reservation has been confirmed successfully.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_CANCELLED: {
    title: 'Reservation Cancelled',
    message: 'Your reservation has been cancelled.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_CANCELLED_ADMIN: {
    title: 'Reservation Cancelled',
    message: 'A customer reservation has been cancelled.',
    type: 'admin',
    priority: 'medium',
    channels: ['in-app', 'email'],
  },

  BOOKING_COMPLETED: {
    title: 'Reservation Completed',
    message: 'Your reservation has been completed successfully.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_PAYMENT_CONFIRMED: {
    title: 'Payment Confirmed',
    message: 'Your payment has been confirmed. Your reservation is now confirmed.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_PENDING: {
    title: 'Reservation Created - Payment Required',
    message: 'Your reservation has been created and is pending payment confirmation.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email'],
  },

  BOOKING_QUEUED: {
    title: 'Reservation Queued',
    message: 'Your reservation has been queued due to unavailability.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email'],
  },

  BOOKING_UPDATED: {
    title: 'Reservation Updated',
    message: 'Your reservation status has been updated.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app'],
  },

  LOW_STOCK_ALERT: {
    title: 'Low Stock Alert',
    message: 'An item is running low on stock.',
    type: 'inventory',
    priority: 'high',
    channels: ['in-app', 'email'],
  },

  NEW_BOOKING_ADMIN: {
    title: 'New Reservation Received',
    message: 'A new reservation has been made.',
    type: 'admin',
    priority: 'high',
    channels: ['in-app', 'email', 'sms'],
  },

  NEW_PENDING_BOOKING_ADMIN: {
    title: 'New Pending Reservation',
    message: 'A new reservation is pending payment confirmation.',
    type: 'admin',
    priority: 'medium',
    channels: ['in-app', 'email'],
  },

  PAYMENT_RECEIVED_ADMIN: {
    title: 'Payment Received',
    message: 'A customer has completed their payment.',
    type: 'admin',
    priority: 'medium',
    channels: ['in-app', 'email'],
  },

  PAYMENT_FAILED: {
    title: 'Payment Failed',
    message: 'Your payment could not be processed.',
    type: 'payment',
    priority: 'high',
    channels: ['in-app', 'email'],
  },

  SYSTEM_MAINTENANCE: {
    title: 'System Maintenance',
    message: 'Scheduled maintenance will occur soon.',
    type: 'system',
    priority: 'low',
    channels: ['in-app'],
  },

  BOOKING_REMINDER_24H: {
    title: 'Reservation Reminder - 24 Hours',
    message: 'Your reservation is scheduled for tomorrow. Please review the details.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_REMINDER_1H: {
    title: 'Reservation Reminder - 1 Hour',
    message: 'Your reservation starts in 1 hour. Please be prepared.',
    type: 'booking',
    priority: 'high',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_REMINDER_15M: {
    title: 'Reservation Reminder - 15 Minutes',
    message: 'Your reservation starts in 15 minutes. Please arrive on time.',
    type: 'booking',
    priority: 'high',
    channels: ['in-app', 'sms'],
  },
};

// Helper function to send notification using template
const sendTemplateNotification = async (userId, templateKey, customData = {}) => {
  const template = NOTIFICATION_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Notification template '${templateKey}' not found`);
  }

  const notificationData = {
    ...template,
    ...customData,
  };

  return await createNotification(userId, notificationData);
};

// Alert notification system for monitoring
class AlertNotificationService {
  constructor() {
    this.alertCache = new Map(); // For deduplication
    this.escalationTimers = new Map(); // For escalation tracking
  }

  // Send Slack notification
  async sendSlackAlert(alertData) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      console.warn('Slack webhook URL not configured');
      return;
    }

    const payload = {
      text: `🚨 *${alertData.severity.toUpperCase()} ALERT*`,
      attachments: [{
        color: this.getSeverityColor(alertData.severity),
        fields: [
          {
            title: 'Alert',
            value: alertData.title,
            short: true
          },
          {
            title: 'Service',
            value: alertData.service || 'system',
            short: true
          },
          {
            title: 'Description',
            value: alertData.description,
            short: false
          },
          {
            title: 'Time',
            value: new Date().toISOString(),
            short: true
          }
        ],
        footer: 'TRIXTECH Monitoring System'
      }]
    };

    try {
      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('Failed to send Slack alert:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending Slack alert:', error);
    }
  }

  // Send email alert via SendGrid
  async sendEmailAlert(alertData) {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const alertEmail = process.env.ALERT_EMAIL_RECIPIENTS;

    if (!sendgridApiKey || !alertEmail) {
      console.warn('SendGrid API key or alert email recipients not configured');
      return;
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(sendgridApiKey);

    const msg = {
      to: alertEmail.split(',').map(email => email.trim()),
      from: process.env.SENDGRID_FROM_EMAIL || 'alerts@trixtech.com',
      subject: `[${alertData.severity.toUpperCase()}] ${alertData.title}`,
      html: this.generateAlertEmailHTML(alertData),
    };

    try {
      await sgMail.send(msg);
      console.log('Alert email sent successfully');
    } catch (error) {
      console.error('Error sending alert email:', error);
    }
  }

  // Generate HTML for alert emails
  generateAlertEmailHTML(alertData) {
    const severityColors = {
      critical: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColors[alertData.severity] || '#6c757d'}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${alertData.severity.toUpperCase()} ALERT</h1>
          <h2 style="margin: 10px 0;">${alertData.title}</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
          <p><strong>Service:</strong> ${alertData.service || 'system'}</p>
          <p><strong>Description:</strong> ${alertData.description}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          ${alertData.value ? `<p><strong>Value:</strong> ${alertData.value}</p>` : ''}
          ${alertData.labels ? `<p><strong>Labels:</strong> ${JSON.stringify(alertData.labels)}</p>` : ''}
        </div>
        <div style="background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; color: #6c757d;">
          TRIXTECH Monitoring System - ${new Date().toLocaleString()}
        </div>
      </div>
    `;
  }

  // Get severity color for Slack
  getSeverityColor(severity) {
    const colors = {
      critical: 'danger',
      warning: 'warning',
      info: 'good'
    };
    return colors[severity] || 'good';
  }

  // Check for alert deduplication
  isDuplicateAlert(alertKey, timeWindow = 300000) { // 5 minutes default
    const now = Date.now();
    const lastAlert = this.alertCache.get(alertKey);

    if (lastAlert && (now - lastAlert) < timeWindow) {
      return true;
    }

    this.alertCache.set(alertKey, now);
    return false;
  }

  // Handle alert escalation
  async handleAlertEscalation(alertData) {
    const alertKey = `${alertData.title}-${alertData.service}`;
    const escalationLevels = [
      { delay: 0, channels: ['slack'] }, // Immediate
      { delay: 5 * 60 * 1000, channels: ['slack', 'email'] }, // 5 minutes
      { delay: 15 * 60 * 1000, channels: ['slack', 'email'] } // 15 minutes
    ];

    for (const level of escalationLevels) {
      const timerKey = `${alertKey}-level-${escalationLevels.indexOf(level)}`;

      if (this.escalationTimers.has(timerKey)) {
        clearTimeout(this.escalationTimers.get(timerKey));
      }

      const timer = setTimeout(async () => {
        // Check if alert is still active (this would need integration with Prometheus)
        // For now, we'll send the escalation
        await this.sendAlert(alertData, level.channels);
        this.escalationTimers.delete(timerKey);
      }, level.delay);

      this.escalationTimers.set(timerKey, timer);
    }
  }

  // Send alert through multiple channels
  async sendAlert(alertData, channels = ['slack']) {
    const promises = [];

    if (channels.includes('slack')) {
      promises.push(this.sendSlackAlert(alertData));
    }

    if (channels.includes('email')) {
      promises.push(this.sendEmailAlert(alertData));
    }

    await Promise.allSettled(promises);
  }

  // Process incoming alert from Prometheus Alertmanager
  async processAlert(alert) {
    const alertKey = `${alert.labels.alertname}-${alert.labels.instance || 'system'}`;

    // Check for deduplication
    if (this.isDuplicateAlert(alertKey)) {
      console.log(`Alert ${alertKey} deduplicated`);
      return;
    }

    const alertData = {
      title: alert.annotations.summary || alert.labels.alertname,
      description: alert.annotations.description || '',
      severity: alert.labels.severity || 'warning',
      service: alert.labels.service || 'system',
      value: alert.value,
      labels: alert.labels
    };

    // Handle escalation for critical alerts
    if (alertData.severity === 'critical') {
      await this.handleAlertEscalation(alertData);
    } else {
      // Send immediate notification for non-critical alerts
      await this.sendAlert(alertData);
    }

    // Also create in-app notification for admin users
    try {
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await createNotification(admin._id, {
          title: alertData.title,
          message: alertData.description,
          type: 'system_alert',
          priority: alertData.severity === 'critical' ? 'high' : 'medium',
          channels: ['in-app'],
          metadata: {
            alertData,
            source: 'monitoring'
          }
        });
      }
    } catch (error) {
      console.error('Error creating in-app alert notification:', error);
    }
  }

  // Clear escalation timers (call when alert is resolved)
  clearEscalation(alertKey) {
    for (const [key, timer] of this.escalationTimers.entries()) {
      if (key.startsWith(alertKey)) {
        clearTimeout(timer);
        this.escalationTimers.delete(key);
      }
    }
  }

  // Cleanup old cached alerts
  cleanupCache(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [key, timestamp] of this.alertCache.entries()) {
      if (now - timestamp > maxAge) {
        this.alertCache.delete(key);
      }
    }
  }
}

// Global alert service instance
const alertService = new AlertNotificationService();

// Send booking reminders for upcoming bookings
const sendBookingReminders = async () => {
  try {
    const Booking = require('../models/Booking');
    const now = new Date();

    // Define reminder timeframes
    const reminderTimes = [
      { hours: 24, template: 'BOOKING_REMINDER_24H' },
      { hours: 1, template: 'BOOKING_REMINDER_1H' },
      { hours: 0.25, template: 'BOOKING_REMINDER_15M' } // 15 minutes
    ];

    for (const reminder of reminderTimes) {
      const reminderTime = new Date(now.getTime() + reminder.hours * 60 * 60 * 1000);

      // Find bookings that are confirmed and start within the reminder timeframe
      const upcomingBookings = await Booking.find({
        status: 'confirmed',
        bookingDate: {
          $gte: new Date(reminderTime.getTime() - 30 * 60 * 1000), // Within 30 minutes of target time
          $lt: new Date(reminderTime.getTime() + 30 * 60 * 1000)   // Within 30 minutes of target time
        }
      }).populate('serviceId', 'name').populate('customerId', 'name email');

      for (const booking of upcomingBookings) {
        // Check if reminder was already sent (avoid duplicate reminders)
        const existingReminder = await Notification.findOne({
          userId: booking.customerId._id,
          'metadata.bookingId': booking._id,
          title: NOTIFICATION_TEMPLATES[reminder.template].title,
          createdAt: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } // Within last 2 hours
        });

        if (!existingReminder) {
          try {
            await sendTemplateNotification(booking.customerId._id, reminder.template, {
              message: `Your booking for ${booking.serviceId.name} is scheduled for ${booking.bookingDate.toLocaleString()}.`,
              metadata: {
                bookingId: booking._id,
                serviceId: booking.serviceId._id,
                bookingDate: booking.bookingDate,
                serviceName: booking.serviceId.name,
                quantity: booking.quantity,
                totalPrice: booking.totalPrice,
              }
            });

            console.log(`Sent ${reminder.hours}h reminder for booking ${booking._id}`);
          } catch (error) {
            console.error(`Error sending ${reminder.hours}h reminder for booking ${booking._id}:`, error);
          }
        }
      }
    }

    console.log('Booking reminders processed successfully');
  } catch (error) {
    console.error('Error processing booking reminders:', error);
  }
};

// Periodic cleanup
setInterval(() => {
  alertService.cleanupCache();
}, 60000); // Clean every minute

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  cleanupOldNotifications,
  sendTemplateNotification,
  sendBookingReminders,
  NOTIFICATION_TEMPLATES,
  AlertNotificationService,
  alertService,
};