const { checkConnection } = require('../config/db');

/**
 * Simplified database operation wrapper
 * Basic wrappers for database operations with direct connection
 */

// Simple wrapper for database operations
const executeWithConnectionCheck = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error('Database operation failed:', error.message);
    throw error;
  }
};

// Simple transaction-like wrapper for multiple operations
const executeTransaction = async (operations) => {
  const results = [];
  for (const operation of operations) {
    try {
      const result = await operation();
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error: error.message });
      console.error('Database operation failed in transaction:', error.message);
    }
  }
  return results;
};

// Simple critical operation wrapper with basic retry
const executeCritical = async (operation, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Critical database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying critical operation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Critical database operation failed after ${maxRetries} attempts: ${lastError.message}`);
};

// Simple health check - no operations that could cause disconnections
const healthCheckOperation = () => {
  const health = require('../config/db').checkConnection();
  return {
    status: health.status === 'connected' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    details: health
  };
};

module.exports = {
  executeWithConnectionCheck,
  executeTransaction,
  executeCritical,
  healthCheckOperation
};