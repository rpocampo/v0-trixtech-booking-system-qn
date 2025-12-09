const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { sendTemplateNotification } = require('./notificationService');

/**
 * Auto Booking Completion Service
 * Automatically completes confirmed bookings when their booking date has passed
 * Handles all service types (not just rentals)
 */
class AutoBookingCompletionService {
  /**
   * Check if a booking should be auto-completed
   * @param {Object} booking - Booking document
   * @returns {boolean} Whether the booking should be auto-completed
   */
  static shouldAutoComplete(booking) {
    try {
      // Only process confirmed bookings
      if (booking.status !== 'confirmed') {
        return false;
      }

      // Skip if already completed or cancelled
      if (['completed', 'cancelled'].includes(booking.status)) {
        return false;
      }

      const now = new Date();

      // Check if booking date has passed
      if (booking.bookingDate && booking.bookingDate < now) {
        return true;
      }

      // For bookings with delivery time, check if delivery time has passed
      if (booking.deliveryStartTime && booking.deliveryStartTime < now) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking shouldAutoComplete:', error);
      return false;
    }
  }

  /**
   * Complete a booking
   * @param {Object} booking - Booking document
   * @returns {Object} Completion result
   */
  static async completeBooking(booking) {
    try {
      // Update booking status to completed
      booking.status = 'completed';
      booking.completedAt = new Date();

      // If payment was provisional, mark as fully paid
      if (booking.paymentStatus === 'provisionally_paid') {
        booking.paymentStatus = 'paid';
      }

      await booking.save();
      await booking.populate('serviceId');
      await booking.populate('customerId', 'name email');

      // Update payment status if exists
      if (booking.paymentId) {
        const Payment = require('../models/Payment');
        const payment = await Payment.findById(booking.paymentId);
        if (payment && payment.status === 'provisionally_completed') {
          payment.status = 'completed';
          await payment.save();
          console.log(`Payment ${payment._id} marked as fully completed after booking completion`);
        }
      }

      // For equipment/supply rentals, restore inventory
      const service = await Service.findById(booking.serviceId);
      if (service && (service.serviceType === 'equipment' || service.serviceType === 'supply')) {
        await service.restoreBatchQuantity(booking.quantity);
        console.log(`Restored ${booking.quantity} items to inventory for service ${service.name}`);
      }

      // Send completion notification
      await sendTemplateNotification(booking.customerId._id, 'BOOKING_COMPLETED', {
        message: `Your booking for ${service ? service.name : 'service'} has been automatically completed.`,
        metadata: {
          bookingId: booking._id,
          serviceId: booking.serviceId,
          serviceName: service ? service.name : 'Unknown',
          completionDate: new Date(),
          quantity: booking.quantity,
          totalPrice: booking.totalPrice,
          bookingCompleted: true,
          paymentFullyCredited: booking.paymentStatus === 'paid'
        }
      });

      return {
        success: true,
        bookingId: booking._id,
        inventoryRestored: service && (service.serviceType === 'equipment' || service.serviceType === 'supply'),
        notificationSent: true,
        paymentFullyCredited: booking.paymentStatus === 'paid'
      };
    } catch (error) {
      console.error('Error completing booking:', error);
      return {
        success: false,
        bookingId: booking._id,
        error: error.message
      };
    }
  }

  /**
   * Check for bookings due for completion
   * @returns {Array} Array of bookings due for completion
   */
  static async checkForBookingsDueForCompletion() {
    try {
      const bookings = await Booking.find({
        status: 'confirmed'
      }).populate('serviceId').populate('customerId', 'name email');

      const dueForCompletion = [];

      for (const booking of bookings) {
        if (this.shouldAutoComplete(booking)) {
          dueForCompletion.push(booking);
        }
      }

      return dueForCompletion;
    } catch (error) {
      console.error('Error checking for bookings due for completion:', error);
      return [];
    }
  }

  /**
   * Run auto-completion check and process due bookings
   * @returns {Object} Auto-completion results
   */
  static async runAutoCompletionCheck() {
    try {
      console.log(`[${new Date().toISOString()}] Checking for bookings to auto-complete...`);

      const dueBookings = await this.checkForBookingsDueForCompletion();
      console.log(`Found ${dueBookings.length} bookings to auto-complete`);

      const results = {
        processed: dueBookings.length,
        completed: 0,
        inventoryRestored: 0,
        notificationsSent: 0,
        paymentsCredited: 0,
        errors: []
      };

      for (const booking of dueBookings) {
        const result = await this.completeBooking(booking);
        if (result.success) {
          results.completed++;
          if (result.inventoryRestored) results.inventoryRestored++;
          if (result.notificationSent) results.notificationsSent++;
          if (result.paymentFullyCredited) results.paymentsCredited++;
        } else {
          results.errors.push(result.error);
        }
      }

      console.log(`Auto-completion results: ${results.completed}/${results.processed} bookings completed successfully`);
      return results;
    } catch (error) {
      console.error('Error running auto-completion check:', error);
      return {
        processed: 0,
        completed: 0,
        inventoryRestored: 0,
        notificationsSent: 0,
        paymentsCredited: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Get completion statistics
   * @param {Object} options - Options for statistics
   * @returns {Object} Completion statistics
   */
  static async getCompletionStatistics(options = {}) {
    try {
      const { startDate, endDate } = options;
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();

      const completedBookings = await Booking.find({
        status: 'completed',
        updatedAt: { $gte: start, $lte: end }
      }).populate('serviceId', 'name serviceType category');

      const stats = {
        totalCompleted: completedBookings.length,
        byCategory: {},
        byServiceType: {},
        recentCompletions: completedBookings.slice(0, 10).map(booking => ({
          id: booking._id,
          serviceName: booking.serviceId?.name || 'Unknown',
          serviceType: booking.serviceId?.serviceType || 'Unknown',
          category: booking.serviceId?.category || 'Unknown',
          completionDate: booking.updatedAt,
          quantity: booking.quantity,
          totalPrice: booking.totalPrice
        })),
        period: {
          start,
          end
        }
      };

      // Group by category and service type
      completedBookings.forEach(booking => {
        const category = booking.serviceId?.category || 'Unknown';
        const serviceType = booking.serviceId?.serviceType || 'Unknown';

        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        stats.byServiceType[serviceType] = (stats.byServiceType[serviceType] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting completion statistics:', error);
      return {
        totalCompleted: 0,
        byCategory: {},
        byServiceType: {},
        recentCompletions: [],
        period: { start: new Date(), end: new Date() }
      };
    }
  }
}

module.exports = AutoBookingCompletionService;