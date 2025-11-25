const logger = require('../utils/logger');

// Enhanced error logging using winston
const logError = (err, req = null) => {
  const errorLog = {
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

  // Log error using winston
  logger.error('Application Error', errorLog);
};

// Performance monitoring
const logPerformance = (req, res, responseTime) => {
  const perfLog = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id,
    ip: req.ip,
  };

  // Log slow requests (>500ms) as warnings
  if (responseTime > 500) {
    logger.warn('Slow Request', perfLog);
  }

  // Log all requests as http level (only in development)
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    logger.http(`${req.method} ${req.url} - ${res.statusCode} (${responseTime}ms)`);
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
