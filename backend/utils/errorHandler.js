const mongoose = require('mongoose');

// Enhanced error handler with actionable recovery options
const createActionableError = (error, context = {}) => {
  const actionableError = {
    success: false,
    error: {
      type: error.name || 'UnknownError',
      message: error.message || 'An unexpected error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      context
    },
    recovery: {
      suggestions: [],
      actions: [],
      contactSupport: false
    }
  };

  // Analyze error type and provide specific recovery options
  if (error.name === 'ValidationError') {
    actionableError.recovery.suggestions.push('Please check all required fields are filled correctly');
    actionableError.recovery.actions.push({
      type: 'retry',
      label: 'Try Again',
      description: 'Review and correct the form data'
    });
  } else if (error.name === 'CastError' && error.kind === 'ObjectId') {
    actionableError.error.message = 'Invalid data format provided';
    actionableError.recovery.suggestions.push('The requested item may not exist or may have been deleted');
    actionableError.recovery.actions.push({
      type: 'navigate',
      label: 'Go Back',
      destination: '/customer/services',
      description: 'Return to services list'
    });
  } else if (error.code === 11000) { // Duplicate key error
    actionableError.error.message = 'This item already exists';
    actionableError.recovery.suggestions.push('Try using a different name or identifier');
    actionableError.recovery.actions.push({
      type: 'modify',
      label: 'Modify Details',
      description: 'Change the conflicting information'
    });
  } else if (error.message.includes('availability') || error.message.includes('stock')) {
    actionableError.error.type = 'AvailabilityError';
    actionableError.recovery.suggestions.push('This item is currently out of stock or unavailable');
    actionableError.recovery.suggestions.push('Consider alternative options or try again later');
    actionableError.recovery.actions.push({
      type: 'queue',
      label: 'Join Waitlist',
      description: 'Be notified when this item becomes available'
    });
    actionableError.recovery.actions.push({
      type: 'alternatives',
      label: 'View Alternatives',
      description: 'See similar available items'
    });
  } else if (error.message.includes('payment') || error.message.includes('transaction')) {
    actionableError.error.type = 'PaymentError';
    actionableError.recovery.suggestions.push('There was an issue processing your payment');
    actionableError.recovery.suggestions.push('Check your payment method and try again');
    actionableError.recovery.actions.push({
      type: 'retry_payment',
      label: 'Retry Payment',
      description: 'Attempt payment again'
    });
    actionableError.recovery.actions.push({
      type: 'change_payment',
      label: 'Change Payment Method',
      description: 'Use a different payment method'
    });
  } else if (error.message.includes('network') || error.message.includes('connection')) {
    actionableError.error.type = 'NetworkError';
    actionableError.recovery.suggestions.push('Check your internet connection');
    actionableError.recovery.suggestions.push('Try refreshing the page');
    actionableError.recovery.actions.push({
      type: 'retry',
      label: 'Retry',
      description: 'Try the action again'
    });
    actionableError.recovery.actions.push({
      type: 'refresh',
      label: 'Refresh Page',
      description: 'Reload the current page'
    });
  } else if (error.message.includes('authorization') || error.message.includes('permission')) {
    actionableError.error.type = 'AuthorizationError';
    actionableError.recovery.suggestions.push('You may not have permission to perform this action');
    actionableError.recovery.suggestions.push('Try logging in again');
    actionableError.recovery.actions.push({
      type: 'login',
      label: 'Sign In',
      destination: '/login',
      description: 'Log in to your account'
    });
  } else if (error.message.includes('expired')) {
    actionableError.error.type = 'ExpiryError';
    actionableError.recovery.suggestions.push('Your session or link has expired');
    actionableError.recovery.suggestions.push('Please start over or request a new link');
    actionableError.recovery.actions.push({
      type: 'restart',
      label: 'Start Over',
      description: 'Begin the process again'
    });
  }

  // Add contact support for critical errors
  if (['PaymentError', 'ValidationError', 'UnknownError'].includes(actionableError.error.type) ||
      error.code >= 500) {
    actionableError.recovery.contactSupport = true;
    actionableError.recovery.actions.push({
      type: 'support',
      label: 'Contact Support',
      description: 'Get help from our support team'
    });
  }

  // Add context-specific recovery options
  if (context.bookingId) {
    actionableError.recovery.actions.push({
      type: 'view_booking',
      label: 'View Booking',
      destination: `/customer/bookings/${context.bookingId}`,
      description: 'Check your booking details'
    });
  }

  if (context.serviceId) {
    actionableError.recovery.actions.push({
      type: 'view_service',
      label: 'View Service',
      destination: `/customer/booking/${context.serviceId}`,
      description: 'Go back to service page'
    });
  }

  return actionableError;
};

// Enhanced error response middleware
const enhancedErrorHandler = (error, req, res, next) => {
  console.error('Enhanced Error Handler:', error);

  // Default error response
  let statusCode = 500;
  let actionableError = createActionableError(error, {
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    bookingId: req.params.id || req.body?.bookingId,
    serviceId: req.params.serviceId || req.body?.serviceId
  });

  // Set appropriate status codes
  if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'CastError') {
    statusCode = 400;
  } else if (error.code === 11000) {
    statusCode = 409;
  } else if (error.message.includes('availability') || error.message.includes('stock')) {
    statusCode = 409;
  } else if (error.message.includes('authorization') || error.message.includes('permission')) {
    statusCode = 403;
  } else if (error.message.includes('not found')) {
    statusCode = 404;
  } else if (error.message.includes('expired')) {
    statusCode = 410;
  }

  // Add request-specific context
  if (req.bookingIntent) {
    actionableError.recovery.actions.push({
      type: 'resume_booking',
      label: 'Resume Booking',
      description: 'Continue with your booking process'
    });
  }

  res.status(statusCode).json(actionableError);
};

// Success response with helpful information
const createSuccessResponse = (data, message = null, suggestions = []) => {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  if (message) {
    response.message = message;
  }

  if (suggestions.length > 0) {
    response.suggestions = suggestions;
  }

  return response;
};

// Validation error formatter
const formatValidationErrors = (errors) => {
  const formatted = {
    success: false,
    error: {
      type: 'ValidationError',
      message: 'Please correct the following errors:',
      details: [],
      timestamp: new Date().toISOString()
    },
    recovery: {
      suggestions: ['Review and correct the highlighted fields'],
      actions: [{
        type: 'fix_validation',
        label: 'Fix Errors',
        description: 'Correct the validation errors and try again'
      }]
    }
  };

  // Format mongoose validation errors
  if (errors.errors) {
    formatted.error.details = Object.values(errors.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  }

  return formatted;
};

module.exports = {
  createActionableError,
  enhancedErrorHandler,
  createSuccessResponse,
  formatValidationErrors
};