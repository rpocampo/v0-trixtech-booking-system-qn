const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Truly persistent connection - never disconnect
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech', {
      // Disable timeouts that cause disconnections
      maxIdleTimeMS: 0, // Never close idle connections
      socketTimeoutMS: 0, // Never timeout sockets
      serverSelectionTimeoutMS: 30000, // Reasonable server selection timeout
      connectTimeoutMS: 30000, // Reasonable connection timeout
      bufferCommands: false,
      // Single persistent connection - no pooling to avoid connection issues
      maxPoolSize: 1,
      minPoolSize: 1,
      // Keep connection alive
      keepAlive: true,
      keepAliveInitialDelay: 0
    });

    console.log('MongoDB connected successfully with persistent connection:', conn.connection.host);

    // Remove all event handlers that could trigger disconnections
    mongoose.connection.removeAllListeners();

    // Only log errors but don't attempt reconnection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error (connection remains active):', err.message);
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('Running in development mode - continuing without database connection');
    }
  }
};

// Simple connection status check - no operations that could cause disconnections
const checkConnection = () => {
  const readyState = mongoose.connection.readyState;
  let status = 'unknown';

  switch (readyState) {
    case 0:
      status = 'disconnected';
      break;
    case 1:
      status = 'connected';
      break;
    case 2:
      status = 'connecting';
      break;
    case 3:
      status = 'disconnecting';
      break;
    default:
      status = 'unknown';
  }

  return { status, readyState };
};

module.exports = {
  connectDB,
  checkConnection
};
