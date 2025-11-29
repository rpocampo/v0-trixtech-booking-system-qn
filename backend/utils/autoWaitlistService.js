const Booking = require('../models/Booking');
const Service = require('../models/Service');
const ReservationQueue = require('../models/ReservationQueue');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const { sendTemplateNotification } = require('./notificationService');
const { findAlternativeServices } = require('./recommendationService');

/**
 * Auto-waitlist management service with smart notifications
 * Automatically manages waitlists and sends intelligent notifications when slots become available
 */
class AutoWaitlistService {
  /**
   * Add user to smart waitlist with priority scoring
   * @param {string} userId - User ID
   * @param {string} serviceId - Service ID
   * @param {Object} waitlistData - Waitlist data
   * @returns {Object} Waitlist entry result
   */
  static async addToSmartWaitlist(userId, serviceId, waitlistData) {
    try {
      const { bookingDate, quantity, notes, urgency, preferences } = waitlistData;

      // Calculate priority score
      const priorityScore = await this.calculatePriorityScore(userId, serviceId, {
        bookingDate,
        quantity,
        urgency: urgency || 'medium'
      });

      // Get user preferences for notifications
      const userPrefs = await UserPreferences.findOne({ userId });
      const notificationPrefs = {
        email: userPrefs?.notificationPreferences?.email !== false,
        push: userPrefs?.notificationPreferences?.push !== false,
        sms: userPrefs?.notificationPreferences?.sms || false,
        urgency: urgency || 'medium'
      };

      // Find alternative services user might be interested in
      const alternatives = await findAlternativeServices(serviceId, new Date(bookingDate), quantity);

      const waitlistEntry = new ReservationQueue({
        customerId: userId,
        serviceId,
        requestedQuantity: quantity,
        bookingDate: new Date(bookingDate),
        notes,
        priorityScore,
        notificationPreferences: notificationPrefs,
        alternativeSuggestions: alternatives.map(alt => ({
          serviceId: alt.serviceId,
          reason: alt.reason,
          availability: alt.availableQuantity,
          matchScore: alt.confidence || 0.5
        })),
        waitlistMetadata: {
          urgency,
          preferences,
          addedAt: new Date(),
          lastNotifiedAt: null,
          notificationCount: 0,
          status: 'active'
        }
      });

      await waitlistEntry.save();

      // Send confirmation notification
      await sendTemplateNotification(userId, 'WAITLIST_JOINED', {
        message: `You've been added to the smart waitlist for your requested booking. We'll notify you automatically when slots become available.`,
        metadata: {
          serviceId,
          bookingDate,
          quantity,
          priorityScore,
          estimatedWaitTime: this.estimateWaitTime(priorityScore),
          alternativesCount: alternatives.length
        }
      });

      return {
        success: true,
        waitlistEntry,
        priorityScore,
        estimatedWaitTime: this.estimateWaitTime(priorityScore),
        alternatives: alternatives.slice(0, 3)
      };

    } catch (error) {
      console.error('Error adding to smart waitlist:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate priority score for waitlist entry
   */
  static async calculatePriorityScore(userId, serviceId, bookingData) {
    try {
      let score = 50; // Base score

      // User loyalty factor
      const userBookings = await Booking.find({
        customerId: userId,
        status: 'confirmed',
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      });

      const loyaltyBonus = Math.min(userBookings.length * 2, 20); // Max 20 points
      score += loyaltyBonus;

      // Urgency factor
      const urgencyMultipliers = {
        'low': 0.8,
        'medium': 1.0,
        'high': 1.3,
        'critical': 1.5
      };
      score *= urgencyMultipliers[bookingData.urgency] || 1.0;

      // Time sensitivity (earlier bookings get higher priority)
      const now = new Date();
      const bookingDate = new Date(bookingData.bookingDate);
      const daysUntilBooking = (bookingDate - now) / (1000 * 60 * 60 * 24);

      if (daysUntilBooking < 7) score += 15; // Urgent bookings
      else if (daysUntilBooking < 14) score += 10; // Soon bookings
      else if (daysUntilBooking > 30) score -= 5; // Far future bookings

      // Quantity factor (larger bookings get slightly higher priority)
      if (bookingData.quantity >= 5) score += 5;
      else if (bookingData.quantity >= 3) score += 3;

      // Service popularity factor
      const serviceBookings = await Booking.find({
        serviceId,
        status: 'confirmed',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const avgBookingsPerDay = serviceBookings.length / 30;
      if (avgBookingsPerDay > 10) score += 10; // High-demand service
      else if (avgBookingsPerDay < 3) score -= 5; // Low-demand service

      return Math.max(0, Math.min(100, Math.round(score))); // Clamp between 0-100

    } catch (error) {
      console.error('Error calculating priority score:', error);
      return 50; // Default score
    }
  }

  /**
   * Estimate wait time based on priority score
   */
  static estimateWaitTime(priorityScore) {
    if (priorityScore >= 80) return '1-2 days';
    if (priorityScore >= 65) return '2-4 days';
    if (priorityScore >= 50) return '3-7 days';
    if (priorityScore >= 35) return '1-2 weeks';
    return '2-4 weeks';
  }

  /**
   * Process waitlist when slots become available
   * @param {string} serviceId - Service ID
   * @param {Date} availableDate - Date when slots became available
   * @param {number} availableQuantity - Number of slots available
   * @returns {Object} Processing result
   */
  static async processWaitlistOnAvailability(serviceId, availableDate, availableQuantity) {
    try {
      // Find active waitlist entries for this service and date
      const waitlistEntries = await ReservationQueue.find({
        serviceId,
        'waitlistMetadata.status': 'active',
        bookingDate: {
          $gte: new Date(availableDate.getFullYear(), availableDate.getMonth(), availableDate.getDate()),
          $lt: new Date(availableDate.getFullYear(), availableDate.getMonth(), availableDate.getDate() + 1)
        }
      }).sort({ priorityScore: -1, createdAt: 1 }); // Highest priority first, then FIFO

      let slotsFilled = 0;
      const notificationsSent = [];
      const offersMade = [];

      for (const entry of waitlistEntries) {
        if (slotsFilled >= availableQuantity) break;

        try {
          // Check if user still wants this booking
          const userPrefs = await UserPreferences.findOne({ userId: entry.customerId });
          if (userPrefs?.waitlistPreferences?.paused) continue;

          // Create booking offer
          const offerResult = await this.createBookingOffer(entry, availableDate);

          if (offerResult.success) {
            offersMade.push({
              entryId: entry._id,
              userId: entry.customerId,
              offerId: offerResult.offer._id
            });

            slotsFilled++;
          }

          // Send smart notification
          const notificationResult = await this.sendSmartAvailabilityNotification(
            entry,
            availableDate,
            availableQuantity - slotsFilled
          );

          if (notificationResult.sent) {
            notificationsSent.push({
              userId: entry.customerId,
              type: notificationResult.type,
              priority: entry.priorityScore
            });
          }

          // Update entry metadata
          entry.waitlistMetadata.lastNotifiedAt = new Date();
          entry.waitlistMetadata.notificationCount += 1;
          await entry.save();

        } catch (error) {
          console.error(`Error processing waitlist entry ${entry._id}:`, error);
        }
      }

      return {
        processed: waitlistEntries.length,
        slotsFilled,
        notificationsSent: notificationsSent.length,
        offersMade: offersMade.length,
        remainingSlots: Math.max(0, availableQuantity - slotsFilled)
      };

    } catch (error) {
      console.error('Error processing waitlist on availability:', error);
      throw error;
    }
  }

  /**
   * Create booking offer for waitlist user
   */
  static async createBookingOffer(waitlistEntry, availableDate) {
    try {
      // This would create a temporary booking offer that expires
      // For now, we'll just mark the entry as offered
      waitlistEntry.waitlistMetadata.status = 'offered';
      waitlistEntry.waitlistMetadata.offeredAt = new Date();
      waitlistEntry.waitlistMetadata.offerExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await waitlistEntry.save();

      return {
        success: true,
        offer: {
          _id: waitlistEntry._id,
          expiresAt: waitlistEntry.waitlistMetadata.offerExpiresAt
        }
      };

    } catch (error) {
      console.error('Error creating booking offer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send smart availability notification
   */
  static async sendSmartAvailabilityNotification(waitlistEntry, availableDate, remainingSlots) {
    try {
      const notificationPrefs = waitlistEntry.notificationPreferences;
      const priority = waitlistEntry.priorityScore;

      // Choose notification type based on priority and preferences
      let notificationType = 'WAITLIST_AVAILABILITY_STANDARD';

      if (priority >= 80 && notificationPrefs.urgency === 'critical') {
        notificationType = 'WAITLIST_AVAILABILITY_URGENT';
      } else if (priority >= 65) {
        notificationType = 'WAITLIST_AVAILABILITY_HIGH_PRIORITY';
      }

      // Check if user wants alternative suggestions
      const includeAlternatives = waitlistEntry.alternativeSuggestions?.length > 0 &&
                                 waitlistEntry.waitlistMetadata.preferences?.suggestAlternatives !== false;

      const alternatives = includeAlternatives ?
        waitlistEntry.alternativeSuggestions.slice(0, 2) : [];

      await sendTemplateNotification(waitlistEntry.customerId, notificationType, {
        message: `Great news! A slot has opened up for your requested booking.`,
        metadata: {
          serviceId: waitlistEntry.serviceId,
          bookingDate: availableDate,
          quantity: waitlistEntry.requestedQuantity,
          priorityScore: waitlistEntry.priorityScore,
          remainingSlots,
          alternatives,
          offerExpiresAt: waitlistEntry.waitlistMetadata.offerExpiresAt,
          waitlistEntryId: waitlistEntry._id
        }
      });

      return {
        sent: true,
        type: notificationType,
        alternativesIncluded: alternatives.length
      };

    } catch (error) {
      console.error('Error sending smart availability notification:', error);
      return { sent: false, error: error.message };
    }
  }

  /**
   * Accept waitlist offer and create booking
   * @param {string} userId - User ID
   * @param {string} waitlistEntryId - Waitlist entry ID
   * @returns {Object} Booking creation result
   */
  static async acceptWaitlistOffer(userId, waitlistEntryId) {
    try {
      const waitlistEntry = await ReservationQueue.findOne({
        _id: waitlistEntryId,
        customerId: userId,
        'waitlistMetadata.status': 'offered'
      });

      if (!waitlistEntry) {
        throw new Error('Waitlist offer not found or expired');
      }

      // Check if offer is still valid
      const now = new Date();
      if (waitlistEntry.waitlistMetadata.offerExpiresAt < now) {
        waitlistEntry.waitlistMetadata.status = 'expired';
        await waitlistEntry.save();
        throw new Error('Waitlist offer has expired');
      }

      // Create the actual booking
      const service = await Service.findById(waitlistEntry.serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Double-check availability
      const isAvailable = await this.checkAvailabilityForWaitlist(
        waitlistEntry.serviceId,
        waitlistEntry.bookingDate,
        waitlistEntry.requestedQuantity
      );

      if (!isAvailable) {
        throw new Error('Slot is no longer available');
      }

      // Calculate price
      const bookingDateTime = new Date(waitlistEntry.bookingDate);
      const nowTime = new Date();
      const daysBeforeCheckout = Math.ceil((bookingDateTime.getTime() - nowTime.getTime()) / (1000 * 60 * 60 * 24));
      const calculatedPrice = service.calculatePrice(Math.max(0, daysBeforeCheckout));
      const totalPrice = calculatedPrice * waitlistEntry.requestedQuantity;

      // Create booking
      const booking = new Booking({
        customerId: userId,
        serviceId: waitlistEntry.serviceId,
        quantity: waitlistEntry.requestedQuantity,
        bookingDate: bookingDateTime,
        totalPrice,
        basePrice: service.basePrice,
        appliedMultiplier: calculatedPrice / service.basePrice,
        daysBeforeCheckout: Math.max(0, daysBeforeCheckout),
        status: 'confirmed',
        paymentStatus: 'paid', // Waitlist bookings are prepaid
        paymentType: 'waitlist_bonus',
        amountPaid: totalPrice,
        remainingBalance: 0,
        notes: `Waitlist booking - ${waitlistEntry.notes || ''}`,
        autoConfirmed: true,
        confirmationReason: 'Accepted from smart waitlist',
        waitlistEntryId: waitlistEntry._id
      });

      await booking.save();

      // Update inventory
      if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
        await service.reduceBatchQuantity(waitlistEntry.requestedQuantity);
      }

      // Mark waitlist entry as completed
      waitlistEntry.waitlistMetadata.status = 'completed';
      waitlistEntry.waitlistMetadata.completedAt = new Date();
      await waitlistEntry.save();

      // Send confirmation
      await sendTemplateNotification(userId, 'WAITLIST_BOOKING_CONFIRMED', {
        message: `🎉 Your waitlist booking has been confirmed! Your reservation is ready.`,
        metadata: {
          bookingId: booking._id,
          serviceId: waitlistEntry.serviceId,
          bookingDate: bookingDateTime,
          totalPrice,
          quantity: waitlistEntry.requestedQuantity,
          priorityScore: waitlistEntry.priorityScore
        }
      });

      return {
        success: true,
        booking,
        message: 'Waitlist booking confirmed successfully!'
      };

    } catch (error) {
      console.error('Error accepting waitlist offer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check availability for waitlist booking
   */
  static async checkAvailabilityForWaitlist(serviceId, bookingDate, quantity) {
    try {
      const service = await Service.findById(serviceId);
      if (!service.quantity) return true; // Unlimited service

      const existingBookings = await Booking.find({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
          $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
        },
        status: { $in: ['confirmed', 'pending'] }
      });

      const bookedQuantity = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
      return bookedQuantity + quantity <= service.quantity;

    } catch (error) {
      console.error('Error checking availability for waitlist:', error);
      return false;
    }
  }

  /**
   * Get user's waitlist status
   * @param {string} userId - User ID
   * @returns {Object} Waitlist status
   */
  static async getUserWaitlistStatus(userId) {
    try {
      const waitlistEntries = await ReservationQueue.find({
        customerId: userId
      }).populate('serviceId', 'name category').sort({ createdAt: -1 });

      const activeEntries = waitlistEntries.filter(entry =>
        entry.waitlistMetadata?.status === 'active'
      );

      const offeredEntries = waitlistEntries.filter(entry =>
        entry.waitlistMetadata?.status === 'offered'
      );

      const completedEntries = waitlistEntries.filter(entry =>
        entry.waitlistMetadata?.status === 'completed'
      );

      return {
        totalEntries: waitlistEntries.length,
        activeEntries: activeEntries.length,
        offeredEntries: offeredEntries.length,
        completedEntries: completedEntries.length,
        averagePriority: activeEntries.length > 0
          ? Math.round(activeEntries.reduce((sum, entry) => sum + entry.priorityScore, 0) / activeEntries.length)
          : 0,
        recentEntries: waitlistEntries.slice(0, 5).map(entry => ({
          id: entry._id,
          serviceName: entry.serviceId?.name || 'Unknown Service',
          bookingDate: entry.bookingDate,
          priorityScore: entry.priorityScore,
          status: entry.waitlistMetadata?.status || 'unknown',
          addedAt: entry.createdAt
        }))
      };

    } catch (error) {
      console.error('Error getting user waitlist status:', error);
      return {
        totalEntries: 0,
        activeEntries: 0,
        offeredEntries: 0,
        completedEntries: 0,
        averagePriority: 0,
        recentEntries: []
      };
    }
  }

  /**
   * Clean up expired waitlist entries and offers
   * @returns {Object} Cleanup result
   */
  static async cleanupExpiredWaitlistEntries() {
    try {
      const now = new Date();

      // Expire old offers (24 hours old)
      const expiredOffers = await ReservationQueue.updateMany(
        {
          'waitlistMetadata.status': 'offered',
          'waitlistMetadata.offerExpiresAt': { $lt: now }
        },
        {
          'waitlistMetadata.status': 'expired',
          'waitlistMetadata.expiredAt': now
        }
      );

      // Clean up very old completed entries (90 days)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oldCompleted = await ReservationQueue.deleteMany({
        'waitlistMetadata.status': 'completed',
        createdAt: { $lt: ninetyDaysAgo }
      });

      // Clean up very old expired entries (30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oldExpired = await ReservationQueue.deleteMany({
        'waitlistMetadata.status': 'expired',
        createdAt: { $lt: thirtyDaysAgo }
      });

      return {
        expiredOffers: expiredOffers.modifiedCount,
        cleanedCompleted: oldCompleted.deletedCount,
        cleanedExpired: oldExpired.deletedCount
      };

    } catch (error) {
      console.error('Error cleaning up expired waitlist entries:', error);
      throw error;
    }
  }

  /**
   * Send proactive waitlist updates
   * @returns {Object} Update result
   */
  static async sendProactiveWaitlistUpdates() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Find users who haven't been notified recently
      const staleEntries = await ReservationQueue.find({
        'waitlistMetadata.status': 'active',
        'waitlistMetadata.lastNotifiedAt': { $lt: sevenDaysAgo }
      }).populate('customerId', 'name email').limit(50); // Limit to avoid spam

      let notificationsSent = 0;

      for (const entry of staleEntries) {
        try {
          // Check if there are any new alternatives available
          const alternatives = await findAlternativeServices(
            entry.serviceId,
            entry.bookingDate,
            entry.requestedQuantity
          );

          const newAlternatives = alternatives.filter(alt =>
            !entry.alternativeSuggestions.some(existing =>
              existing.serviceId.toString() === alt.serviceId.toString()
            )
          );

          if (newAlternatives.length > 0) {
            // Send update notification
            await sendTemplateNotification(entry.customerId._id, 'WAITLIST_UPDATE', {
              message: `Update on your waitlist request - new alternatives available!`,
              metadata: {
                serviceId: entry.serviceId,
                bookingDate: entry.bookingDate,
                newAlternatives: newAlternatives.slice(0, 3),
                priorityScore: entry.priorityScore,
                waitlistEntryId: entry._id
              }
            });

            // Update notification tracking
            entry.waitlistMetadata.lastNotifiedAt = new Date();
            entry.waitlistMetadata.notificationCount += 1;
            await entry.save();

            notificationsSent++;
          }

        } catch (error) {
          console.error(`Error sending proactive update for entry ${entry._id}:`, error);
        }
      }

      return { notificationsSent };

    } catch (error) {
      console.error('Error sending proactive waitlist updates:', error);
      throw error;
    }
  }
}

module.exports = AutoWaitlistService;