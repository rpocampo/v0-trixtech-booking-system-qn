const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');

/**
 * Auto-personalization service that learns user preferences and provides personalized experiences
 */
class AutoPersonalizationService {
  /**
   * Get personalized booking data for a user and service
   * @param {string} userId - User ID
   * @param {string} serviceId - Service ID
   * @returns {Object} Personalized booking data
   */
  static async getPersonalizedBookingData(userId, serviceId) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Get user preferences
      const preferences = await UserPreferences.findOne({ userId });

      // Analyze user's booking history
      const bookingHistory = await this.analyzeUserBookingHistory(userId);

      // Get service-specific preferences
      const servicePreferences = await this.getServiceSpecificPreferences(userId, serviceId);

      // Generate personalized defaults
      const personalizedData = {
        quantity: this.getPreferredQuantity(service, bookingHistory, servicePreferences),
        bookingDate: this.getPreferredBookingDate(service, preferences, bookingHistory),
        deliveryTime: this.getPreferredDeliveryTime(service, preferences, bookingHistory),
        notes: this.getPreferredNotes(service, bookingHistory),
        addons: this.getPreferredAddons(service, bookingHistory),
        confidence: this.calculatePersonalizationConfidence(bookingHistory, servicePreferences)
      };

      return {
        success: true,
        personalizedData,
        reasoning: this.generatePersonalizationReasoning(personalizedData, bookingHistory, preferences)
      };
    } catch (error) {
      console.error('Error getting personalized booking data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze user's booking history to extract patterns
   */
  static async analyzeUserBookingHistory(userId) {
    try {
      const bookings = await Booking.find({
        customerId: userId,
        status: 'confirmed'
      }).populate('serviceId').sort({ createdAt: -1 }).limit(50);

      const analysis = {
        totalBookings: bookings.length,
        favoriteCategories: {},
        preferredTimes: {},
        preferredQuantities: {},
        commonNotes: {},
        favoriteServices: {},
        averageSpend: 0,
        bookingFrequency: 0
      };

      if (bookings.length === 0) {
        return analysis;
      }

      // Calculate average spend
      const totalSpend = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0);
      analysis.averageSpend = totalSpend / bookings.length;

      // Analyze booking frequency (bookings per month)
      if (bookings.length >= 2) {
        const firstBooking = bookings[bookings.length - 1].createdAt;
        const lastBooking = bookings[0].createdAt;
        const monthsDiff = (lastBooking - firstBooking) / (1000 * 60 * 60 * 24 * 30);
        analysis.bookingFrequency = monthsDiff > 0 ? bookings.length / monthsDiff : bookings.length;
      }

      // Analyze patterns
      bookings.forEach(booking => {
        const service = booking.serviceId;
        if (!service) return;

        // Favorite categories
        const category = service.category;
        analysis.favoriteCategories[category] = (analysis.favoriteCategories[category] || 0) + 1;

        // Favorite services
        const serviceId = service._id.toString();
        analysis.favoriteServices[serviceId] = (analysis.favoriteServices[serviceId] || 0) + 1;

        // Preferred times (day of week and hour)
        const bookingDate = new Date(booking.bookingDate);
        const dayOfWeek = bookingDate.getDay();
        const hourOfDay = bookingDate.getHours();

        analysis.preferredTimes[dayOfWeek] = (analysis.preferredTimes[dayOfWeek] || 0) + 1;
        analysis.preferredTimes[`hour_${hourOfDay}`] = (analysis.preferredTimes[`hour_${hourOfDay}`] || 0) + 1;

        // Preferred quantities
        const quantity = booking.quantity;
        analysis.preferredQuantities[quantity] = (analysis.preferredQuantities[quantity] || 0) + 1;

        // Common notes patterns
        if (booking.notes) {
          const noteKey = booking.notes.toLowerCase().trim();
          if (noteKey.length > 10) { // Only meaningful notes
            analysis.commonNotes[noteKey] = (analysis.commonNotes[noteKey] || 0) + 1;
          }
        }
      });

      return analysis;
    } catch (error) {
      console.error('Error analyzing user booking history:', error);
      return {
        totalBookings: 0,
        favoriteCategories: {},
        preferredTimes: {},
        preferredQuantities: {},
        commonNotes: {},
        favoriteServices: {},
        averageSpend: 0,
        bookingFrequency: 0
      };
    }
  }

  /**
   * Get service-specific preferences for a user
   */
  static async getServiceSpecificPreferences(userId, serviceId) {
    try {
      const serviceBookings = await Booking.find({
        customerId: userId,
        serviceId,
        status: 'confirmed'
      }).sort({ createdAt: -1 }).limit(10);

      if (serviceBookings.length === 0) {
        return null;
      }

      const preferences = {
        avgQuantity: 0,
        preferredTimes: {},
        commonNotes: [],
        lastBookingDate: serviceBookings[0].bookingDate
      };

      // Calculate average quantity
      preferences.avgQuantity = serviceBookings.reduce((sum, booking) => sum + booking.quantity, 0) / serviceBookings.length;

      // Preferred times for this service
      serviceBookings.forEach(booking => {
        const hour = new Date(booking.bookingDate).getHours();
        preferences.preferredTimes[hour] = (preferences.preferredTimes[hour] || 0) + 1;

        if (booking.notes) {
          preferences.commonNotes.push(booking.notes);
        }
      });

      return preferences;
    } catch (error) {
      console.error('Error getting service-specific preferences:', error);
      return null;
    }
  }

  /**
   * Get preferred quantity based on history
   */
  static getPreferredQuantity(service, history, servicePrefs) {
    // Use service-specific preference if available
    if (servicePrefs && servicePrefs.avgQuantity) {
      return Math.round(servicePrefs.avgQuantity);
    }

    // Use general history
    if (Object.keys(history.preferredQuantities).length > 0) {
      const mostCommon = Object.entries(history.preferredQuantities)
        .sort(([,a], [,b]) => b - a)[0];
      return parseInt(mostCommon[0]);
    }

    // Default based on service category
    if (service.category === 'equipment') {
      return 1;
    }

    return 1; // Default
  }

  /**
   * Get preferred booking date based on preferences and history
   */
  static getPreferredBookingDate(service, preferences, history) {
    const now = new Date();

    // Check user preferences first
    if (preferences && preferences.preferredBookingDay !== undefined) {
      const preferredDay = preferences.preferredBookingDay;
      const daysUntilPreferred = (preferredDay - now.getDay() + 7) % 7;

      if (daysUntilPreferred === 0) {
        // Today is preferred day, suggest next week
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        return nextWeek.toISOString().split('T')[0];
      } else {
        const preferredDate = new Date(now);
        preferredDate.setDate(now.getDate() + daysUntilPreferred);
        return preferredDate.toISOString().split('T')[0];
      }
    }

    // Use booking history
    if (Object.keys(history.preferredTimes).length > 0) {
      // Find most preferred day of week
      const dayPreferences = Object.entries(history.preferredTimes)
        .filter(([key]) => !key.startsWith('hour_'))
        .sort(([,a], [,b]) => b - a);

      if (dayPreferences.length > 0) {
        const preferredDay = parseInt(dayPreferences[0][0]);
        const daysUntilPreferred = (preferredDay - now.getDay() + 7) % 7;
        const preferredDate = new Date(now);
        preferredDate.setDate(now.getDate() + (daysUntilPreferred === 0 ? 7 : daysUntilPreferred));
        return preferredDate.toISOString().split('T')[0];
      }
    }

    // Default to next week
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }

  /**
   * Get preferred delivery time
   */
  static getPreferredDeliveryTime(service, preferences, history) {
    if (service.category !== 'equipment') {
      return '';
    }

    // Check user preferences
    if (preferences && preferences.preferredDeliveryTime) {
      return preferences.preferredDeliveryTime;
    }

    // Use booking history
    const deliveryBookings = history.deliveryTimes || [];
    if (deliveryBookings.length > 0) {
      // Return most common delivery time
      const timeCounts = {};
      deliveryBookings.forEach(time => {
        timeCounts[time] = (timeCounts[time] || 0) + 1;
      });

      const mostCommon = Object.entries(timeCounts).sort(([,a], [,b]) => b - a)[0];
      return mostCommon ? mostCommon[0] : '';
    }

    return '09:00'; // Default morning delivery
  }

  /**
   * Get preferred notes based on history
   */
  static getPreferredNotes(service, history) {
    if (Object.keys(history.commonNotes).length > 0) {
      const mostCommon = Object.entries(history.commonNotes)
        .sort(([,a], [,b]) => b - a)[0];
      return mostCommon ? mostCommon[0] : '';
    }

    return '';
  }

  /**
   * Get preferred addons based on history
   */
  static getPreferredAddons(service, history) {
    // This would require addon tracking in the booking model
    // For now, return empty array
    return [];
  }

  /**
   * Calculate confidence in personalization
   */
  static calculatePersonalizationConfidence(history, servicePrefs) {
    let confidence = 0;

    // Base confidence from booking history
    if (history.totalBookings >= 10) confidence += 0.4;
    else if (history.totalBookings >= 5) confidence += 0.3;
    else if (history.totalBookings >= 2) confidence += 0.2;
    else confidence += 0.1;

    // Service-specific confidence
    if (servicePrefs) confidence += 0.3;

    // Pattern strength
    if (Object.keys(history.favoriteCategories).length > 0) confidence += 0.2;
    if (Object.keys(history.preferredTimes).length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate reasoning for personalization choices
   */
  static generatePersonalizationReasoning(personalizedData, history, preferences) {
    const reasons = [];

    if (history.totalBookings > 0) {
      reasons.push(`Based on your ${history.totalBookings} previous booking${history.totalBookings > 1 ? 's' : ''}`);
    }

    if (personalizedData.confidence > 0.7) {
      reasons.push('High confidence personalization');
    } else if (personalizedData.confidence > 0.4) {
      reasons.push('Moderate confidence personalization');
    }

    if (preferences && preferences.preferredBookingDay !== undefined) {
      reasons.push('Matches your preferred booking day');
    }

    return reasons;
  }

  /**
   * Update user preferences based on booking completion
   * @param {string} userId - User ID
   * @param {Object} bookingData - Completed booking data
   */
  static async updateUserPreferences(userId, bookingData) {
    try {
      let preferences = await UserPreferences.findOne({ userId });

      if (!preferences) {
        preferences = new UserPreferences({ userId });
      }

      const bookingDate = new Date(bookingData.bookingDate);

      // Update preferred booking day
      const dayOfWeek = bookingDate.getDay();
      if (!preferences.preferredBookingDay) {
        preferences.preferredBookingDay = dayOfWeek;
      }

      // Update preferred booking hour
      const hourOfDay = bookingDate.getHours();
      if (!preferences.preferredBookingHour) {
        preferences.preferredBookingHour = hourOfDay;
      }

      // Update preferred delivery time if applicable
      if (bookingData.deliveryTime) {
        preferences.preferredDeliveryTime = bookingData.deliveryTime;
      }

      // Track service preferences
      if (!preferences.servicePreferences) {
        preferences.servicePreferences = {};
      }

      const serviceId = bookingData.serviceId.toString();
      if (!preferences.servicePreferences[serviceId]) {
        preferences.servicePreferences[serviceId] = {
          preferredQuantity: bookingData.quantity,
          lastBookingDate: bookingDate,
          bookingCount: 1
        };
      } else {
        preferences.servicePreferences[serviceId].bookingCount++;
        preferences.servicePreferences[serviceId].lastBookingDate = bookingDate;
        // Update preferred quantity with weighted average
        const currentAvg = preferences.servicePreferences[serviceId].preferredQuantity;
        const newQuantity = bookingData.quantity;
        preferences.servicePreferences[serviceId].preferredQuantity =
          (currentAvg * (preferences.servicePreferences[serviceId].bookingCount - 1) + newQuantity) /
          preferences.servicePreferences[serviceId].bookingCount;
      }

      await preferences.save();

      return { success: true };
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get personalized service recommendations for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of recommendations to return
   * @returns {Array} Personalized service recommendations
   */
  static async getPersonalizedRecommendations(userId, limit = 5) {
    try {
      const history = await this.analyzeUserBookingHistory(userId);

      if (history.totalBookings === 0) {
        // New user - return popular services
        const popularServices = await Service.find({ isActive: true })
          .sort({ bookingCount: -1 })
          .limit(limit);
        return popularServices.map(service => ({
          service,
          reason: 'Popular service',
          confidence: 0.5
        }));
      }

      // Find favorite category
      const favoriteCategory = Object.entries(history.favoriteCategories)
        .sort(([,a], [,b]) => b - a)[0];

      if (!favoriteCategory) {
        return [];
      }

      // Get services from favorite category that user hasn't booked recently
      const recentServiceIds = Object.keys(history.favoriteServices);
      const recommendations = await Service.find({
        category: favoriteCategory[0],
        isActive: true,
        _id: { $nin: recentServiceIds }
      }).limit(limit);

      return recommendations.map(service => ({
        service,
        reason: `Similar to your favorite ${favoriteCategory[0]} services`,
        confidence: 0.7
      }));

    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Get quick booking options for frequent users
   * @param {string} userId - User ID
   * @returns {Array} Quick booking options
   */
  static async getQuickBookingOptions(userId) {
    try {
      const history = await this.analyzeUserBookingHistory(userId);

      if (history.totalBookings < 3) {
        return []; // Need some history for quick options
      }

      const options = [];

      // Most booked service
      const mostBookedService = Object.entries(history.favoriteServices)
        .sort(([,a], [,b]) => b - a)[0];

      if (mostBookedService) {
        const service = await Service.findById(mostBookedService[0]);
        if (service) {
          options.push({
            type: 'repeat',
            service,
            title: `Book ${service.name} again`,
            description: `Your most reserved service (${mostBookedService[1]} times)`,
            prefilledData: {
              quantity: history.preferredQuantities[1] || 1,
              bookingDate: this.getPreferredBookingDate(service, null, history)
            }
          });
        }
      }

      // Favorite category quick booking
      const favoriteCategory = Object.entries(history.favoriteCategories)
        .sort(([,a], [,b]) => b - a)[0];

      if (favoriteCategory) {
        options.push({
          type: 'category',
          category: favoriteCategory[0],
          title: `Browse ${favoriteCategory[0]} services`,
          description: `Your favorite category (${favoriteCategory[1]} bookings)`,
          categoryData: {
            category: favoriteCategory[0],
            sortBy: 'popularity'
          }
        });
      }

      return options;
    } catch (error) {
      console.error('Error getting quick booking options:', error);
      return [];
    }
  }
}

module.exports = AutoPersonalizationService;