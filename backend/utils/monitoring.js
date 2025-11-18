const mongoose = require('mongoose');

// System monitoring utilities
class SystemMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastHealthCheck = null;
  }

  // Increment request counter
  recordRequest() {
    this.requestCount++;
  }

  // Record errors
  recordError(error, context = '') {
    this.errorCount++;
    console.error(`[MONITOR] Error recorded: ${error.message}`, context);
  }

  // Health check
  async performHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      requests: this.requestCount,
      errors: this.errorCount,
      database: 'unknown',
      services: {}
    };

    try {
      // Check database connection
      await mongoose.connection.db.admin().ping();
      health.database = 'healthy';
    } catch (error) {
      health.database = 'unhealthy';
      this.recordError(error, 'Database health check');
    }

    // Check service endpoints
    const services = ['auth', 'services', 'bookings', 'notifications', 'analytics'];
    for (const service of services) {
      try {
        const response = await fetch(`http://localhost:5000/api/${service === 'auth' ? 'auth/me' : service}`, {
          headers: { 'Authorization': 'Bearer test' },
          timeout: 5000
        });
        health.services[service] = response.status < 500 ? 'healthy' : 'degraded';
      } catch (error) {
        health.services[service] = 'unhealthy';
      }
    }

    this.lastHealthCheck = health;
    return health;
  }

  // Get system metrics
  getMetrics() {
    return {
      uptime: Date.now() - this.startTime,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) : 0,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  // Alert system for critical issues
  checkAlerts() {
    const alerts = [];

    if (this.errorCount > 10) {
      alerts.push({
        level: 'critical',
        message: 'High error rate detected',
        metric: `Errors: ${this.errorCount}`
      });
    }

    if (this.lastHealthCheck) {
      const unhealthyServices = Object.entries(this.lastHealthCheck.services)
        .filter(([_, status]) => status === 'unhealthy')
        .map(([service, _]) => service);

      if (unhealthyServices.length > 0) {
        alerts.push({
          level: 'warning',
          message: 'Services are unhealthy',
          metric: `Unhealthy: ${unhealthyServices.join(', ')}`
        });
      }

      if (this.lastHealthCheck.database === 'unhealthy') {
        alerts.push({
          level: 'critical',
          message: 'Database connection lost',
          metric: 'Database: unhealthy'
        });
      }
    }

    return alerts;
  }
}

// Global monitor instance
const monitor = new SystemMonitor();

// Middleware for request monitoring
const monitoringMiddleware = (req, res, next) => {
  monitor.recordRequest();

  // Monitor response
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      monitor.recordError(new Error(`HTTP ${res.statusCode}`), req.path);
    }
    return originalSend.call(this, data);
  };

  next();
};

// Health check endpoint
const healthCheckHandler = async (req, res) => {
  try {
    const health = await monitor.performHealthCheck();
    const alerts = monitor.checkAlerts();

    const status = health.database === 'healthy' &&
                   Object.values(health.services).every(s => s === 'healthy')
                   ? 'healthy' : 'degraded';

    res.json({
      status,
      ...health,
      alerts,
      metrics: monitor.getMetrics()
    });
  } catch (error) {
    monitor.recordError(error, 'Health check');
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  SystemMonitor,
  monitor,
  monitoringMiddleware,
  healthCheckHandler
};