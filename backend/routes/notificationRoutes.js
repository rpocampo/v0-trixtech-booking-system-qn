const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
} = require('../utils/notificationService');
const Notification = require('../models/Notification');

const router = express.Router();

// Get admin notifications (all admin users' notifications)
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { limit, offset, unreadOnly } = req.query;

    // Get all admin users
    const User = require('../models/User');
    const adminUsers = await User.find({ role: 'admin' });
    const adminUserIds = adminUsers.map(admin => admin._id);

    const query = { userId: { $in: adminUserIds } };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50)
      .skip(parseInt(offset) || 0)
      .populate('metadata.bookingId', 'serviceId bookingDate status')
      .populate('metadata.serviceId', 'name category');

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      notifications,
      total,
      hasMore: total > (parseInt(offset) || 0) + (parseInt(limit) || 50),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get admin unread count
router.get('/admin/unread-count', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Get all admin users
    const User = require('../models/User');
    const adminUsers = await User.find({ role: 'admin' });
    const adminUserIds = adminUsers.map(admin => admin._id);

    const count = await Notification.countDocuments({
      userId: { $in: adminUserIds },
      isRead: false
    });

    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all admin notifications as read
router.put('/admin/mark-all-read', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Get all admin users
    const User = require('../models/User');
    const adminUsers = await User.find({ role: 'admin' });
    const adminUserIds = adminUsers.map(admin => admin._id);

    await Notification.updateMany(
      { userId: { $in: adminUserIds }, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, message: 'All admin notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit, offset, unreadOnly } = req.query;

    const result = await getUserNotifications(req.user.id, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      unreadOnly: unreadOnly === 'true',
    });

    res.json({
      success: true,
      notifications: result.notifications,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unread count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await markAsRead(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    await markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create notification (for testing/admin purposes)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, message, type, priority, channels, metadata } = req.body;

    const notification = await createNotification(req.user.id, {
      title,
      message,
      type: type || 'system',
      priority: priority || 'medium',
      channels: channels || ['in-app'],
      metadata: metadata || {},
    });

    res.status(201).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;