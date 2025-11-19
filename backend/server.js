const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { initializeEmailService } = require('./utils/emailService');
const { processReservationQueue, cleanupExpiredReservations } = require('./utils/recommendationService');
const { errorHandler, requestLogger } = require('./middleware/errorHandler');
const { monitoringMiddleware, healthCheckHandler } = require('./utils/monitoring');

dotenv.config();

console.log('GCASH_QR_CODE loaded:', process.env.GCASH_QR_CODE ? 'YES' : 'NO');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
connectDB();

initializeEmailService();

// Middleware
app.use(cors());
app.use(express.json());
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

// Enhanced health check with monitoring
app.get('/api/health', healthCheckHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join user-specific room for targeted updates
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });

  // Join admin room for admin-specific updates
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log('Admin joined admin room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
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

// Process reservation queue every 5 minutes
setInterval(async () => {
  try {
    const processed = await processReservationQueue();
    if (processed > 0) {
      console.log(`Processed ${processed} queued reservations`);
    }
  } catch (error) {
    console.error('Error processing reservation queue:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

// Clean up expired reservations daily
setInterval(async () => {
  try {
    const cleaned = await cleanupExpiredReservations();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired reservations`);
    }
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error);
  }
}, 24 * 60 * 60 * 1000); // 24 hours

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`TRIXTECH Backend running on port ${PORT}`);
  console.log('Reservation queue processing enabled');
});
