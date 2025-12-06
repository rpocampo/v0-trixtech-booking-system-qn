const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const { sendTemplateNotification } = require('./notificationService');

/**
 * Auto-rebooking service for recurring services
 * Analyzes customer booking patterns and suggests/creates automatic rebookings
 */
class AutoRebookingService {
  /**
   * Analyze customer booking patterns to identify recurring services
   * @param {string} customerId - Customer ID
   * @returns {Array} Array of recurring service patterns
   */
  static async analyzeRecurringPatterns(customerId) {
    try {
      // Get customer's booking history (last 12 months)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const customerBookings = await Booking.find({
        customerId,
        status: 'confirmed',
        createdAt: { $gte: oneYearAgo }
      }).populate('serviceId').sort({ createdAt: -1 });

      if (customerBookings.length < 2) {
        return []; // Need at least 2 bookings to identify patterns
      }

      // Group bookings by service
      const serviceGroups = {};
      customerBookings.forEach(booking => {
        const serviceId = booking.serviceId._id.toString();
        if (!serviceGroups[serviceId]) {
          serviceGroups[serviceId] = {
            service: booking.serviceId,
            bookings: [],
            intervals: []
          };
        }
        serviceGroups[serviceId].bookings.push(booking);
      });

      // Analyze patterns for each service
      const recurringPatterns = [];

      for (const [serviceId, group] of Object.entries(serviceGroups)) {
        const pattern = this.analyzeServicePattern(group);
        if (pattern && pattern.confidence > 0.6) { // Only consider high-confidence patterns
          recurringPatterns.push(pattern);
        }
      }

