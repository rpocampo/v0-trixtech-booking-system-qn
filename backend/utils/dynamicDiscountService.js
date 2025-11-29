const Booking = require('../models/Booking');
const Service = require('../models/Service');
const BookingAnalytics = require('../models/BookingAnalytics');

/**
 * Dynamic discount service for automatic pricing optimization
 * Analyzes demand patterns and applies automatic discounts to optimize revenue
 */
class DynamicDiscountService {
  /**
   * Calculate dynamic discount for a service booking
   * @param {string} serviceId - Service ID
   * @param {Date} bookingDate - Booking date
   * @param {number} quantity - Quantity requested
   * @param {string} userId - User ID (optional)
   * @returns {Object} Discount information
   */
  static async calculateDynamicDiscount(serviceId, bookingDate, quantity, userId = null) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        return { discount: 0, reason: 'Service not found' };
      }

      const discountFactors = {
        demand: await this.analyzeDemandPattern(serviceId, bookingDate),
        capacity: await this.analyzeCapacityUtilization(serviceId, bookingDate, quantity),
        timing: this.analyzeTimingDiscount(bookingDate),
        loyalty: userId ? await this.analyzeLoyaltyDiscount(userId, serviceId) : 0,
        bulk: this.analyzeBulkDiscount(quantity),
        seasonality: this.analyzeSeasonalDiscount(bookingDate)
      };

      // Calculate total discount (capped at 50%)
      let totalDiscount = Object.values(discountFactors).reduce((sum, factor) => sum + factor, 0);
      totalDiscount = Math.min(totalDiscount, 50); // Max 50% discount

      // Determine primary reason for discount
      const primaryReason = this.getPrimaryDiscountReason(discountFactors);

      return {
        discount: Math.round(totalDiscount * 100) / 100, // Round to 2 decimal places
        discountFactors,
        primaryReason,
        appliedAutomatically: true,
        validUntil: this.getDiscountExpiration(bookingDate)
      };

    } catch (error) {
      console.error('Error calculating dynamic discount:', error);
      return { discount: 0, reason: 'Error calculating discount' };
    }
  }

  /**
   * Analyze demand patterns for the service
   */
  static async analyzeDemandPattern(serviceId, bookingDate) {
    try {
      const bookingDateObj = new Date(bookingDate);
      const dayOfWeek = bookingDateObj.getDay();
      const hour = bookingDateObj.getHours();

      // Get booking history for similar time slots
      const similarBookings = await Booking.find({
        serviceId,
        status: 'confirmed',
        bookingDate: {
          $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          $lt: new Date()
        }
      });

      // Analyze demand by day of week and hour
      const demandByDayHour = {};
      similarBookings.forEach(booking => {
        const bDate = new Date(booking.bookingDate);
        const key = `${bDate.getDay()}_${Math.floor(bDate.getHours() / 4) * 4}`; // 4-hour blocks
        demandByDayHour[key] = (demandByDayHour[key] || 0) + 1;
      });

      const currentKey = `${dayOfWeek}_${Math.floor(hour / 4) * 4}`;
      const currentDemand = demandByDayHour[currentKey] || 0;
      const avgDemand = Object.values(demandByDayHour).reduce((sum, d) => sum + d, 0) /
                       Math.max(Object.keys(demandByDayHour).length, 1);

      // Low demand = higher discount
      if (currentDemand < avgDemand * 0.5) {
        return 15; // 15% discount for very low demand
      } else if (currentDemand < avgDemand * 0.8) {
        return 8; // 8% discount for low demand
      }

      return 0;
    } catch (error) {
      console.error('Error analyzing demand pattern:', error);
      return 0;
    }
  }

  /**
   * Analyze capacity utilization
   */
  static async analyzeCapacityUtilization(serviceId, bookingDate, quantity) {
    try {
      const service = await Service.findById(serviceId);
      if (!service.quantity) return 0;

      const bookingDateObj = new Date(bookingDate);

      // Get bookings for the same date
      const existingBookings = await Booking.find({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
          $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
        },
        status: { $in: ['confirmed', 'pending'] }
      });

      const bookedQuantity = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
      const utilizationRate = bookedQuantity / service.quantity;

      // Apply discount based on utilization
      if (utilizationRate < 0.3) {
        return 12; // 12% discount for very low utilization
      } else if (utilizationRate < 0.5) {
        return 6; // 6% discount for low utilization
      } else if (utilizationRate > 0.9) {
        return -5; // -5% surcharge for high utilization (actually increases price)
      }

      return 0;
    } catch (error) {
      console.error('Error analyzing capacity utilization:', error);
      return 0;
    }
  }

  /**
   * Analyze timing-based discounts
   */
  static analyzeTimingDiscount(bookingDate) {
    const now = new Date();
    const booking = new Date(bookingDate);
    const daysAhead = Math.ceil((booking - now) / (1000 * 60 * 60 * 24));

    // Early booking discounts
    if (daysAhead >= 60) return 10; // 10% for bookings 60+ days ahead
    if (daysAhead >= 30) return 7;  // 7% for bookings 30+ days ahead
    if (daysAhead >= 14) return 4;  // 4% for bookings 14+ days ahead

    // Last-minute surcharges
    if (daysAhead <= 1) return -10; // -10% surcharge for last-minute bookings

    return 0;
  }

  /**
   * Analyze loyalty-based discounts
   */
  static async analyzeLoyaltyDiscount(userId, serviceId) {
    try {
      const userBookings = await Booking.find({
        customerId: userId,
        status: 'confirmed',
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
      });

      const totalBookings = userBookings.length;
      const serviceBookings = userBookings.filter(b => b.serviceId.toString() === serviceId).length;

      // Loyalty discounts
      if (totalBookings >= 10) return 8; // 8% for frequent customers
      if (totalBookings >= 5) return 5;  // 5% for regular customers
      if (serviceBookings >= 3) return 3; // 3% for repeat service users

      return 0;
    } catch (error) {
      console.error('Error analyzing loyalty discount:', error);
      return 0;
    }
  }

  /**
   * Analyze bulk booking discounts
   */
  static analyzeBulkDiscount(quantity) {
    if (quantity >= 10) return 15; // 15% for 10+ items
    if (quantity >= 5) return 8;   // 8% for 5+ items
    if (quantity >= 3) return 3;   // 3% for 3+ items

    return 0;
  }

  /**
   * Analyze seasonal discounts
   */
  static analyzeSeasonalDiscount(bookingDate) {
    const booking = new Date(bookingDate);
    const month = booking.getMonth();

    // Off-peak season discounts
    const offPeakMonths = [1, 2, 7, 8]; // February, March, August, September
    if (offPeakMonths.includes(month)) {
      return 6; // 6% off-peak discount
    }

    // Peak season surcharges
    const peakMonths = [11, 0, 3, 4]; // December, January, April, May
    if (peakMonths.includes(month)) {
      return -8; // -8% surcharge for peak seasons
    }

    return 0;
  }

  /**
   * Get primary reason for discount
   */
  static getPrimaryDiscountReason(discountFactors) {
    const reasons = {
      demand: 'Low demand period',
      capacity: 'Available capacity',
      timing: 'Early booking',
      loyalty: 'Loyal customer',
      bulk: 'Bulk booking',
      seasonality: 'Off-peak season'
    };

    // Find factor with highest discount
    let maxDiscount = 0;
    let primaryReason = 'General discount';

    Object.entries(discountFactors).forEach(([factor, discount]) => {
      if (Math.abs(discount) > Math.abs(maxDiscount)) {
        maxDiscount = discount;
        primaryReason = reasons[factor] || 'General discount';
      }
    });

    return primaryReason;
  }

  /**
   * Get discount expiration time
   */
  static getDiscountExpiration(bookingDate) {
    // Discount valid for 24 hours or until booking date, whichever is sooner
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);

    const bookingTime = new Date(bookingDate);
    return expiration < bookingTime ? expiration : bookingTime;
  }

  /**
   * Apply dynamic discount to booking
   * @param {Object} booking - Booking object
   * @param {Object} discountInfo - Discount information
   * @returns {Object} Updated booking with discount
   */
  static applyDiscountToBooking(booking, discountInfo) {
    if (discountInfo.discount > 0) {
      const discountAmount = (booking.totalPrice * discountInfo.discount) / 100;
      booking.discountApplied = discountInfo.discount;
      booking.discountAmount = discountAmount;
      booking.finalPrice = booking.totalPrice - discountAmount;
      booking.discountReason = discountInfo.primaryReason;
      booking.discountFactors = discountInfo.discountFactors;
      booking.discountAppliedAt = new Date();
      booking.discountExpiresAt = discountInfo.validUntil;
    }

    return booking;
  }

  /**
   * Get discount analytics for admin
   * @returns {Object} Discount analytics
   */
  static async getDiscountAnalytics() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const discountedBookings = await Booking.find({
        discountApplied: { $gt: 0 },
        createdAt: { $gte: thirtyDaysAgo }
      });

      const totalDiscountedAmount = discountedBookings.reduce((sum, booking) =>
        sum + (booking.discountAmount || 0), 0
      );

      const discountReasons = {};
      discountedBookings.forEach(booking => {
        const reason = booking.discountReason || 'Unknown';
        discountReasons[reason] = (discountReasons[reason] || 0) + 1;
      });

      return {
        totalDiscountedBookings: discountedBookings.length,
        totalDiscountAmount: totalDiscountedAmount,
        averageDiscountPercent: discountedBookings.length > 0
          ? discountedBookings.reduce((sum, b) => sum + b.discountApplied, 0) / discountedBookings.length
          : 0,
        discountReasons,
        period: 'Last 30 days'
      };

    } catch (error) {
      console.error('Error getting discount analytics:', error);
      return {
        totalDiscountedBookings: 0,
        totalDiscountAmount: 0,
        averageDiscountPercent: 0,
        discountReasons: {},
        period: 'Last 30 days'
      };
    }
  }

  /**
   * Get available discounts for a user
   * @param {string} userId - User ID
   * @returns {Array} Available discounts
   */
  static async getAvailableDiscounts(userId) {
    try {
      const discounts = [];

      // Check loyalty discounts
      const loyaltyDiscount = await this.analyzeLoyaltyDiscount(userId, null);
      if (loyaltyDiscount > 0) {
        discounts.push({
          type: 'loyalty',
          title: 'Loyal Customer Discount',
          description: 'Thank you for being a valued customer',
          discountPercent: loyaltyDiscount,
          autoApplied: true
        });
      }

      // Check for upcoming low-demand periods
      const upcomingLowDemand = await this.findUpcomingLowDemandPeriods();
      if (upcomingLowDemand.length > 0) {
        discounts.push({
          type: 'demand',
          title: 'Early Bird Discount',
          description: `Book now for ${upcomingLowDemand[0].date} and save`,
          discountPercent: 10,
          validUntil: upcomingLowDemand[0].date,
          autoApplied: false
        });
      }

      return discounts;

    } catch (error) {
      console.error('Error getting available discounts:', error);
      return [];
    }
  }

  /**
   * Find upcoming low-demand periods
   */
  static async findUpcomingLowDemandPeriods() {
    try {
      const upcomingPeriods = [];
      const now = new Date();

      // Check next 30 days
      for (let i = 1; i <= 30; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);

        // Simple heuristic: weekdays have lower demand
        if (checkDate.getDay() >= 1 && checkDate.getDay() <= 4) { // Monday-Thursday
          upcomingPeriods.push({
            date: checkDate,
            expectedDemand: 'low',
            discountPotential: 15
          });
        }
      }

      return upcomingPeriods.slice(0, 5);
    } catch (error) {
      console.error('Error finding low-demand periods:', error);
      return [];
    }
  }

  /**
   * Optimize pricing for maximum revenue
   * @param {string} serviceId - Service ID
   * @param {Date} date - Target date
   * @returns {Object} Pricing optimization
   */
  static async optimizePricing(serviceId, date) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) return null;

      const currentUtilization = await this.analyzeCapacityUtilization(serviceId, date, 1);
      const demandLevel = await this.analyzeDemandPattern(serviceId, date);

      let recommendedPrice = service.basePrice;
      let reasoning = [];

      // Adjust price based on utilization and demand
      if (currentUtilization > 0.9) {
        // High utilization - increase price
        recommendedPrice *= 1.2;
        reasoning.push('High demand - price increase recommended');
      } else if (currentUtilization < 0.3) {
        // Low utilization - decrease price
        recommendedPrice *= 0.8;
        reasoning.push('Low utilization - discount recommended');
      }

      if (demandLevel > 10) {
        recommendedPrice *= 1.1;
        reasoning.push('High demand period');
      } else if (demandLevel < -5) {
        recommendedPrice *= 0.9;
        reasoning.push('Low demand period');
      }

      return {
        serviceId,
        date,
        basePrice: service.basePrice,
        recommendedPrice: Math.round(recommendedPrice),
        priceChange: Math.round((recommendedPrice - service.basePrice) / service.basePrice * 100),
        reasoning,
        confidence: 0.75
      };

    } catch (error) {
      console.error('Error optimizing pricing:', error);
      return null;
    }
  }

  /**
   * Auto-apply discounts to pending bookings
   * @returns {Object} Auto-application results
   */
  static async autoApplyDiscounts() {
    try {
      const pendingBookings = await Booking.find({
        status: 'pending',
        discountApplied: { $exists: false },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).populate('serviceId');

      let appliedCount = 0;
      let totalDiscountAmount = 0;

      for (const booking of pendingBookings) {
        try {
          const discountInfo = await this.calculateDynamicDiscount(
            booking.serviceId._id,
            booking.bookingDate,
            booking.quantity,
            booking.customerId
          );

          if (discountInfo.discount > 0) {
            this.applyDiscountToBooking(booking, discountInfo);
            await booking.save();

            appliedCount++;
            totalDiscountAmount += booking.discountAmount || 0;

            // Notify customer of discount
            await this.notifyDiscountApplied(booking, discountInfo);
          }
        } catch (error) {
          console.error(`Error auto-applying discount to booking ${booking._id}:`, error);
        }
      }

      return {
        processed: pendingBookings.length,
        discountsApplied: appliedCount,
        totalDiscountAmount,
        averageDiscount: appliedCount > 0 ? totalDiscountAmount / appliedCount : 0
      };

    } catch (error) {
      console.error('Error in auto-apply discounts:', error);
      throw error;
    }
  }

  /**
   * Notify customer of applied discount
   */
  static async notifyDiscountApplied(booking, discountInfo) {
    try {
      const { sendTemplateNotification } = require('./notificationService');

      await sendTemplateNotification(booking.customerId, 'DISCOUNT_APPLIED', {
        message: `🎉 Great news! We've applied a ${discountInfo.discount}% discount to your booking.`,
        metadata: {
          bookingId: booking._id,
          discountPercent: discountInfo.discount,
          discountReason: discountInfo.primaryReason,
          newPrice: booking.finalPrice,
          originalPrice: booking.totalPrice,
          savings: booking.discountAmount
        }
      });

    } catch (error) {
      console.error('Error notifying discount application:', error);
    }
  }
}

module.exports = DynamicDiscountService;