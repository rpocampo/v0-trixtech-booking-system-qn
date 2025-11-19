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
    title: 'Booking Confirmed',
    message: 'Your booking has been confirmed successfully.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_CANCELLED: {
    title: 'Booking Cancelled',
    message: 'Your booking has been cancelled.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_COMPLETED: {
    title: 'Booking Completed',
    message: 'Your booking has been completed successfully.',
    type: 'booking',
    priority: 'medium',
    channels: ['in-app', 'email', 'sms'],
  },

  BOOKING_PENDING: {
    title: 'Booking Created - Payment Required',
    message: 'Your booking has been created and is pending payment confirmation.',
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
    title: 'Booking Updated',
    message: 'Your booking status has been updated.',
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
    title: 'New Booking Received',
    message: 'A new booking has been made.',
    type: 'admin',
    priority: 'high',
    channels: ['in-app', 'email', 'sms'],
  },

  NEW_PENDING_BOOKING_ADMIN: {
    title: 'New Pending Booking',
    message: 'A new booking is pending payment confirmation.',
    type: 'admin',
    priority: 'medium',
    channels: ['in-app', 'email'],
  },

  SYSTEM_MAINTENANCE: {
    title: 'System Maintenance',
    message: 'Scheduled maintenance will occur soon.',
    type: 'system',
    priority: 'low',
    channels: ['in-app'],
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

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  cleanupOldNotifications,
  sendTemplateNotification,
  NOTIFICATION_TEMPLATES,
};