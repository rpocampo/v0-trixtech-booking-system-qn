const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const ReservationQueue = require('../models/ReservationQueue');
const { sendTemplateNotification } = require('./notificationService');
const { findAlternativeServices } = require('./recommendationService');

/**
 * Auto-recovery service for failed bookings
 * Automatically provides alternatives and recovery options when bookings fail
 */
class AutoRecoveryService {
  /**
   * Analyze failed booking and generate recovery options
   * @param {string} bookingId - Failed booking ID
   * @param {string} failureReason - Reason for failure
   * @returns {Object} Recovery options
   */
  static async analyzeFailedBooking(bookingId, failureReason = 'unknown') {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('serviceId')
        .populate('customerId', 'name email');

      if (!booking) {
        throw new Error('Booking not found');
      }

      const recoveryOptions = {
        bookingId,
        customerId: booking.customerId._id,
        originalService: booking.serviceId,
        failureReason,
        alternatives: [],
        suggestions: [],
        urgency: this.calculateUrgency(booking),
        autoRecoveryPossible: false
      };

      // Generate alternative services
      const alternatives = await findAlternativeServices(
        booking.serviceId._id,
        booking.bookingDate,
        booking.quantity
      );

      recoveryOptions.alternatives = alternatives.slice(0, 5);

      // Generate time-based alternatives (different dates/times)
      const timeAlternatives = await this.generateTimeAlternatives(
        booking.serviceId._id,
        booking.bookingDate,
        booking.quantity
      );

      recoveryOptions.suggestions = [
        ...recoveryOptions.alternatives,
        ...timeAlternatives
      ];

      // Check if auto-recovery is possible
      recoveryOptions.autoRecoveryPossible = this.canAutoRecover(
        booking,
        recoveryOptions.suggestions
      );

      return recoveryOptions;
    } catch (error) {
      console.error('Error analyzing failed booking:', error);
      return {
        bookingId,
        alternatives: [],
        suggestions: [],
        urgency: 'low',
        autoRecoveryPossible: false,
        error: error.message
      };
    }
  }

  /**
   * Generate alternative time slots for the same service
   */
  static async generateTimeAlternatives(serviceId, originalDate, quantity) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) return [];

      const alternatives = [];
      const originalDateTime = new Date(originalDate);

      // Check next 7 days for availability
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const checkDate = new Date(originalDateTime);
        checkDate.setDate(checkDate.getDate() + dayOffset);

        // Check different time slots
        const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

        for (const timeSlot of timeSlots) {
          const dateTimeString = `${checkDate.toISOString().split('T')[0]}T${timeSlot}`;
          const checkDateTime = new Date(dateTimeString);

          // Simple availability check (could be enhanced)
          const existingBookings = await Booking.find({
            serviceId,
            bookingDate: {
              $gte: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate()),
              $lt: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() + 1)
            },
            status: { $in: ['confirmed', 'pending'] }
          });

          const isAvailable = service.category === 'equipment'
            ? existingBookings.reduce((sum, b) => sum + b.quantity, 0) + quantity <= (service.quantity || 1)
            : existingBookings.length === 0;

          if (isAvailable) {
            alternatives.push({
              type: 'time_alternative',
              serviceId,
              serviceName: service.name,
              suggestedDate: checkDateTime,
              quantity,
              reason: `Available ${dayOffset} day${dayOffset > 1 ? 's' : ''} later at ${timeSlot}`,
              confidence: Math.max(0.3, 1 - (dayOffset * 0.1)), // Lower confidence for later dates
              availability: 'available'
            });

            if (alternatives.length >= 3) break; // Limit to 3 time alternatives
          }
        }

        if (alternatives.length >= 3) break;
      }

      return alternatives;
    } catch (error) {
      console.error('Error generating time alternatives:', error);
      return [];
    }
  }

  /**
   * Calculate urgency level for recovery
   */
  static calculateUrgency(booking) {
    const now = new Date();
    const bookingDate = new Date(booking.bookingDate);
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24) return 'critical'; // Less than 24 hours
    if (hoursUntilBooking < 72) return 'high'; // Less than 3 days
    if (hoursUntilBooking < 168) return 'medium'; // Less than 1 week
    return 'low'; // More than 1 week
  }

  /**
   * Check if auto-recovery is possible
   */
  static canAutoRecover(booking, suggestions) {
    // Auto-recovery criteria
    const bookingDate = new Date(booking.bookingDate);
    const now = new Date();
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60);

    // Only auto-recover if booking is more than 24 hours away
    if (hoursUntilBooking < 24) return false;

    // Check if there are good alternatives available
    const goodAlternatives = suggestions.filter(alt =>
      alt.confidence > 0.7 && alt.availability === 'available'
    );

    return goodAlternatives.length > 0;
  }

  /**
   * Execute auto-recovery for a failed booking
   * @param {string} bookingId - Failed booking ID
   * @param {Object} recoveryOptions - Recovery options
   * @returns {Object} Recovery result
   */
  static async executeAutoRecovery(bookingId, recoveryOptions) {
    try {
      if (!recoveryOptions.autoRecoveryPossible) {
        throw new Error('Auto-recovery not possible for this booking');
      }

      // Find the best alternative
      const bestAlternative = recoveryOptions.suggestions
        .filter(alt => alt.confidence > 0.7 && alt.availability === 'available')
        .sort((a, b) => b.confidence - a.confidence)[0];

      if (!bestAlternative) {
        throw new Error('No suitable alternative found for auto-recovery');
      }

      // Create new booking with alternative
      const originalBooking = await Booking.findById(bookingId);
      if (!originalBooking) {
        throw new Error('Original booking not found');
      }

      const recoveryBooking = new Booking({
        customerId: originalBooking.customerId,
        serviceId: bestAlternative.serviceId,
        quantity: bestAlternative.quantity,
        bookingDate: bestAlternative.suggestedDate,
        totalPrice: originalBooking.totalPrice, // Keep same price for recovery
        status: 'confirmed', // Auto-confirmed for recovery
        paymentStatus: 'paid', // Assume payment is carried over
        paymentId: originalBooking.paymentId,
        notes: `Auto-recovered booking. Original booking ${bookingId} failed.`,
        autoRecovered: true,
        recoveryReason: bestAlternative.reason,
        originalBookingId: bookingId
      });

      await recoveryBooking.save();

      // Update original booking
      originalBooking.status = 'failed_recovered';
      originalBooking.recoveryBookingId = recoveryBooking._id;
      originalBooking.recoveryDetails = {
        autoRecovered: true,
        alternativeService: bestAlternative.serviceName,
        alternativeDate: bestAlternative.suggestedDate,
        recoveryReason: bestAlternative.reason
      };
      await originalBooking.save();

      // Send recovery notification
      await sendTemplateNotification(originalBooking.customerId, 'BOOKING_AUTO_RECOVERED', {
        message: `We've automatically recovered your booking! ${bestAlternative.serviceName} is now confirmed.`,
        metadata: {
          originalBookingId: bookingId,
          recoveryBookingId: recoveryBooking._id,
          serviceName: bestAlternative.serviceName,
          bookingDate: bestAlternative.suggestedDate,
          recoveryReason: bestAlternative.reason,
          autoRecovered: true
        }
      });

      return {
        success: true,
        recoveryBooking,
        alternative: bestAlternative,
        message: 'Booking automatically recovered with alternative option'
      };

    } catch (error) {
      console.error('Error executing auto-recovery:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send recovery suggestions to customer
   * @param {string} customerId - Customer ID
   * @param {Object} recoveryOptions - Recovery options
   * @returns {Object} Notification result
   */
  static async sendRecoverySuggestions(customerId, recoveryOptions) {
    try {
      const customer = await User.findById(customerId);
      if (!customer) return { success: false, error: 'Customer not found' };

      const suggestionsText = recoveryOptions.suggestions
        .slice(0, 3)
        .map((suggestion, index) =>
          `${index + 1}. ${suggestion.serviceName} - ${suggestion.reason}`
        )
        .join('\n');

      await sendTemplateNotification(customerId, 'BOOKING_RECOVERY_SUGGESTIONS', {
        message: `We're sorry, but your booking couldn't be confirmed. Here are some alternatives:`,
        metadata: {
          bookingId: recoveryOptions.bookingId,
          suggestions: recoveryOptions.suggestions.slice(0, 3),
          suggestionsText,
          urgency: recoveryOptions.urgency,
          autoRecoveryPossible: recoveryOptions.autoRecoveryPossible
        }
      });

      return {
        success: true,
        suggestionsSent: recoveryOptions.suggestions.length,
        message: 'Recovery suggestions sent to customer'
      };

    } catch (error) {
      console.error('Error sending recovery suggestions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process failed bookings and attempt recovery
   * @param {Array} failedBookings - Array of failed booking IDs
   * @returns {Object} Processing result
   */
  static async processFailedBookings(failedBookings) {
    try {
      const results = {
        processed: 0,
        autoRecovered: 0,
        suggestionsSent: 0,
        failed: 0
      };

      for (const bookingId of failedBookings) {
        try {
          results.processed++;

          // Analyze the failed booking
          const recoveryOptions = await this.analyzeFailedBooking(bookingId, 'availability_conflict');

          if (recoveryOptions.autoRecoveryPossible) {
            // Attempt auto-recovery
            const recoveryResult = await this.executeAutoRecovery(bookingId, recoveryOptions);
            if (recoveryResult.success) {
              results.autoRecovered++;
              continue;
            }
          }

          // Send recovery suggestions
          const suggestionResult = await this.sendRecoverySuggestions(
            recoveryOptions.customerId,
            recoveryOptions
          );

          if (suggestionResult.success) {
            results.suggestionsSent++;
          } else {
            results.failed++;
          }

        } catch (error) {
          console.error(`Error processing failed booking ${bookingId}:`, error);
          results.failed++;
        }
      }

      console.log(`Failed booking recovery processed: ${results.processed} total, ${results.autoRecovered} auto-recovered, ${results.suggestionsSent} suggestions sent`);

      return results;

    } catch (error) {
      console.error('Error in processFailedBookings:', error);
      throw error;
    }
  }

  /**
   * Monitor and recover bookings that fail during creation
   * @param {Object} bookingData - Failed booking data
   * @param {string} failureReason - Reason for failure
   * @returns {Object} Recovery result
   */
  static async handleBookingFailure(bookingData, failureReason = 'unknown') {
    try {
      // Create a temporary failed booking record for tracking
      const failedBooking = new Booking({
        ...bookingData,
        status: 'failed',
        failureReason,
        createdAt: new Date()
      });

      await failedBooking.save();

      // Analyze and attempt recovery
      const recoveryOptions = await this.analyzeFailedBooking(failedBooking._id, failureReason);

      let recoveryResult = null;

      if (recoveryOptions.autoRecoveryPossible) {
        recoveryResult = await this.executeAutoRecovery(failedBooking._id, recoveryOptions);
      }

      if (!recoveryResult || !recoveryResult.success) {
        // Send suggestions if auto-recovery failed
        await this.sendRecoverySuggestions(bookingData.customerId, recoveryOptions);
      }

      return {
        failedBookingId: failedBooking._id,
        recoveryOptions,
        recoveryResult,
        suggestionsSent: !recoveryResult || !recoveryResult.success
      };

    } catch (error) {
      console.error('Error handling booking failure:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get recovery statistics for a customer
   * @param {string} customerId - Customer ID
   * @returns {Object} Recovery statistics
   */
  static async getRecoveryStatistics(customerId) {
    try {
      const failedBookings = await Booking.find({
        customerId,
        status: { $in: ['failed', 'failed_recovered'] }
      });

      const recoveredBookings = failedBookings.filter(b => b.status === 'failed_recovered');
      const unrecoveredBookings = failedBookings.filter(b => b.status === 'failed');

      return {
        totalFailedBookings: failedBookings.length,
        recoveredBookings: recoveredBookings.length,
        unrecoveredBookings: unrecoveredBookings.length,
        recoveryRate: failedBookings.length > 0
          ? (recoveredBookings.length / failedBookings.length * 100).toFixed(1)
          : 0,
        recentFailures: failedBookings.slice(0, 5).map(b => ({
          id: b._id,
          serviceName: b.serviceId?.name || 'Unknown',
          bookingDate: b.bookingDate,
          failureReason: b.failureReason,
          recovered: b.status === 'failed_recovered'
        }))
      };

    } catch (error) {
      console.error('Error getting recovery statistics:', error);
      return {
        totalFailedBookings: 0,
        recoveredBookings: 0,
        unrecoveredBookings: 0,
        recoveryRate: 0,
        recentFailures: []
      };
    }
  }

  /**
   * Clean up old failed booking records
   * @param {number} daysOld - Remove records older than this many days
   * @returns {Object} Cleanup result
   */
  static async cleanupOldFailedBookings(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldFailedBookings = await Booking.find({
        status: 'failed',
        createdAt: { $lt: cutoffDate }
      });

      const deletedCount = await Booking.deleteMany({
        status: 'failed',
        createdAt: { $lt: cutoffDate }
      });

      console.log(`Cleaned up ${deletedCount.deletedCount} old failed booking records`);

      return {
        cleaned: deletedCount.deletedCount,
        cutoffDate
      };

    } catch (error) {
      console.error('Error cleaning up old failed bookings:', error);
      throw error;
    }
  }
}

module.exports = AutoRecoveryService;