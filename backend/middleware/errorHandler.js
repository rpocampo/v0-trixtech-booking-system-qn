const fs = require('fs').promises;
const path = require('path');

// Enhanced error logging
const logError = async (err, req = null) => {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
    request: req ? {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    } : null,
  };

  // Log to console with colors for development
  console.error('\x1b[31m[ERROR]\x1b[0m', JSON.stringify(errorLog, null, 2));

  // Log to file for production monitoring
  try {
    const logDir = path.join(__dirname, '../logs');
    await fs.mkdir(logDir, { recursive: true });

    const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
    await fs.appendFile(logFile, JSON.stringify(errorLog) + '\n');
  } catch (logErr) {
    console.error('Failed to write error log:', logErr);
  }
};

// Performance monitoring
const logPerformance = (req, res, responseTime) => {
  const timestamp = new Date().toISOString();
  const perfLog = {
    timestamp,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id,
    ip: req.ip,
  };

  // Log slow requests (>500ms)
  if (responseTime > 500) {
    console.warn('\x1b[33m[SLOW REQUEST]\x1b[0m', JSON.stringify(perfLog));
  }

  // Log all requests in development (but not during testing)
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.log('\x1b[36m[REQUEST]\x1b[0m', `${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)`);
  }
};

const errorHandler = async (err, req, res, next) => {
  // Log the error
  await logError(err, req);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate field value',
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logPerformance(req, res, responseTime);
  });

  next();
};

module.exports = { errorHandler, requestLogger, logError };
