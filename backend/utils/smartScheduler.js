const Booking = require('../models/Booking');
const Service = require('../models/Service');
const UserPreferences = require('../models/UserPreferences');

/**
 * Smart scheduling utility that uses AI-like optimization to suggest optimal booking times
 */
class SmartScheduler {
  /**
   * Get optimal booking time suggestions for a service
   * @param {string} serviceId - Service ID
   * @param {string} customerId - Customer ID
   * @param {Date} preferredDate - Preferred booking date
   * @param {number} duration - Duration in days (for rentals)
   * @returns {Array} Array of optimal time suggestions
   */
  static async getOptimalBookingTimes(serviceId, customerId, preferredDate, duration = 1) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Get customer preferences
      const preferences = await UserPreferences.findOne({ userId: customerId });

      // Analyze booking patterns for this service
      const bookingPatterns = await this.analyzeBookingPatterns(serviceId, preferredDate);

      // Get availability data
      const availabilityData = await this.getAvailabilityData(serviceId, preferredDate, duration);

      // Generate optimal suggestions
      const suggestions = await this.generateOptimalSuggestions(
        service,
        preferences,
        bookingPatterns,
        availabilityData,
        preferredDate,
        duration
      );

      return suggestions;
    } catch (error) {
      console.error('Error in smart scheduling:', error);
      return [];
    }
  }

  /**
   * Analyze booking patterns for a service on a given date
   */
  static async analyzeBookingPatterns(serviceId, targetDate) {
    try {
      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Get bookings for the same week in past months
      const pastBookings = await Booking.find({
        serviceId,
        bookingDate: {
          $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          $lt: new Date()
        },
        status: 'confirmed'
      });

      // Analyze patterns by day of week and hour
      const patterns = {
        dayOfWeek: new Array(7).fill(0),
        hourOfDay: new Array(24).fill(0),
        totalBookings: pastBookings.length
      };

      pastBookings.forEach(booking => {
        const dayOfWeek = booking.bookingDate.getDay();
        const hourOfDay = booking.bookingDate.getHours();

        patterns.dayOfWeek[dayOfWeek]++;
        patterns.hourOfDay[hourOfDay]++;
      });

      return patterns;
    } catch (error) {
      console.error('Error analyzing booking patterns:', error);
      return {
        dayOfWeek: new Array(7).fill(0),
        hourOfDay: new Array(24).fill(0),
        totalBookings: 0
      };
    }
  }

  /**
   * Get availability data for a service
   */
  static async getAvailabilityData(serviceId, targetDate, duration) {
    try {
      const startDate = new Date(targetDate);
      const endDate = new Date(targetDate);
      endDate.setDate(startDate.getDate() + duration);

      // Get existing bookings for the period
      const existingBookings = await Booking.find({
        serviceId,
        status: { $in: ['confirmed', 'pending'] },
        bookingDate: {
          $gte: startDate,
          $lt: endDate
        }
      });

      // Calculate availability slots
      const availability = [];
      const totalSlots = service.category === 'equipment' ? 1 : 24; // 24 hours for services, 1 slot for equipment

      for (let i = 0; i < totalSlots; i++) {
        const slotTime = new Date(startDate);
        if (service.category === 'equipment') {
          slotTime.setHours(9, 0, 0, 0); // Default to 9 AM for equipment
        } else {
          slotTime.setHours(i, 0, 0, 0);
        }

        const isAvailable = !existingBookings.some(booking => {
          const bookingTime = new Date(booking.bookingDate);
          return Math.abs(bookingTime.getTime() - slotTime.getTime()) < 60 * 60 * 1000; // Within 1 hour
        });

        availability.push({
          time: slotTime,
          available: isAvailable,
          demand: existingBookings.length / totalSlots
        });
      }

      return availability;
    } catch (error) {
      console.error('Error getting availability data:', error);
      return [];
    }
  }

  /**
   * Generate optimal booking time suggestions
   */
  static async generateOptimalSuggestions(service, preferences, patterns, availability, preferredDate, duration) {
    const suggestions = [];

    // Scoring factors
    const factors = {
      availability: 0.3,      // How available the slot is
      customerPreference: 0.2, // Matches customer preferences
      historicalDemand: 0.2,  // Based on historical booking patterns
      pricing: 0.15,          // Better pricing (advance booking discounts)
      convenience: 0.15       // Convenience factors (weekday vs weekend, time of day)
    };

    // Generate candidate times
    const candidates = this.generateCandidateTimes(service, preferredDate, duration);

    for (const candidate of candidates) {
      const score = this.calculateTimeScore(
        candidate,
        service,
        preferences,
        patterns,
        availability,
        preferredDate,
        factors
      );

      suggestions.push({
        dateTime: candidate,
        score: score.total,
        factors: score.breakdown,
        recommendation: this.getRecommendationReason(score.breakdown, candidate),
        isAvailable: availability.some(a => a.time.getTime() === candidate.getTime() && a.available)
      });
    }

    // Sort by score and return top suggestions
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 suggestions
  }

  /**
   * Generate candidate booking times
   */
  static generateCandidateTimes(service, preferredDate, duration) {
    const candidates = [];
    const baseDate = new Date(preferredDate);

    if (service.category === 'equipment') {
      // For equipment, suggest times around preferred date
      for (let dayOffset = -2; dayOffset <= 2; dayOffset++) {
        const candidateDate = new Date(baseDate);
        candidateDate.setDate(baseDate.getDate() + dayOffset);
        candidateDate.setHours(9, 0, 0, 0); // Default to 9 AM

        if (candidateDate >= new Date()) {
          candidates.push(candidateDate);
        }
      }
    } else {
      // For services, suggest various times on the preferred date
      const businessHours = { start: 8, end: 18 }; // 8 AM to 6 PM

      for (let hour = businessHours.start; hour < businessHours.end; hour++) {
        const candidateTime = new Date(baseDate);
        candidateTime.setHours(hour, 0, 0, 0);

        if (candidateTime >= new Date()) {
          candidates.push(candidateTime);
        }
      }
    }

    return candidates;
  }

  /**
   * Calculate score for a specific time slot
   */
  static calculateTimeScore(candidateTime, service, preferences, patterns, availability, preferredDate, factors) {
    let availabilityScore = 0;
    let preferenceScore = 0;
    let demandScore = 0;
    let pricingScore = 0;
    let convenienceScore = 0;

    // Availability score
    const availabilityInfo = availability.find(a => a.time.getTime() === candidateTime.getTime());
    availabilityScore = availabilityInfo?.available ? 1 : 0;

    // Customer preference score
    if (preferences) {
      const preferredHour = preferences.preferredBookingHour;
      const preferredDay = preferences.preferredBookingDay;

      if (preferredHour && Math.abs(candidateTime.getHours() - preferredHour) <= 2) {
        preferenceScore += 0.5;
      }

      if (preferredDay && candidateTime.getDay() === preferredDay) {
        preferenceScore += 0.5;
      }
    }

    // Historical demand score (prefer less crowded times)
    const dayOfWeek = candidateTime.getDay();
    const hourOfDay = candidateTime.getHours();
    const dayBookings = patterns.dayOfWeek[dayOfWeek] || 0;
    const hourBookings = patterns.hourOfDay[hourOfDay] || 0;
    const avgDayBookings = patterns.totalBookings / 7;
    const avgHourBookings = patterns.totalBookings / 24;

    demandScore = 1 - Math.min(1, (dayBookings / avgDayBookings + hourBookings / avgHourBookings) / 2);

    // Pricing score (prefer times that qualify for discounts)
    const daysUntilBooking = Math.ceil((candidateTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    pricingScore = daysUntilBooking >= 30 ? 1 : daysUntilBooking >= 14 ? 0.7 : daysUntilBooking >= 7 ? 0.4 : 0.1;

    // Convenience score
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBusinessHours = hourOfDay >= 9 && hourOfDay <= 17;
    convenienceScore = (isBusinessHours ? 0.6 : 0.3) + (isWeekend ? 0.2 : 0.4);

    const breakdown = {
      availability: availabilityScore,
      customerPreference: preferenceScore,
      historicalDemand: demandScore,
      pricing: pricingScore,
      convenience: convenienceScore
    };

    const total = Object.entries(breakdown).reduce((sum, [key, value]) => {
      return sum + (value * factors[key]);
    }, 0);

    return { total, breakdown };
  }

  /**
   * Get recommendation reason based on score breakdown
   */
  static getRecommendationReason(breakdown, candidateTime) {
    const reasons = [];

    if (breakdown.availability > 0.8) {
      reasons.push('High availability');
    }

    if (breakdown.customerPreference > 0.7) {
      reasons.push('Matches your preferences');
    }

    if (breakdown.historicalDemand > 0.7) {
      reasons.push('Less crowded time');
    }

    if (breakdown.pricing > 0.8) {
      reasons.push('Best pricing available');
    }

    if (breakdown.convenience > 0.7) {
      reasons.push('Convenient timing');
    }

    const timeString = candidateTime.toLocaleTimeString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    return reasons.length > 0
      ? `${timeString} - ${reasons.join(', ')}`
      : `${timeString} - Good availability`;
  }

  /**
   * Get smart scheduling suggestions for booking wizard
   */
  static async getSmartSuggestions(serviceId, customerId, currentSelections) {
    try {
      const { bookingDate, quantity } = currentSelections;

      if (!bookingDate) {
        // Suggest optimal dates if no date selected
        return await this.getOptimalDates(serviceId, customerId);
      }

      // Suggest optimal times for selected date
      const suggestions = await this.getOptimalBookingTimes(serviceId, customerId, new Date(bookingDate), 1);

      return suggestions.map(suggestion => ({
        time: suggestion.dateTime.toISOString(),
        score: suggestion.score,
        reason: suggestion.recommendation,
        available: suggestion.isAvailable
      }));
    } catch (error) {
      console.error('Error getting smart suggestions:', error);
      return [];
    }
  }

  /**
   * Get optimal dates when no specific date is selected
   */
  static async getOptimalDates(serviceId, customerId) {
    try {
      const suggestions = [];
      const today = new Date();

      // Check next 14 days
      for (let i = 1; i <= 14; i++) {
        const candidateDate = new Date(today);
        candidateDate.setDate(today.getDate() + i);

        const availability = await this.getAvailabilityData(serviceId, candidateDate, 1);
        const availableSlots = availability.filter(a => a.available).length;
        const totalSlots = availability.length;

        const availabilityRatio = totalSlots > 0 ? availableSlots / totalSlots : 0;

        suggestions.push({
          date: candidateDate.toISOString().split('T')[0],
          availability: availabilityRatio,
          score: availabilityRatio * 0.8 + (i <= 7 ? 0.2 : 0), // Prefer sooner dates
          reason: availabilityRatio > 0.7 ? 'High availability' :
                  availabilityRatio > 0.4 ? 'Good availability' : 'Limited availability'
        });
      }

      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    } catch (error) {
      console.error('Error getting optimal dates:', error);
      return [];
    }
  }
}

module.exports = SmartScheduler;