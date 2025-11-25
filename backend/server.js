const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
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

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || "https://yourdomain.com"
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  connectRedis(); // Connect to Redis for distributed locking
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
      imgSrc: ["'self'", "data:", "https:"],
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

// Readiness check endpoint
app.get('/api/ready', async (req, res) => {
  try {
    // Check database connectivity
    await mongoose.connection.db.admin().ping();

    // Check Redis connectivity if available
    if (global.redisClient) {
      await global.redisClient.ping();
    }

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: global.redisClient ? 'connected' : 'not configured',
        email: 'configured' // Email service is initialized at startup
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Join user-specific room for targeted updates
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  // Join admin room for admin-specific updates
  socket.on('join-admin', () => {
    socket.join('admin');
  });
});

// Make io available globally for emitting events
global.io = io;

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

// Export app for testing
module.exports = app;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}
