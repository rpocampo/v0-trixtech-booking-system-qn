const express = require('express');
const { adminMiddleware } = require('../middleware/auth');
const { auditService } = require('../utils/auditService');

const router = express.Router();

// Get audit logs with filtering (admin only)
router.get('/logs', adminMiddleware, async (req, res, next) => {
  try {
    const {
      userId,
      eventType,
      action,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (eventType) filters.eventType = eventType;
    if (action) filters.action = action;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const logs = auditService.getAuditLogs(filters);

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedLogs = logs.slice(startIndex, endIndex);

    res.json({
      success: true,
      logs: paginatedLogs,
      total: logs.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get audit summary (admin only)
router.get('/summary', adminMiddleware, async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;
    const summary = auditService.getAuditSummary(parseInt(hours));

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// Get audit statistics (admin only)
router.get('/stats', adminMiddleware, async (req, res, next) => {
  try {
    const logs = auditService.getAuditLogs();

    // Calculate statistics
    const stats = {
      totalEvents: logs.length,
      uniqueUsers: new Set(logs.map(log => log.userId)).size,
      eventsByType: {},
      eventsByAction: {},
      recentActivity: logs.slice(0, 10), // Last 10 events
      hourlyActivity: {}
    };

    // Group by event type and action
    logs.forEach(log => {
      stats.eventsByType[log.eventType] = (stats.eventsByType[log.eventType] || 0) + 1;
      stats.eventsByAction[log.action] = (stats.eventsByAction[log.action] || 0) + 1;

      // Group by hour
      const hour = new Date(log.timestamp).getHours();
      stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;
    });

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
  }
});

// Clean up old audit logs (admin only)
router.post('/cleanup', adminMiddleware, async (req, res, next) => {
  try {
    const { daysToKeep = 30 } = req.body;

    const removedCount = auditService.clearOldLogs(parseInt(daysToKeep));

    res.json({
      success: true,
      message: `Cleaned up ${removedCount} audit log entries older than ${daysToKeep} days`
    });
  } catch (error) {
    next(error);
  }
});

// Export audit logs (admin only)
router.get('/export', adminMiddleware, async (req, res, next) => {
  try {
    const {
      userId,
      eventType,
      action,
      startDate,
      endDate,
      format = 'json'
    } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (eventType) filters.eventType = eventType;
    if (action) filters.action = action;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const logs = auditService.getAuditLogs(filters);

    if (format === 'csv') {
      // Convert to CSV
      const csvHeaders = ['timestamp', 'eventType', 'userId', 'action', 'details', 'ip', 'userAgent'];
      const csvRows = logs.map(log => [
        log.timestamp,
        log.eventType,
        log.userId,
        log.action,
        JSON.stringify(log.details),
        log.metadata.ip || '',
        log.metadata.userAgent || ''
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send(csvContent);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
      res.json(logs);
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;