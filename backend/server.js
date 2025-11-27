const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { connectDB, checkConnection } = require('./config/db');
const { connectRedis } = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const packageRoutes = require('./routes/packageRoutes');
const eventTypeRoutes = require('./routes/eventTypeRoutes');
const otpRoutes = require('./routes/otpRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const recommendationsRoutes = require('./routes/recommendationsRoutes');
const cartRoutes = require('./routes/cartRoutes');
const auditRoutes = require('./routes/auditRoutes');
const dataConsistencyRoutes = require('./routes/dataConsistencyRoutes');
const { initializeEmailService } = require('./utils/emailService');
const { processReservationQueue, cleanupExpiredReservations } = require('./utils/recommendationService');
const { cleanupExpiredOTPs } = require('./utils/otpService');
const { errorHandler, requestLogger } = require('./middleware/errorHandler');
const { monitoringMiddleware, healthCheckHandler } = require('./utils/monitoring');
const logger = require('./utils/logger');
const WebSocketMonitor = require('./utils/websocketMonitor');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || "https://yourdomain.com"
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Enhanced stability options
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000, // 60 seconds
  pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000, // 25 seconds
  connectTimeout: parseInt(process.env.WS_CONNECT_TIMEOUT) || 20000, // 20 seconds
  maxHttpBufferSize: 1e8, // 100MB for large payloads
  allowEIO3: true, // Allow Engine.IO v3 clients
  transports: ['websocket', 'polling'], // Prefer websocket, fallback to polling
  // Connection stability
  allowUpgrades: true,
  cookie: false,
  serveClient: false,
  // Reconnection settings
  reconnection: true,
  reconnectionAttempts: parseInt(process.env.WS_RECONNECTION_ATTEMPTS) || 10,
  reconnectionDelay: parseInt(process.env.WS_RECONNECTION_DELAY) || 1000,
  reconnectionDelayMax: parseInt(process.env.WS_RECONNECTION_DELAY_MAX) || 5000,
  randomizationFactor: 0.5
});

// Simple database connection check - no operations that could cause disconnections
const validateDatabaseConnection = () => {
  console.log('🔍 Checking database connection status...');

  const health = checkConnection();
  if (health.status === 'connected') {
    console.log('✅ Database connection is active and persistent');
    return true;
  } else {
    console.warn(`⚠️  Database connection status: ${health.status}`);
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 CRITICAL: Database not connected in production mode');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode - connection will be established when needed');
      return false;
    }
  }
};

// Initialize WebSocket monitor
const wsMonitor = new WebSocketMonitor(io);

// Make io and wsMonitor available globally for emitting events
global.io = io;
global.wsMonitor = wsMonitor;

// Connect to MongoDB and Redis (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  // Establish persistent database connection
  connectDB();
  connectRedis(); // Connect to Redis for distributed locking

  // Start WebSocket monitoring
  wsMonitor.startWatchdog();
  wsMonitor.startHealthMonitoring();
}

initializeEmailService();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes default
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || "https://yourdomain.com"]
      : ["http://localhost:3000", "http://127.0.0.1:3000"];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging and monitoring
app.use(requestLogger);
app.use(monitoringMiddleware);

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/event-types', eventTypeRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/consistency', dataConsistencyRoutes);

// Enhanced health check with monitoring
app.get('/api/health', healthCheckHandler);

// Readiness check endpoint - no operations that could cause disconnections
app.get('/api/ready', (req, res) => {
  try {
    // Check database status without performing operations
    const dbHealth = checkConnection();

    // Check Redis connectivity if available
    let redisStatus = 'not configured';
    if (global.redisClient) {
      try {
        // Only check if Redis client exists and is ready, don't ping
        redisStatus = global.redisClient.isOpen ? 'connected' : 'disconnected';
      } catch (redisError) {
        redisStatus = 'disconnected';
      }
    }

    const isReady = dbHealth.status === 'connected';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.status,
          readyState: dbHealth.readyState,
          name: mongoose.connection.name || 'unknown',
          host: mongoose.connection.host || 'unknown'
        },
        redis: redisStatus,
        email: 'configured' // Email service is initialized at startup
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: 'error',
        redis: global.redisClient ? 'unknown' : 'not configured'
      }
    });
  }
});

