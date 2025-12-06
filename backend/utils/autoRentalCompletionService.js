const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { sendTemplateNotification } = require('./notificationService');

/**
 * Auto Rental Completion Service
 * Automatically completes rentals when pick-up date/time has passed or marked as finished
 * Restores inventory availability after completion
 */
class AutoRentalCompletionService {
  /**
   * Check if a booking should be auto-completed
   * @param {Object} booking - Booking document
   * @returns {boolean} Whether the booking should be auto-completed
   */
  static shouldAutoComplete(booking) {
    try {
      // Only process confirmed rentals (equipment and supplies)
      if (booking.status !== 'confirmed') {
        return false;
      }

      // Check if service is a rental (equipment or supply)
      const service = booking.serviceId;
      if (!service || (service.serviceType !== 'equipment' && service.serviceType !== 'supply')) {
        return false;
      }

      const now = new Date();

      // Check if pick-up time has passed
      if (booking.deliveryStartTime && booking.deliveryStartTime < now) {
        return true;
      }

      // Check if booking date + duration has passed (fallback for rentals without delivery time)
      if (booking.bookingDate && booking.duration) {
        const endDate = new Date(booking.bookingDate);
        endDate.setDate(endDate.getDate() + booking.duration);
        if (endDate < now) {
          return true;
        }
      }

      // Check if marked as finished (could be a custom field, for now assume based on notes)
      if (booking.notes && booking.notes.toLowerCase().includes('finished')) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking shouldAutoComplete:', error);
      return false;
    }
  }

  /**
   * Complete a rental booking
   * @param {Object} booking - Booking document
   * @returns {Object} Completion result
   */
  static async completeRental(booking) {
    try {
      // Update booking status to completed
      booking.status = 'completed';
      // Now that rental is completed, mark payment as fully paid
      if (booking.paymentStatus === 'provisionally_paid') {
        booking.paymentStatus = 'paid';
      }
      await booking.save();

      // Update payment status to fully completed if it was provisionally completed
      if (booking.paymentId) {
        const Payment = require('../models/Payment');
        const payment = await Payment.findById(booking.paymentId);
        if (payment && payment.status === 'provisionally_completed') {
          payment.status = 'completed';
          await payment.save();
          console.log(`Payment ${payment._id} marked as fully completed after rental completion`);
        }
      }

      // Restore inventory
      const service = await Service.findById(booking.serviceId);
      if (service && (service.serviceType === 'equipment' || service.serviceType === 'supply')) {
        await service.restoreBatchQuantity(booking.quantity);
      }

      // Send notification
      await sendTemplateNotification(booking.customerId, 'BOOKING_COMPLETED', {
        message: `Your rental for ${service ? service.name : 'equipment'} has been completed and items have been returned to inventory.`,
        metadata: {
          bookingId: booking._id,
          serviceId: booking.serviceId,
          serviceName: service ? service.name : 'Unknown',
          completionDate: new Date(),
          quantity: booking.quantity,
          inventoryRestored: true,
          rentalCompleted: true,
          paymentFullyCredited: true
        }
      });

      return {
        success: true,
        bookingId: booking._id,
        inventoryRestored: true,
        notificationSent: true,
        paymentFullyCredited: true
      };
    } catch (error) {
      console.error('Error completing rental:', error);
      return {
        success: false,
        bookingId: booking._id,
        error: error.message
      };
    }
  }

  /**
   * Check for rentals due for completion
   * @returns {Array} Array of bookings due for completion
   */
  static async checkForRentalsDueForCompletion() {
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
      console.error('Error checking for rentals due for completion:', error);
      return [];
    }
  }

  /**
   * Run auto-completion check and process due rentals
   * @returns {Object} Auto-completion results
   */
  static async runAutoCompletionCheck() {
    try {
      console.log(`[${new Date().toISOString()}] Checking for rentals to auto-complete...`);

      const dueBookings = await this.checkForRentalsDueForCompletion();
      console.log(`Found ${dueBookings.length} rentals to auto-complete`);

      const results = {
        processed: dueBookings.length,
        completed: 0,
        inventoryRestored: 0,
        notificationsSent: 0,
        errors: []
      };

      for (const booking of dueBookings) {
        const result = await this.completeRental(booking);
        if (result.success) {
          results.completed++;
          if (result.inventoryRestored) results.inventoryRestored++;
          if (result.notificationSent) results.notificationsSent++;
        } else {
          results.errors.push(result.error);
        }
      }

      console.log(`Auto-completion results: ${results.completed}/${results.processed} rentals completed successfully`);
      return results;
    } catch (error) {
      console.error('Error running auto-completion check:', error);
      return {
        processed: 0,
        completed: 0,
        inventoryRestored: 0,
        notificationsSent: 0,
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

      const completedRentals = await Booking.find({
        status: 'completed',
        updatedAt: { $gte: start, $lte: end }
      }).populate('serviceId', 'name serviceType category');

      const stats = {
        totalCompleted: completedRentals.length,
        byCategory: {},
        byService: {},
        recentCompletions: completedRentals.slice(0, 10).map(booking => ({
          id: booking._id,
          serviceName: booking.serviceId?.name || 'Unknown',
          serviceType: booking.serviceId?.serviceType || 'Unknown',
          category: booking.serviceId?.category || 'Unknown',
          completionDate: booking.updatedAt,
          quantity: booking.quantity
        })),
        period: {
          start,
          end
        }
      };

      // Group by category and service
      completedRentals.forEach(booking => {
        const category = booking.serviceId?.category || 'Unknown';
        const serviceType = booking.serviceId?.serviceType || 'Unknown';

        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        stats.byService[serviceType] = (stats.byService[serviceType] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting completion statistics:', error);
      return {
        totalCompleted: 0,
        byCategory: {},
        byService: {},
        recentCompletions: [],
        period: { start: new Date(), end: new Date() }
      };
    }
  }
}

module.exports = AutoRentalCompletionService;