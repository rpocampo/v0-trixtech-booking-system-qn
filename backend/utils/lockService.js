const { redisClient } = require('../config/redis');

/**
 * Distributed locking service using Redis
 * Prevents race conditions during concurrent booking operations
 */
class LockService {
  constructor() {
    this.defaultTTL = 30000; // 30 seconds default lock TTL
    this.retryDelay = 100; // 100ms retry delay
    this.maxRetries = 5; // Maximum retry attempts
  }

  /**
   * Acquire a distributed lock
   * @param {string} key - Lock key (e.g., 'booking:service:123:date:2024-01-01')
   * @param {string} ownerId - Unique identifier for the lock owner
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<boolean>} - True if lock acquired, false otherwise
   */
  async acquireLock(key, ownerId, ttl = this.defaultTTL) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        console.warn('Redis not available, skipping lock acquisition');
        return true; // Allow operation to proceed without locking
      }

      const lockValue = `${ownerId}:${Date.now()}`;
      const result = await redisClient.set(key, lockValue, {
        NX: true, // Only set if key doesn't exist
        PX: ttl // Expire after TTL milliseconds
      });

      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return true; // Allow operation to proceed if locking fails
    }
  }

  /**
   * Release a distributed lock
   * @param {string} key - Lock key
   * @param {string} ownerId - Owner identifier to verify ownership
   * @returns {Promise<boolean>} - True if lock released, false otherwise
   */
  async releaseLock(key, ownerId) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        return true; // No lock to release
      }

      // Use Lua script to ensure atomic check-and-delete
      const script = `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        else
          return 0
        end
      `;

      const result = await redisClient.eval(script, {
        keys: [key],
        arguments: [`${ownerId}:${Date.now()}`]
      });

      return result === 1;
    } catch (error) {
      console.error('Error releasing lock:', error);
      return false;
    }
  }

  /**
   * Execute a function with distributed locking
   * @param {string} key - Lock key
   * @param {string} ownerId - Unique owner identifier
   * @param {Function} fn - Function to execute while holding the lock
   * @param {number} ttl - Lock TTL in milliseconds
   * @returns {Promise<any>} - Result of the function execution
   */
  async withLock(key, ownerId, fn, ttl = this.defaultTTL) {
    let lockAcquired = false;

    try {
      // Try to acquire lock with retries
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        lockAcquired = await this.acquireLock(key, ownerId, ttl);

        if (lockAcquired) {
          break;
        }

        if (attempt < this.maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }

      if (!lockAcquired) {
        throw new Error(`Failed to acquire lock for key: ${key}`);
      }

      // Execute the function while holding the lock
      const result = await fn();

      return result;

    } finally {
      // Always try to release the lock
      if (lockAcquired) {
        try {
          await this.releaseLock(key, ownerId);
        } catch (releaseError) {
          console.error('Error releasing lock:', releaseError);
        }
      }
    }
  }

  /**
   * Generate a lock key for booking availability
   * @param {string} serviceId - Service ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {string} - Lock key
   */
  generateBookingLockKey(serviceId, date) {
    return `booking:service:${serviceId}:date:${date}`;
  }

  /**
   * Generate a lock key for inventory operations
   * @param {string} serviceId - Service ID
   * @returns {string} - Lock key
   */
  generateInventoryLockKey(serviceId) {
    return `inventory:service:${serviceId}`;
  }

  /**
   * Check if a lock exists (for monitoring/debugging)
   * @param {string} key - Lock key
   * @returns {Promise<string|null>} - Lock value or null if not locked
   */
  async checkLock(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        return null;
      }

      return await redisClient.get(key);
    } catch (error) {
      console.error('Error checking lock:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new LockService();