// Handle root path requests
app.all('/', (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Invalid request. API endpoints are available under /api/*',
    availableEndpoints: [
      '/api/auth',
      '/api/services',
      '/api/bookings',
      '/api/users',
      '/api/analytics',
      '/api/notifications',
      '/api/payments',
      '/api/deliveries',
      '/api/packages',
      '/api/event-types',
      '/api/otp',
      '/api/inventory',
      '/api/recommendations',
      '/api/cart',
      '/api/audit',
      '/api/consistency',
      '/api/health'
    ]
  });
});

// Socket.IO connection handling with enhanced stability
io.on('connection', (socket) => {
  console.log(`🔗 WebSocket connected: ${socket.id}`);

  // Register socket with monitor
  wsMonitor.registerSocket(socket);

  // Handle pong responses
  socket.on('pong', (data) => {
    wsMonitor.updateActivity(socket.id);
    console.log(`🏓 Pong received from ${socket.id}`);
  });

  // Join user-specific room for targeted updates
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    wsMonitor.setUserId(socket.id, userId);
    wsMonitor.addRoom(socket.id, `user_${userId}`);
    wsMonitor.updateActivity(socket.id);
    console.log(`👤 Socket ${socket.id} joined user room: user_${userId}`);
  });

  // Join admin room for admin-specific updates
  socket.on('join-admin', () => {
    socket.join('admin');
    wsMonitor.addRoom(socket.id, 'admin');
    wsMonitor.updateActivity(socket.id);
    console.log(`👑 Socket ${socket.id} joined admin room`);
  });

  // Handle reconnection attempts
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Socket ${socket.id} reconnection attempt ${attemptNumber}`);
    wsMonitor.recordReconnectionAttempt(socket.id);
    wsMonitor.updateActivity(socket.id);
  });

  // Handle successful reconnection
  socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ Socket ${socket.id} reconnected after ${attemptNumber} attempts`);
    wsMonitor.recordSuccessfulReconnection(socket.id);
    wsMonitor.updateActivity(socket.id);
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error(`❌ Socket ${socket.id} connection error:`, error.message);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket ${socket.id} disconnected: ${reason}`);
    wsMonitor.unregisterSocket(socket.id);

    // Attempt to notify other clients about disconnection if needed
    if (reason === 'io server disconnect') {
      console.log(`🔄 Server initiated disconnect for ${socket.id}, client should reconnect`);
    }
  });

  // Send initial connection confirmation
  socket.emit('connected', {
    socketId: socket.id,
    timestamp: Date.now(),
    serverTime: new Date().toISOString()
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Process reservation queue every 5 minutes (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await processReservationQueue();
    } catch (error) {
      console.error('Error processing reservation queue:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Clean up expired reservations daily
  setInterval(async () => {
    try {
      await cleanupExpiredReservations();
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Clean up expired OTPs every hour
  setInterval(async () => {
    try {
      await cleanupExpiredOTPs();
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
}

const PORT = process.env.PORT || 5000;

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop WebSocket monitoring
    wsMonitor.cleanup();

    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('Database connection closed');
    }

    // Close Redis connection
    if (global.redisClient && global.redisClient.isOpen) {
      await global.redisClient.quit();
      console.log('Redis connection closed');
    }

    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Export app for testing
module.exports = app;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Check database connection status before starting server
  const dbValid = validateDatabaseConnection();
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    if (dbValid) {
      console.log('🚀 Server started with persistent database connection');
    } else {
      console.log('⚠️  Server started - database connection will be established when needed');
    }
  });
}
