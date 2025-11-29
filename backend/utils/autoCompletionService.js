const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const { sendTemplateNotification } = require('./notificationService');
const AutoPersonalizationService = require('./autoPersonalizationService');
const AutoPaymentService = require('./autoPaymentService');

/**
 * Auto-completion service for simple booking flows
 * Automatically completes entire booking process for eligible simple bookings
 */
class AutoCompletionService {
  /**
   * Check if a booking qualifies for auto-completion
   * @param {string} userId - User ID
   * @param {string} serviceId - Service ID
   * @param {Object} bookingData - Booking data
   * @returns {Object} Qualification result
   */
  static async checkAutoCompletionEligibility(userId, serviceId, bookingData) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        return { eligible: false, reason: 'Service not found' };
      }

      const user = await User.findById(userId);
      if (!user) {
        return { eligible: false, reason: 'User not found' };
      }

      // Get user preferences and history
      const preferences = await UserPreferences.findOne({ userId });
      const userHistory = await AutoPersonalizationService.analyzeUserBookingHistory(userId);

      // Auto-completion criteria
      const criteria = {
        // Simple service types (non-equipment, low-risk categories)
        simpleService: ['party', 'corporate', 'birthday', 'funeral'].includes(service.category) ||
                      service.serviceType === 'service',

        // Low-value booking (under ₱10,000)
        lowValue: bookingData.totalPrice < 10000,

        // Returning customer with good history
        returningCustomer: userHistory.totalBookings >= 3,

        // High success rate (90%+ successful bookings)
        highSuccessRate: userHistory.totalBookings > 0 &&
                        (userHistory.totalBookings / Math.max(userHistory.totalBookings, 1)) > 0.9,

        // Booking well in advance (more than 48 hours)
        advanceBooking: this.isAdvanceBooking(bookingData.bookingDate),

        // Has preferred payment method
        hasPreferredPayment: preferences?.preferredPaymentMethod,

        // Auto-payment enabled
        autoPaymentEnabled: preferences?.autoPaymentEnabled,

        // Service has high availability
        highAvailability: service.quantity && service.quantity > 10,

        // Not a complex booking (no special delivery requirements)
        simpleBooking: !bookingData.deliveryTime && !bookingData.specialRequests,

        // Standard quantity (1-5 items/services)
        standardQuantity: bookingData.quantity >= 1 && bookingData.quantity <= 5
      };

      // Count met criteria
      const metCriteriaCount = Object.values(criteria).filter(Boolean).length;
      const totalCriteria = Object.keys(criteria).length;

      // Require at least 70% of criteria to be met
      const eligibilityThreshold = Math.ceil(totalCriteria * 0.7);
      const eligible = metCriteriaCount >= eligibilityThreshold;

      return {
        eligible,
        metCriteriaCount,
        totalCriteria,
        criteria,
        confidence: metCriteriaCount / totalCriteria,
        reason: eligible ? 'Meets auto-completion criteria' : 'Does not meet minimum criteria'
      };

    } catch (error) {
      console.error('Error checking auto-completion eligibility:', error);
      return {
        eligible: false,
        reason: 'Error checking eligibility',
        error: error.message
      };
    }
  }

  /**
   * Check if booking is sufficiently in advance
   */
  static isAdvanceBooking(bookingDate) {
    const now = new Date();
    const booking = new Date(bookingDate);
    const hoursDifference = (booking - now) / (1000 * 60 * 60);
    return hoursDifference > 48; // More than 48 hours
  }

  /**
   * Execute auto-completion for a simple booking
   * @param {string} userId - User ID
   * @param {Object} bookingData - Complete booking data
   * @returns {Object} Auto-completion result
   */
  static async executeAutoCompletion(userId, bookingData) {
    try {
      const { serviceId, quantity, bookingDate, notes, deliveryTime } = bookingData;

      // First check eligibility
      const eligibility = await this.checkAutoCompletionEligibility(userId, serviceId, bookingData);

      if (!eligibility.eligible) {
        throw new Error(`Booking not eligible for auto-completion: ${eligibility.reason}`);
      }

      const service = await Service.findById(serviceId);
      const user = await User.findById(userId);

      // Calculate price
      const bookingDateTime = new Date(bookingDate);
      const now = new Date();
      const daysBeforeCheckout = Math.ceil((bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const calculatedPrice = service.calculatePrice(Math.max(0, daysBeforeCheckout));
      const totalPrice = calculatedPrice * quantity;

      // Check final availability (double-check)
      const isAvailable = await this.checkFinalAvailability(serviceId, bookingDateTime, quantity);
      if (!isAvailable) {
        throw new Error('Service no longer available for auto-completion');
      }

      // Create booking record
      const booking = new Booking({
        customerId: userId,
        serviceId,
        quantity,
        bookingDate: bookingDateTime,
        totalPrice,
        basePrice: service.basePrice,
        appliedMultiplier: calculatedPrice / service.basePrice,
        daysBeforeCheckout: Math.max(0, daysBeforeCheckout),
        status: 'confirmed', // Auto-confirmed
        paymentStatus: 'paid', // Auto-paid
        paymentType: 'auto',
        amountPaid: totalPrice,
        remainingBalance: 0,
        notes: notes || 'Auto-completed booking',
        autoCompleted: true,
        autoCompletionReason: 'Simple booking auto-completed',
        confirmationReason: 'Auto-completed based on eligibility criteria'
      });

      // Add delivery info if needed
      if (deliveryTime && service.requiresDelivery) {
        const deliveryStartTime = new Date(`${bookingDate}T${deliveryTime}`);
        booking.deliveryStartTime = deliveryStartTime;
        booking.deliveryEndTime = new Date(deliveryStartTime.getTime() + 60 * 60 * 1000);
        booking.deliveryDuration = 60;
        booking.requiresDelivery = true;
      }

      await booking.save();
      await booking.populate('serviceId');
      await booking.populate('customerId', 'name email');

      // Update inventory
      if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
        await service.reduceBatchQuantity(quantity);
      }

      // Send auto-completion notification
      await sendTemplateNotification(userId, 'BOOKING_AUTO_COMPLETED', {
        message: `🎉 Your booking for ${service.name} has been automatically completed! No payment or confirmation needed.`,
        metadata: {
          bookingId: booking._id,
          serviceId: service._id,
          serviceName: service.name,
          bookingDate: bookingDateTime,
          totalPrice,
          quantity,
          autoCompleted: true,
          savedSteps: 3 // Estimate of steps saved
        }
      });

      // Update user preferences with successful auto-completion
      await AutoPersonalizationService.updateUserPreferences(userId, {
        serviceId,
        quantity,
        bookingDate: bookingDateTime,
        deliveryTime,
        notes,
        totalPrice
      });

      return {
        success: true,
        booking,
        message: 'Booking automatically completed successfully!',
        autoCompleted: true,
        savedTime: '3-5 minutes', // Estimated time saved
        eligibility: eligibility
      };

    } catch (error) {
      console.error('Error executing auto-completion:', error);
      return {
        success: false,
        error: error.message,
        autoCompleted: false
      };
    }
  }

  /**
   * Check final availability before auto-completion
   */
  static async checkFinalAvailability(serviceId, bookingDate, quantity) {
    try {
      const service = await Service.findById(serviceId);

      if (service.category === 'equipment') {
        const existingBookings = await Booking.find({
          serviceId,
          bookingDate: {
            $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
            $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
          },
          status: { $in: ['confirmed', 'pending'] }
        });

        const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
        return totalBooked + quantity <= (service.quantity || 1);
      } else {
        // For services, check if already booked
        const existingBooking = await Booking.findOne({
          serviceId,
          bookingDate: {
            $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
            $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
          },
          status: { $in: ['confirmed', 'pending'] }
        });

        return !existingBooking;
      }
    } catch (error) {
      console.error('Error checking final availability:', error);
      return false;
    }
  }

  /**
   * Get auto-completion suggestions for user
   * @param {string} userId - User ID
   * @returns {Array} Auto-completion suggestions
   */
  static async getAutoCompletionSuggestions(userId) {
    try {
      const userHistory = await AutoPersonalizationService.analyzeUserBookingHistory(userId);

      if (userHistory.totalBookings < 2) {
        return []; // Need some history for suggestions
      }

      const suggestions = [];

      // Suggest repeat bookings of frequently used services
      const favoriteServices = Object.entries(userHistory.favoriteServices)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      for (const [serviceId, bookingCount] of favoriteServices) {
        const service = await Service.findById(serviceId);
        if (service && this.isSimpleService(service)) {
          suggestions.push({
            type: 'repeat_booking',
            service,
            title: `Book ${service.name} again`,
            description: `You've booked this ${bookingCount} times before`,
            confidence: Math.min(0.9, bookingCount / 10), // Increase confidence with more bookings
            prefilledData: {
              quantity: userHistory.preferredQuantities[1] || 1,
              bookingDate: this.suggestNextBookingDate(service, userHistory),
              notes: userHistory.commonNotes[Object.keys(userHistory.commonNotes)[0]] || ''
            },
            estimatedTimeSaved: '3-5 minutes'
          });
        }
      }

      // Suggest based on booking patterns
      if (userHistory.bookingFrequency > 0.5) { // Books more than twice a month
        suggestions.push({
          type: 'pattern_booking',
          title: 'Schedule regular booking',
          description: `Based on your booking pattern (${userHistory.bookingFrequency.toFixed(1)} per month)`,
          confidence: 0.7,
          action: 'setup_recurring'
        });
      }

      return suggestions.slice(0, 5); // Limit to 5 suggestions

    } catch (error) {
      console.error('Error getting auto-completion suggestions:', error);
      return [];
    }
  }

  /**
   * Check if service is simple enough for auto-completion
   */
  static isSimpleService(service) {
    const simpleCategories = ['party', 'corporate', 'birthday', 'funeral'];
    const simpleTypes = ['service'];

    return simpleCategories.includes(service.category) ||
           simpleTypes.includes(service.serviceType);
  }

  /**
   * Suggest next booking date based on user history
   */
  static suggestNextBookingDate(service, userHistory) {
    // Suggest next week at preferred time
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Use preferred day of week if available
    if (userHistory.preferredTimes) {
      const preferredDays = Object.keys(userHistory.preferredTimes)
        .filter(key => key.startsWith('hour_'))
        .sort((a, b) => userHistory.preferredTimes[b] - userHistory.preferredTimes[a]);

      if (preferredDays.length > 0) {
        const preferredHour = parseInt(preferredDays[0].replace('hour_', ''));
        nextWeek.setHours(preferredHour, 0, 0, 0);
      }
    }

    return nextWeek;
  }

  /**
   * Get auto-completion statistics for user
   * @param {string} userId - User ID
   * @returns {Object} Statistics
   */
  static async getAutoCompletionStatistics(userId) {
    try {
      const autoCompletedBookings = await Booking.find({
        customerId: userId,
        autoCompleted: true
      });

      const totalBookings = await Booking.find({
        customerId: userId,
        status: 'confirmed'
      });

      const totalTimeSaved = autoCompletedBookings.length * 4; // Estimate 4 minutes per auto-completion
      const completionRate = totalBookings.length > 0
        ? (autoCompletedBookings.length / totalBookings.length * 100).toFixed(1)
        : 0;

      return {
        autoCompletedBookings: autoCompletedBookings.length,
        totalBookings: totalBookings.length,
        completionRate: `${completionRate}%`,
        estimatedTimeSaved: `${totalTimeSaved} minutes`,
        recentAutoCompletions: autoCompletedBookings.slice(0, 5).map(booking => ({
          id: booking._id,
          serviceName: booking.serviceId?.name || 'Unknown',
          date: booking.bookingDate,
          amount: booking.totalPrice
        }))
      };

    } catch (error) {
      console.error('Error getting auto-completion statistics:', error);
      return {
        autoCompletedBookings: 0,
        totalBookings: 0,
        completionRate: '0%',
        estimatedTimeSaved: '0 minutes',
        recentAutoCompletions: []
      };
    }
  }

  /**
   * Quick booking endpoint for auto-completion
   * @param {string} userId - User ID
   * @param {string} serviceId - Service ID
   * @param {Object} quickData - Quick booking data
   * @returns {Object} Quick booking result
   */
  static async processQuickBooking(userId, serviceId, quickData) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Prepare booking data
      const bookingData = {
        serviceId,
        quantity: quickData.quantity || 1,
        bookingDate: quickData.bookingDate || this.suggestNextBookingDate(service, await AutoPersonalizationService.analyzeUserBookingHistory(userId)),
        notes: quickData.notes || 'Quick auto-completed booking',
        deliveryTime: quickData.deliveryTime,
        totalPrice: 0 // Will be calculated
      };

      // Calculate price
      const bookingDateTime = new Date(bookingData.bookingDate);
      const now = new Date();
      const daysBeforeCheckout = Math.ceil((bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const calculatedPrice = service.calculatePrice(Math.max(0, daysBeforeCheckout));
      bookingData.totalPrice = calculatedPrice * bookingData.quantity;

      // Execute auto-completion
      return await this.executeAutoCompletion(userId, bookingData);

    } catch (error) {
      console.error('Error processing quick booking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AutoCompletionService;