      return recurringPatterns.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error analyzing recurring patterns:', error);
      return [];
    }
  }

  /**
   * Analyze booking pattern for a specific service
   */
  static analyzeServicePattern(serviceGroup) {
    const { service, bookings } = serviceGroup;

    if (bookings.length < 2) return null;

    // Sort bookings by date
    const sortedBookings = bookings.sort((a, b) => new Date(a.bookingDate) - new Date(b.bookingDate));

    // Calculate intervals between bookings
    const intervals = [];
    for (let i = 1; i < sortedBookings.length; i++) {
      const prevDate = new Date(sortedBookings[i-1].bookingDate);
      const currDate = new Date(sortedBookings[i].bookingDate);
      const intervalDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
      intervals.push(intervalDays);
    }

    if (intervals.length === 0) return null;

    // Calculate average interval and consistency
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 1 - (stdDev / avgInterval)); // Higher is more consistent

    // Determine pattern type
    let patternType = 'irregular';
    let nextBookingDate = null;

    if (consistency > 0.7) {
      if (avgInterval <= 7) {
        patternType = 'weekly';
        nextBookingDate = new Date(sortedBookings[sortedBookings.length - 1].bookingDate);
        nextBookingDate.setDate(nextBookingDate.getDate() + 7);
      } else if (avgInterval <= 31) {
        patternType = 'monthly';
        nextBookingDate = new Date(sortedBookings[sortedBookings.length - 1].bookingDate);
        nextBookingDate.setMonth(nextBookingDate.getMonth() + 1);
      } else if (avgInterval <= 93) { // ~3 months
        patternType = 'quarterly';
        nextBookingDate = new Date(sortedBookings[sortedBookings.length - 1].bookingDate);
        nextBookingDate.setMonth(nextBookingDate.getMonth() + 3);
      } else if (avgInterval <= 183) { // ~6 months
        patternType = 'biannual';
        nextBookingDate = new Date(sortedBookings[sortedBookings.length - 1].bookingDate);
        nextBookingDate.setMonth(nextBookingDate.getMonth() + 6);
      } else {
        patternType = 'annual';
        nextBookingDate = new Date(sortedBookings[sortedBookings.length - 1].bookingDate);
        nextBookingDate.setFullYear(nextBookingDate.getFullYear() + 1);
      }
    }

    // Calculate confidence based on multiple factors
    const recencyWeight = this.calculateRecencyWeight(sortedBookings);
    const frequencyWeight = Math.min(1, sortedBookings.length / 4); // More bookings = higher confidence
    const consistencyWeight = consistency;

    const confidence = (recencyWeight * 0.3 + frequencyWeight * 0.3 + consistencyWeight * 0.4);

    return {
      serviceId: service._id,
      serviceName: service.name,
      serviceCategory: service.category,
      patternType,
      avgInterval: Math.round(avgInterval),
      consistency,
      confidence,
      bookingCount: sortedBookings.length,
      lastBookingDate: sortedBookings[sortedBookings.length - 1].bookingDate,
      nextSuggestedDate: nextBookingDate,
      intervals
    };
  }

  /**
   * Calculate recency weight (more recent patterns are more reliable)
   */
  static calculateRecencyWeight(bookings) {
    const now = new Date();
    const lastBooking = new Date(bookings[bookings.length - 1].bookingDate);
    const daysSinceLastBooking = (now - lastBooking) / (1000 * 60 * 60 * 24);

    // Weight decreases as time since last booking increases
    if (daysSinceLastBooking <= 30) return 1.0;
    if (daysSinceLastBooking <= 60) return 0.8;
    if (daysSinceLastBooking <= 90) return 0.6;
    if (daysSinceLastBooking <= 180) return 0.4;
    return 0.2;
  }

  /**
   * Generate auto-rebooking suggestions for a customer
   * @param {string} customerId - Customer ID
   * @returns {Array} Array of rebooking suggestions
   */
  static async generateRebookingSuggestions(customerId) {
    try {
      const patterns = await this.analyzeRecurringPatterns(customerId);

      const suggestions = [];

      for (const pattern of patterns) {
        // Check if next suggested date is in the future and within reasonable range
        const now = new Date();
        const daysUntilNext = pattern.nextSuggestedDate
          ? (pattern.nextSuggestedDate - now) / (1000 * 60 * 60 * 24)
          : null;

        if (daysUntilNext && daysUntilNext > 0 && daysUntilNext <= 90) { // Within 3 months
          // Check if service is still available
          const service = await Service.findById(pattern.serviceId);
          if (service && service.isActive !== false) {
            suggestions.push({
              serviceId: pattern.serviceId,
              serviceName: pattern.serviceName,
              serviceCategory: pattern.serviceCategory,
              patternType: pattern.patternType,
              confidence: pattern.confidence,
              suggestedDate: pattern.nextSuggestedDate,
              daysUntilBooking: Math.round(daysUntilNext),
              reason: this.generateSuggestionReason(pattern),
              autoRebookEligible: pattern.confidence > 0.8 && pattern.bookingCount >= 3
            });
          }
        }
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error generating rebooking suggestions:', error);
      return [];
    }
  }

  /**
   * Generate human-readable reason for the suggestion
   */
  static generateSuggestionReason(pattern) {
    const reasons = [];

    if (pattern.patternType !== 'irregular') {
      reasons.push(`You typically book this ${pattern.patternType}`);
    }

    if (pattern.consistency > 0.8) {
      reasons.push('Very consistent booking pattern');
    } else if (pattern.consistency > 0.6) {
      reasons.push('Consistent booking pattern');
    }

    if (pattern.bookingCount >= 5) {
      reasons.push(`Booked ${pattern.bookingCount} times`);
    }

    return reasons.join(', ');
  }

  /**
   * Create automatic rebooking for eligible customers
   * @param {string} customerId - Customer ID
   * @param {string} serviceId - Service ID
   * @param {Date} bookingDate - Suggested booking date
   * @returns {Object} Rebooking result
   */
  static async createAutoRebooking(customerId, serviceId, bookingDate) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Check customer preferences for auto-rebooking
      const preferences = await UserPreferences.findOne({ userId: customerId });
      if (!preferences || !preferences.autoRebookingEnabled) {
        throw new Error('Auto-rebooking not enabled for this customer');
      }

      // Check availability
      const availabilityCheck = await this.checkAvailabilityForAutoRebooking(serviceId, bookingDate);
      if (!availabilityCheck.available) {
        throw new Error('Service not available for auto-rebooking');
      }

      // Create the booking
      const bookingData = {
        customerId,
        serviceId,
        quantity: 1, // Default quantity, could be learned from patterns
        bookingDate,
        totalPrice: service.basePrice, // Could use dynamic pricing
        status: 'confirmed', // Auto-confirmed since it's recurring
        paymentStatus: 'pending', // Will need payment
        notes: 'Auto-rebooked based on recurring pattern',
        autoRebooked: true,
        rebookingReason: 'Recurring service pattern detected'
      };

      const booking = new Booking(bookingData);
      await booking.save();

      // Send notification
      await sendTemplateNotification(customerId, 'AUTO_REBOOKING_CREATED', {
        message: `We've automatically reserved ${service.name} for you based on your reservation pattern.`,
        metadata: {
          bookingId: booking._id,
          serviceId: service._id,
          bookingDate: bookingDate,
          autoRebooked: true
        }
      });

      return {
        success: true,
        booking,
        message: 'Auto-rebooking created successfully'
      };
    } catch (error) {
      console.error('Error creating auto-rebooking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check availability for auto-rebooking
   */
  static async checkAvailabilityForAutoRebooking(serviceId, bookingDate) {
    try {
      // Simple availability check - could be enhanced
      const existingBooking = await Booking.findOne({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
          $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
        },
        status: { $in: ['confirmed', 'pending'] }
      });

      return {
        available: !existingBooking,
        conflictingBooking: existingBooking
      };
    } catch (error) {
      console.error('Error checking availability for auto-rebooking:', error);
      return { available: false };
    }
  }

  /**
   * Process auto-rebookings for all eligible customers (run as scheduled job)
   */
  static async processAutoRebookings() {
    try {
      console.log('Starting auto-rebooking process...');

      // Get all customers with auto-rebooking enabled
      const customersWithAutoRebooking = await UserPreferences.find({
        autoRebookingEnabled: true
      });

      let totalProcessed = 0;
      let totalRebooked = 0;

      for (const prefs of customersWithAutoRebooking) {
        try {
          const suggestions = await this.generateRebookingSuggestions(prefs.userId);

          for (const suggestion of suggestions) {
            if (suggestion.autoRebookEligible && suggestion.daysUntilBooking <= 7) { // Within a week
              const result = await this.createAutoRebooking(
                prefs.userId,
                suggestion.serviceId,
                suggestion.suggestedDate
              );

              if (result.success) {
                totalRebooked++;
              }
            }
          }

          totalProcessed++;
        } catch (error) {
          console.error(`Error processing auto-rebooking for customer ${prefs.userId}:`, error);
        }
      }

      console.log(`Auto-rebooking process completed: ${totalRebooked} rebookings created for ${totalProcessed} customers`);

      return {
        processed: totalProcessed,
        rebooked: totalRebooked
      };
    } catch (error) {
      console.error('Error in auto-rebooking process:', error);
      throw error;
    }
  }

  /**
   * Get customer's auto-rebooking preferences and status
   */
  static async getCustomerRebookingStatus(customerId) {
    try {
      const preferences = await UserPreferences.findOne({ userId: customerId });
      const suggestions = await this.generateRebookingSuggestions(customerId);

      return {
        autoRebookingEnabled: preferences?.autoRebookingEnabled || false,
        suggestions: suggestions.slice(0, 5), // Top 5 suggestions
        totalPatterns: suggestions.length
      };
    } catch (error) {
      console.error('Error getting customer rebooking status:', error);
      return {
        autoRebookingEnabled: false,
        suggestions: [],
        totalPatterns: 0
      };
    }
  }

  /**
   * Update customer's auto-rebooking preferences
   */
  static async updateAutoRebookingPreferences(customerId, enabled, servicePreferences = {}) {
    try {
      let preferences = await UserPreferences.findOne({ userId: customerId });

      if (!preferences) {
        preferences = new UserPreferences({ userId: customerId });
      }

      preferences.autoRebookingEnabled = enabled;
      preferences.serviceRebookingPreferences = servicePreferences;

      await preferences.save();

      return {
        success: true,
        preferences
      };
    } catch (error) {
      console.error('Error updating auto-rebooking preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AutoRebookingService;