const validator = require('validator');

/**
 * Input sanitization and validation middleware
 * Protects against XSS, SQL injection, and other input-based attacks
 */

// XSS sanitization function
const sanitizeXSS = (value) => {
  if (typeof value !== 'string') return value;

  // Remove script tags and other dangerous HTML
  let sanitized = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '');

  // Use validator to escape remaining HTML
  return validator.escape(sanitized);
};

// SQL injection prevention
const preventSQLInjection = (value) => {
  if (typeof value !== 'string') return value;

  // Remove common SQL injection patterns
  return value
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/xp_cmdshell/g, '') // Remove dangerous SQL functions
    .replace(/exec/g, '') // Remove exec commands
    .replace(/union\s+select/gi, '') // Remove union select
    .replace(/information_schema/gi, '') // Remove schema access
    .replace(/load_file/g, '') // Remove file loading
    .replace(/into\s+outfile/gi, ''); // Remove file writing
};

// Email validation
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;

  // Use validator for comprehensive email validation
  return validator.isEmail(email, {
    allow_utf8_local_part: false,
    require_tld: true,
    allow_ip_domain: false
  });
};

// Name validation
const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;

  // Check length
  if (name.length < 2 || name.length > 100) return false;

  // Check for only alphanumeric characters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s\-']+$/;
  if (!nameRegex.test(name)) return false;

  // Check for XSS attempts
  if (name.includes('<') || name.includes('>') || name.includes('script')) return false;

  return true;
};

// Password validation
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;

  // Minimum 8 characters, at least one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Sanitize request body recursively
const sanitizeObject = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return sanitizeXSS(preventSQLInjection(obj));
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeXSS(preventSQLInjection(value));
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// Main sanitization middleware
const inputSanitizer = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    // Additional validation for specific routes
    if (req.path.includes('/auth/register') || req.path.includes('/auth/login')) {
      // Validate email format
      if (req.body && req.body.email && !validateEmail(req.body.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Validate name for registration
      if (req.path.includes('/register') && req.body && req.body.name && !validateName(req.body.name)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid name format. Name must be 2-100 characters and contain only letters, spaces, hyphens, and apostrophes.'
        });
      }

      // Validate password
      if (req.body && req.body.password && !validatePassword(req.body.password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Input validation failed'
    });
  }
};

module.exports = inputSanitizer;