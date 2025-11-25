const logger = require('./logger');

/**
 * Audit Service for logging system events and changes
 */
class AuditService {
  constructor() {
    this.events = [];
  }

  /**
   * Log an audit event
   * @param {string} eventType - Type of event (e.g., 'inventory_update', 'user_login')
   * @param {string} userId - ID of the user performing the action
   * @param {Object} details - Additional details about the event
   */
  logEvent(eventType, userId, details = {}) {
    const auditEntry = {
      eventType,
      userId,
      timestamp: new Date().toISOString(),
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    };

    // Store in memory (for development - in production, this would go to a database)
    this.events.push(auditEntry);

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log to file using winston
    logger.info('AUDIT EVENT', {
      eventType,
      userId,
      details: JSON.stringify(details)
    });

    return auditEntry;
  }

  /**
   * Get audit events for a specific user
   * @param {string} userId - User ID to filter by
   * @param {number} limit - Maximum number of events to return
   */
  getUserEvents(userId, limit = 50) {
    return this.events
      .filter(event => event.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit events by type
   * @param {string} eventType - Event type to filter by
   * @param {number} limit - Maximum number of events to return
   */
  getEventsByType(eventType, limit = 50) {
    return this.events
      .filter(event => event.eventType === eventType)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get recent audit events
   * @param {number} limit - Maximum number of events to return
   */
  getRecentEvents(limit = 100) {
    return this.events.slice(-limit).reverse();
  }

  /**
   * Search audit events
   * @param {Object} filters - Search filters
   * @param {number} limit - Maximum number of events to return
   */
  searchEvents(filters = {}, limit = 50) {
    let filteredEvents = [...this.events];

    if (filters.eventType) {
      filteredEvents = filteredEvents.filter(event => event.eventType === filters.eventType);
    }

    if (filters.userId) {
      filteredEvents = filteredEvents.filter(event => event.userId === filters.userId);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) <= endDate);
    }

    return filteredEvents.slice(-limit).reverse();
  }
}

// Create singleton instance
const auditService = new AuditService();

module.exports = auditService;