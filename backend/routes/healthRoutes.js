const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import monitoring utilities
const { monitor } = require('../utils/monitoring');

// Health check middleware for detailed logging
const healthCheckMiddleware = (req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[HEALTH] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
};

// Basic health check (for load balancers)
router.get('/', healthCheckMiddleware, async (req, res) => {
  try {
    const basicHealth = await performBasicHealthCheck();
    const status = basicHealth.overall === 'healthy' ? 200 : 503;

    res.status(status).json({
      status: basicHealth.overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Basic health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check
router.get('/detailed', healthCheckMiddleware, async (req, res) => {
  try {
    const [
      basicHealth,
      databaseHealth,
      externalServicesHealth,
      fileSystemHealth,
      backupHealth
    ] = await Promise.allSettled([
      performBasicHealthCheck(),
      checkDatabaseHealth(),
      checkExternalServicesHealth(),
      checkFileSystemHealth(),
      checkBackupHealth()
    ]);

    const health = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        basic: basicHealth.status === 'fulfilled' ? basicHealth.value : { error: basicHealth.reason.message },
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : { error: databaseHealth.reason.message },
        externalServices: externalServicesHealth.status === 'fulfilled' ? externalServicesHealth.value : { error: externalServicesHealth.reason.message },
        fileSystem: fileSystemHealth.status === 'fulfilled' ? fileSystemHealth.value : { error: fileSystemHealth.reason.message },
        backup: backupHealth.status === 'fulfilled' ? backupHealth.value : { error: backupHealth.reason.message }
      }
    };

    // Determine overall status
    const allChecks = Object.values(health.checks);
    const hasCriticalFailure = allChecks.some(check =>
      check.error || check.status === 'unhealthy' || (check.database && check.database.status === 'unhealthy')
    );

    health.overall = hasCriticalFailure ? 'unhealthy' : 'healthy';
    const statusCode = hasCriticalFailure ? 503 : 200;

    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Detailed health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Prometheus metrics endpoint
router.get('/metrics', healthCheckMiddleware, async (req, res) => {
  try {
    const metrics = await generatePrometheusMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    console.error('Metrics generation error:', error);
    res.status(500).send(`# Error generating metrics: ${error.message}`);
  }
});

// Individual service health checks
router.get('/database', healthCheckMiddleware, async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    res.json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/external-services', healthCheckMiddleware, async (req, res) => {
  try {
    const health = await checkExternalServicesHealth();
    res.json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/filesystem', healthCheckMiddleware, async (req, res) => {
  try {
    const health = await checkFileSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/backup', healthCheckMiddleware, async (req, res) => {
  try {
    const health = await checkBackupHealth();
    res.json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/active-users', healthCheckMiddleware, (req, res) => {
  res.json({ count: global.activeUsers || 0 });
});

// Health check functions
async function performBasicHealthCheck() {
  return {
    overall: 'healthy',
    services: {
      node: 'healthy',
      express: 'healthy'
    }
  };
}

async function checkDatabaseHealth() {
  const health = {
    status: 'unknown',
    latency: null,
    connections: null,
    error: null
  };

  try {
    const startTime = Date.now();

    // Check MongoDB connection
    await mongoose.connection.db.admin().ping();
    health.latency = Date.now() - startTime;

    // Get connection stats
    const stats = await mongoose.connection.db.stats();
    health.connections = {
      active: stats.connections?.current || 0,
      available: stats.connections?.available || 0
    };

    health.status = 'healthy';
  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
    console.error('Database health check failed:', error);
  }

  return health;
}

async function checkExternalServicesHealth() {
  const services = {
    redis: { status: 'unknown', error: null },
    email: { status: 'unknown', error: null },
    paymentGateway: { status: 'unknown', error: null }
  };

  // Check Redis
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      });

      await client.connect();
      await client.ping();
      await client.quit();
      services.redis.status = 'healthy';
    } catch (error) {
      services.redis.status = 'unhealthy';
      services.redis.error = error.message;
    }
  } else {
    services.redis.status = 'disabled';
  }

  // Check email service (SendGrid)
  if (process.env.SENDGRID_API_KEY) {
    try {
      // Simple API key validation
      if (process.env.SENDGRID_API_KEY.length > 10) {
        services.email.status = 'healthy';
      } else {
        services.email.status = 'unhealthy';
        services.email.error = 'Invalid API key format';
      }
    } catch (error) {
      services.email.status = 'unhealthy';
      services.email.error = error.message;
    }
  } else {
    services.email.status = 'disabled';
  }

  // Check payment gateway
  if (process.env.PAYMENT_GATEWAY_URL) {
    try {
      const response = await fetch(process.env.PAYMENT_GATEWAY_URL + '/health', {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${process.env.PAYMENT_GATEWAY_KEY || 'test'}`
        }
      });

      services.paymentGateway.status = response.ok ? 'healthy' : 'degraded';
    } catch (error) {
      services.paymentGateway.status = 'unhealthy';
      services.paymentGateway.error = error.message;
    }
  } else {
    services.paymentGateway.status = 'disabled';
  }

  const overallStatus = Object.values(services).every(s => s.status === 'healthy' || s.status === 'disabled')
    ? 'healthy'
    : Object.values(services).some(s => s.status === 'unhealthy')
    ? 'unhealthy'
    : 'degraded';

  return {
    status: overallStatus,
    services
  };
}

async function checkFileSystemHealth() {
  const health = {
    status: 'unknown',
    disk: { used: 0, available: 0, total: 0, percentage: 0 },
    permissions: {},
    error: null
  };

  try {
    // Check disk space
    const diskUsage = await getDiskUsage();
    health.disk = diskUsage;

    // Check critical directories permissions
    const criticalPaths = [
      './uploads',
      './backups',
      './logs',
      './temp'
    ];

    for (const dirPath of criticalPaths) {
      try {
        await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
        health.permissions[dirPath] = 'ok';
      } catch (error) {
        health.permissions[dirPath] = 'error';
      }
    }

    // Determine status
    const lowDiskSpace = health.disk.percentage > 85;
    const permissionErrors = Object.values(health.permissions).includes('error');

    if (permissionErrors) {
      health.status = 'unhealthy';
    } else if (lowDiskSpace) {
      health.status = 'degraded';
    } else {
      health.status = 'healthy';
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
  }

  return health;
}

async function checkBackupHealth() {
  const health = {
    status: 'unknown',
    lastBackup: null,
    backupSize: null,
    verificationStatus: null,
    error: null
  };

  try {
    // Check for recent backup files
    const backupDir = process.env.BACKUP_DIR || './backups';
    const files = await fs.readdir(backupDir).catch(() => []);

    if (files.length === 0) {
      health.status = 'unhealthy';
      health.error = 'No backup files found';
      return health;
    }

    // Find latest backup
    const backupFiles = files
      .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip'))
      .sort()
      .reverse();

    if (backupFiles.length > 0) {
      const latestBackup = backupFiles[0];
      const stats = await fs.stat(path.join(backupDir, latestBackup));
      health.lastBackup = stats.mtime.toISOString();
      health.backupSize = stats.size;

      // Check if backup is recent (within 24 hours)
      const backupAge = Date.now() - stats.mtime.getTime();
      const isRecent = backupAge < 24 * 60 * 60 * 1000;

      health.status = isRecent ? 'healthy' : 'degraded';
    } else {
      health.status = 'unhealthy';
      health.error = 'No valid backup files found';
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.error = error.message;
  }

  return health;
}

async function getDiskUsage() {
  try {
    // Use system commands to get disk usage
    const { stdout } = await execAsync('df -h . | tail -1');
    const parts = stdout.trim().split(/\s+/);

    // Parse df output (simplified)
    const total = parseFloat(parts[1].replace(/[^0-9.]/g, '')) * (parts[1].includes('G') ? 1024 : 1);
    const used = parseFloat(parts[2].replace(/[^0-9.]/g, '')) * (parts[2].includes('G') ? 1024 : 1);
    const available = parseFloat(parts[3].replace(/[^0-9.]/g, '')) * (parts[3].includes('G') ? 1024 : 1);

    return {
      used: Math.round(used),
      available: Math.round(available),
      total: Math.round(total),
      percentage: Math.round((used / total) * 100)
    };
  } catch (error) {
    // Fallback for Windows or when df is not available
    return {
      used: 0,
      available: 100,
      total: 100,
      percentage: 0,
      error: 'Unable to determine disk usage'
    };
  }
}

async function generatePrometheusMetrics() {
  const metrics = [];
  const timestamp = Date.now();

  // Basic metrics
  metrics.push(`# HELP trixtech_up Service uptime status`);
  metrics.push(`# TYPE trixtech_up gauge`);
  metrics.push(`trixtech_up 1 ${timestamp}`);

  metrics.push(`# HELP trixtech_uptime_seconds Service uptime in seconds`);
  metrics.push(`# TYPE trixtech_uptime_seconds counter`);
  metrics.push(`trixtech_uptime_seconds ${process.uptime()} ${timestamp}`);

  // Memory metrics
  const memUsage = process.memoryUsage();
  metrics.push(`# HELP trixtech_memory_usage_bytes Memory usage in bytes`);
  metrics.push(`# TYPE trixtech_memory_usage_bytes gauge`);
  metrics.push(`trixtech_memory_usage_bytes{type="rss"} ${memUsage.rss} ${timestamp}`);
  metrics.push(`trixtech_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed} ${timestamp}`);
  metrics.push(`trixtech_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal} ${timestamp}`);

  // Request metrics from monitor
  const monitorMetrics = monitor.getMetrics();
  metrics.push(`# HELP trixtech_requests_total Total number of requests`);
  metrics.push(`# TYPE trixtech_requests_total counter`);
  metrics.push(`trixtech_requests_total ${monitorMetrics.totalRequests} ${timestamp}`);

  metrics.push(`# HELP trixtech_errors_total Total number of errors`);
  metrics.push(`# TYPE trixtech_errors_total counter`);
  metrics.push(`trixtech_errors_total ${monitorMetrics.totalErrors} ${timestamp}`);

  if (monitorMetrics.errorRate !== 'N/A') {
    metrics.push(`# HELP trixtech_error_rate_percent Error rate percentage`);
    metrics.push(`# TYPE trixtech_error_rate_percent gauge`);
    metrics.push(`trixtech_error_rate_percent ${monitorMetrics.errorRate} ${timestamp}`);
  }

  return metrics.join('\n') + '\n';
}

module.exports = router;