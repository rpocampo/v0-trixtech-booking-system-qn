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
      databaseDetails: {},
      services: {}
    };

    try {
      // Check database connection with detailed metrics
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      const dbLatency = Date.now() - dbStart;

      health.database = 'healthy';
      health.databaseDetails = {
        latency: dbLatency,
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        poolSize: mongoose.connection.db?.serverConfig?.poolSize || 'unknown',
        connections: {
          available: mongoose.connection.db?.serverConfig?.availableConnections || 'unknown',
          pending: mongoose.connection.db?.serverConfig?.pendingConnections || 'unknown'
        }
      };
    } catch (error) {
      health.database = 'unhealthy';
      health.databaseDetails = {
        error: error.message,
        readyState: mongoose.connection.readyState
      };
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


      // Database latency alerts
      if (this.lastHealthCheck.databaseDetails?.latency > 5000) { // 5 seconds
        alerts.push({
          level: 'warning',
          message: 'High database latency detected',
          metric: `Latency: ${this.lastHealthCheck.databaseDetails.latency}ms`
        });
      }

      // Connection pool alerts
      const poolSize = this.lastHealthCheck.databaseDetails?.connections?.available;
      if (poolSize !== undefined && poolSize < 5) {
        alerts.push({
          level: 'warning',
          message: 'Low database connection pool availability',
          metric: `Available connections: ${poolSize}`
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
  // Skip monitoring during testing
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  monitor.recordRequest();

  // Monitor response
  const originalSend = res.send;
  res.send = function(data) {
    // Don't log 400 errors for root path since they're handled with helpful messages
    // Also don't log 401 (unauthorized) errors as they're normal authentication failures
    if (res.statusCode >= 400 && !(res.statusCode === 400 && req.path === '/') && res.statusCode !== 401) {
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