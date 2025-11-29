const express = require('express');
const cors = require('cors');
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
const healthRoutes = require('./routes/healthRoutes');
const { initializeEmailService } = require('./utils/emailService');
const { processReservationQueue, cleanupExpiredReservations } = require('./utils/recommendationService');
const { cleanupExpiredOTPs } = require('./utils/otpService');
const { sendBookingReminders } = require('./utils/notificationService');
const { autoCancelExpiredBookings } = require('./routes/bookingRoutes');
const { autoApplyDiscounts } = require('./utils/dynamicDiscountService');
const { cleanupExpiredWaitlistEntries, sendProactiveWaitlistUpdates } = require('./utils/autoWaitlistService');
const { sendReorderAlerts, optimizeInventoryLevels } = require('./utils/autoInventoryService');
const AutoRebookingService = require('./utils/autoRebookingService');
const { errorHandler, requestLogger } = require('./middleware/errorHandler');
const { monitoringMiddleware } = require('./utils/monitoring');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  connectRedis(); // Connect to Redis for distributed locking
}

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
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/event-types', eventTypeRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recommendations', recommendationsRoutes);

// Enhanced health check routes
app.use('/api/health', healthRoutes);

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

  // Send booking reminders every 15 minutes
  setInterval(async () => {
    try {
      await sendBookingReminders();
    } catch (error) {
      console.error('Error sending booking reminders:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes

  // Auto-cancel expired pending bookings every hour
  setInterval(async () => {
    try {
      const result = await autoCancelExpiredBookings();
      if (result.cancelledCount > 0) {
        console.log(`Auto-cancelled ${result.cancelledCount} expired bookings`);
      }
    } catch (error) {
      console.error('Error auto-cancelling expired bookings:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Auto-apply dynamic discounts every 30 minutes
  setInterval(async () => {
    try {
      const result = await autoApplyDiscounts();
      if (result.discountsApplied > 0) {
        console.log(`Auto-applied discounts to ${result.discountsApplied} bookings, total savings: ₱${result.totalDiscountAmount.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error auto-applying discounts:', error);
    }
  }, 30 * 60 * 1000); // 30 minutes

  // Clean up expired waitlist entries daily
  setInterval(async () => {
    try {
      const result = await cleanupExpiredWaitlistEntries();
      if (result.expiredOffers > 0 || result.cleanedCompleted > 0 || result.cleanedExpired > 0) {
        console.log(`Cleaned up waitlist: ${result.expiredOffers} expired offers, ${result.cleanedCompleted} old completed, ${result.cleanedExpired} old expired`);
      }
    } catch (error) {
      console.error('Error cleaning up expired waitlist entries:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Send proactive waitlist updates every 6 hours
  setInterval(async () => {
    try {
      const result = await sendProactiveWaitlistUpdates();
      if (result.notificationsSent > 0) {
        console.log(`Sent ${result.notificationsSent} proactive waitlist updates`);
      }
    } catch (error) {
      console.error('Error sending proactive waitlist updates:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Send inventory reorder alerts daily
  setInterval(async () => {
    try {
      const result = await sendReorderAlerts();
      if (result.total > 0) {
        console.log(`Sent ${result.total} inventory reorder alerts (${result.critical} critical, ${result.normal} normal)`);
      }
    } catch (error) {
      console.error('Error sending inventory reorder alerts:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Optimize inventory levels weekly
  setInterval(async () => {
    try {
      const result = await optimizeInventoryLevels();
      if (result.optimizationsApplied > 0) {
        console.log(`Applied ${result.optimizationsApplied} inventory optimizations (${result.reorderPointsAdjusted} reorder points adjusted)`);
      }
    } catch (error) {
      console.error('Error optimizing inventory levels:', error);
    }
  }, 7 * 24 * 60 * 60 * 1000); // 7 days

  // Send automated follow-up communications every 6 hours
  setInterval(async () => {
    try {
      await sendAutomatedFollowUps();
    } catch (error) {
      console.error('Error sending automated follow-ups:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Process overdue invoices and send reminders daily
  setInterval(async () => {
    try {
      const { processOverdueInvoices } = require('./utils/invoiceService');
      const processedCount = await processOverdueInvoices();
      if (processedCount > 0) {
        console.log(`Processed ${processedCount} overdue invoices`);
      }
    } catch (error) {
      console.error('Error processing overdue invoices:', error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Process auto-rebookings weekly
  setInterval(async () => {
    try {
      const result = await AutoRebookingService.processAutoRebookings();
      if (result.rebooked > 0) {
        console.log(`Auto-rebooked ${result.rebooked} services for ${result.processed} customers`);
      }
    } catch (error) {
      console.error('Error processing auto-rebookings:', error);
    }
  }, 7 * 24 * 60 * 60 * 1000); // 7 days
}

// Function to send automated follow-up communications
async function sendAutomatedFollowUps() {
  try {
    const Booking = require('./models/Booking');
    const { sendTemplateNotification } = require('./utils/notificationService');

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Send 3-day follow-up for completed bookings
    const threeDayBookings = await Booking.find({
      status: 'completed',
      updatedAt: {
        $gte: threeDaysAgo,
        $lt: new Date(now.getTime() - 2.9 * 24 * 60 * 60 * 1000) // Avoid sending multiple times
      }
    }).populate('customerId', 'name email').populate('serviceId', 'name');

    for (const booking of threeDayBookings) {
      if (booking.customerId) {
        try {
          await sendTemplateNotification(booking.customerId._id, 'FOLLOW_UP_3_DAYS', {
            message: `How was your experience with ${booking.serviceId?.name}? We'd love to hear your feedback!`,
            metadata: {
              bookingId: booking._id,
              serviceId: booking.serviceId?._id,
              serviceName: booking.serviceId?.name,
              daysSinceCompletion: 3
            }
          });
          console.log(`Sent 3-day follow-up for booking ${booking._id}`);
        } catch (error) {
          console.error(`Error sending 3-day follow-up for booking ${booking._id}:`, error);
        }
      }
    }

    // Send 7-day follow-up for completed bookings
    const sevenDayBookings = await Booking.find({
      status: 'completed',
      updatedAt: {
        $gte: sevenDaysAgo,
        $lt: new Date(now.getTime() - 6.9 * 24 * 60 * 60 * 1000) // Avoid sending multiple times
      }
    }).populate('customerId', 'name email').populate('serviceId', 'name');

    for (const booking of sevenDayBookings) {
      if (booking.customerId) {
        try {
          await sendTemplateNotification(booking.customerId._id, 'FOLLOW_UP_7_DAYS', {
            message: `Thank you for choosing TRIXTECH! Have you tried our other services?`,
            metadata: {
              bookingId: booking._id,
              serviceId: booking.serviceId?._id,
              serviceName: booking.serviceId?.name,
              daysSinceCompletion: 7
            }
          });
          console.log(`Sent 7-day follow-up for booking ${booking._id}`);
        } catch (error) {
          console.error(`Error sending 7-day follow-up for booking ${booking._id}:`, error);
        }
      }
    }

    console.log(`Follow-up communications sent: ${threeDayBookings.length} (3-day), ${sevenDayBookings.length} (7-day)`);
  } catch (error) {
    console.error('Error in sendAutomatedFollowUps:', error);
  }
}

const PORT = process.env.PORT || 5000;

// Export app for testing
module.exports = app;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
