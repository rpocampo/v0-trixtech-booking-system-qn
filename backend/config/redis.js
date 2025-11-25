const redis = require('redis');

// Redis client configuration - conditionally create based on environment
let redisClient = null;

if (process.env.REDIS_ENABLED === 'true') {
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        console.error('Redis server connection refused');
        return new Error('Redis server connection refused');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        console.error('Redis retry time exhausted');
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        console.error('Redis max retry attempts reached');
        return undefined;
      }
      // Reconnect after
      return Math.min(options.attempt * 100, 3000);
    }
  });

  // Handle connection events
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });

  redisClient.on('ready', () => {
    console.log('Redis client ready');
  });

  redisClient.on('end', () => {
    console.log('Redis connection ended');
  });
} else {
  console.log('Redis disabled for development. Distributed locking will not be available.');
}

// Connect to Redis (only if enabled)
const connectRedis = async () => {
  if (!redisClient) {
    console.log('Redis is disabled, skipping connection');
    return;
  }

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Don't throw error - allow app to continue without Redis
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing Redis connection...');
  await redisClient.quit();
});

process.on('SIGINT', async () => {
  console.log('Closing Redis connection...');
  await redisClient.quit();
});

module.exports = {
  redisClient,
  connectRedis
};