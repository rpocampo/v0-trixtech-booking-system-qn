const User = require('../models/User');
const Payment = require('../models/Payment');
const UserPreferences = require('../models/UserPreferences');

/**
 * Auto-payment service for managing saved payment methods and auto-processing
 */
class AutoPaymentService {
  /**
   * Get user's saved payment methods and preferences
   * @param {string} userId - User ID
   * @returns {Object} Payment preferences and methods
   */
  static async getUserPaymentPreferences(userId) {
    try {
      const preferences = await UserPreferences.findOne({ userId });

      // Get recent successful payments to determine preferred methods
      const recentPayments = await Payment.find({
        userId,
        status: 'completed'
      }).sort({ createdAt: -1 }).limit(10);

      const paymentMethods = {};
      recentPayments.forEach(payment => {
        const method = payment.paymentMethod || 'gcash_qr';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });

      // Find most used payment method
      const preferredMethod = Object.entries(paymentMethods)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'gcash_qr';

      return {
        autoPaymentEnabled: preferences?.autoPaymentEnabled || false,
        preferredPaymentMethod: preferences?.preferredPaymentMethod || preferredMethod,
        savedPaymentMethods: preferences?.savedPaymentMethods || [],
        paymentHistory: recentPayments.length,
        preferredMethodUsage: paymentMethods[preferredMethod] || 0
      };
    } catch (error) {
      console.error('Error getting user payment preferences:', error);
      return {
        autoPaymentEnabled: false,
        preferredPaymentMethod: 'gcash_qr',
        savedPaymentMethods: [],
        paymentHistory: 0,
        preferredMethodUsage: 0
      };
    }
  }

  /**
   * Save a payment method for future use
   * @param {string} userId - User ID
   * @param {Object} paymentMethodData - Payment method details
   * @returns {Object} Save result
   */
  static async savePaymentMethod(userId, paymentMethodData) {
    try {
      let preferences = await UserPreferences.findOne({ userId });

      if (!preferences) {
        preferences = new UserPreferences({ userId });
      }

      if (!preferences.savedPaymentMethods) {
        preferences.savedPaymentMethods = [];
      }

      // Check if method already exists
      const existingIndex = preferences.savedPaymentMethods.findIndex(
        method => method.type === paymentMethodData.type && method.identifier === paymentMethodData.identifier
      );

      if (existingIndex >= 0) {
        // Update existing method
        preferences.savedPaymentMethods[existingIndex] = {
          ...preferences.savedPaymentMethods[existingIndex],
          ...paymentMethodData,
          lastUsed: new Date(),
          usageCount: (preferences.savedPaymentMethods[existingIndex].usageCount || 0) + 1
        };
      } else {
        // Add new method
        preferences.savedPaymentMethods.push({
          ...paymentMethodData,
          id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          savedAt: new Date(),
          lastUsed: new Date(),
          usageCount: 1,
          isDefault: preferences.savedPaymentMethods.length === 0 // First method is default
        });
      }

      await preferences.save();

      return {
        success: true,
        message: 'Payment method saved successfully',
        methodId: existingIndex >= 0
          ? preferences.savedPaymentMethods[existingIndex].id
          : preferences.savedPaymentMethods[preferences.savedPaymentMethods.length - 1].id
      };
    } catch (error) {
      console.error('Error saving payment method:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get recommended payment method for a booking
   * @param {string} userId - User ID
   * @param {number} amount - Booking amount
   * @param {string} serviceCategory - Service category
   * @returns {Object} Recommended payment method
   */
  static async getRecommendedPaymentMethod(userId, amount, serviceCategory) {
    try {
      const preferences = await this.getUserPaymentPreferences(userId);

      if (!preferences.autoPaymentEnabled) {
        return {
          recommended: false,
          reason: 'Auto-payment not enabled',
          fallbackMethod: 'gcash_qr'
        };
      }

      // For high-value bookings, prefer more secure methods
      if (amount > 5000) {
        return {
          recommended: 'gcash_qr',
          reason: 'High-value booking - using secure QR payment',
          confidence: 0.9,
          autoProcess: false // Require manual confirmation for high amounts
        };
      }

      // For recurring customers with successful payment history
      if (preferences.paymentHistory >= 3 && preferences.preferredMethodUsage >= 2) {
        return {
          recommended: preferences.preferredPaymentMethod,
          reason: `Your preferred method (${preferences.preferredMethodUsage} successful uses)`,
          confidence: 0.8,
          autoProcess: amount <= 2000 // Auto-process for low amounts
        };
      }

      // Default recommendation
      return {
        recommended: 'gcash_qr',
        reason: 'Standard secure payment method',
        confidence: 0.6,
        autoProcess: false
      };

    } catch (error) {
      console.error('Error getting recommended payment method:', error);
      return {
        recommended: 'gcash_qr',
        reason: 'Default payment method',
        confidence: 0.5,
        autoProcess: false
      };
    }
  }

  /**
   * Process auto-payment for eligible bookings
   * @param {string} userId - User ID
   * @param {string} bookingId - Booking ID
   * @param {number} amount - Payment amount
   * @param {string} paymentMethod - Payment method to use
   * @returns {Object} Auto-payment result
   */
  static async processAutoPayment(userId, bookingId, amount, paymentMethod) {
    try {
      // Validate user has auto-payment enabled
      const preferences = await UserPreferences.findOne({ userId });
      if (!preferences || !preferences.autoPaymentEnabled) {
        throw new Error('Auto-payment not enabled for this user');
      }

      // Check payment history for reliability
      const recentPayments = await Payment.find({
        userId,
        status: 'completed',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      if (recentPayments.length < 2) {
        throw new Error('Insufficient payment history for auto-payment');
      }

      // For now, since we only support GCash QR, we'll create a payment intent
      // In a real implementation, this would integrate with saved payment methods
      const { generateTransactionId, generateReferenceNumber } = require('./paymentService');

      const transactionId = generateTransactionId();
      const referenceNumber = generateReferenceNumber();

      // Create payment record
      const payment = new Payment({
        bookingId,
        userId,
        amount,
        paymentMethod: paymentMethod || 'gcash_qr',
        paymentProvider: 'gcash_qr',
        transactionId,
        referenceNumber,
        status: 'pending', // Still requires user to complete QR scan
        paymentType: 'full',
        isDownPayment: false,
        isFinalPayment: true,
        paymentData: {
          createdAt: new Date(),
          qrGenerated: true,
          referenceNumber,
          usesUserQR: false,
          autoPaymentInitiated: true,
          autoPaymentReason: 'Recurring customer with trusted payment history'
        }
      });

      await payment.save();

      // Generate QR code
      const { generateQRCodeDataURL, generatePaymentInstructions } = require('./qrCodeService');

      const paymentDescription = `Auto Payment - ${transactionId}`;
      const qrData = {
        amount,
        referenceNumber,
        merchantName: 'TRIXTECH',
        merchantId: 'TRIXTECH001',
        description: paymentDescription,
        paymentId: payment._id.toString(),
        callbackUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payments/verify-qr/${referenceNumber}`
      };

      const qrCode = await generateQRCodeDataURL(qrData);
      const instructions = generatePaymentInstructions(qrData);

      // Update payment with QR data
      payment.paymentData.qrCode = qrCode;
      payment.paymentData.instructions = instructions;
      await payment.save();

      return {
        success: true,
        payment,
        qrCode,
        instructions,
        referenceNumber,
        transactionId,
        message: 'Auto-payment initiated. Please complete payment using the QR code.',
        autoPayment: true
      };

    } catch (error) {
      console.error('Error processing auto-payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update payment preferences based on successful payment
   * @param {string} userId - User ID
   * @param {string} paymentMethod - Payment method used
   * @param {boolean} wasSuccessful - Whether payment was successful
   */
  static async updatePaymentPreferences(userId, paymentMethod, wasSuccessful) {
    try {
      let preferences = await UserPreferences.findOne({ userId });

      if (!preferences) {
        preferences = new UserPreferences({ userId });
      }

      // Update preferred payment method if successful
      if (wasSuccessful) {
        preferences.preferredPaymentMethod = paymentMethod;

        // Update usage count for saved methods
        if (preferences.savedPaymentMethods) {
          const methodIndex = preferences.savedPaymentMethods.findIndex(
            method => method.type === paymentMethod
          );

          if (methodIndex >= 0) {
            preferences.savedPaymentMethods[methodIndex].lastUsed = new Date();
            preferences.savedPaymentMethods[methodIndex].usageCount =
              (preferences.savedPaymentMethods[methodIndex].usageCount || 0) + 1;
          }
        }
      }

      await preferences.save();

      return { success: true };
    } catch (error) {
      console.error('Error updating payment preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get payment method statistics for user
   * @param {string} userId - User ID
   * @returns {Object} Payment statistics
   */
  static async getPaymentStatistics(userId) {
    try {
      const payments = await Payment.find({ userId }).sort({ createdAt: -1 });

      const stats = {
        totalPayments: payments.length,
        successfulPayments: payments.filter(p => p.status === 'completed').length,
        failedPayments: payments.filter(p => p.status === 'failed').length,
        pendingPayments: payments.filter(p => p.status === 'pending').length,
        totalAmount: payments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0),
        methodUsage: {},
        recentPayments: payments.slice(0, 5)
      };

      // Calculate method usage
      payments.forEach(payment => {
        const method = payment.paymentMethod || 'gcash_qr';
        stats.methodUsage[method] = (stats.methodUsage[method] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting payment statistics:', error);
      return {
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        pendingPayments: 0,
        totalAmount: 0,
        methodUsage: {},
        recentPayments: []
      };
    }
  }

  /**
   * Check if user is eligible for auto-payment
   * @param {string} userId - User ID
   * @returns {Object} Eligibility status
   */
  static async checkAutoPaymentEligibility(userId) {
    try {
      const preferences = await UserPreferences.findOne({ userId });
      const stats = await this.getPaymentStatistics(userId);

      const eligibility = {
        eligible: false,
        reasons: [],
        requirements: []
      };

      // Check payment history
      if (stats.successfulPayments < 3) {
        eligibility.requirements.push('Complete at least 3 successful payments');
      } else {
        eligibility.reasons.push('Sufficient payment history');
      }

      // Check recency of payments
      if (stats.recentPayments.length > 0) {
        const lastPayment = new Date(stats.recentPayments[0].createdAt);
        const daysSinceLastPayment = (new Date() - lastPayment) / (1000 * 60 * 60 * 24);

        if (daysSinceLastPayment > 90) {
          eligibility.requirements.push('Recent payment activity required');
        } else {
          eligibility.reasons.push('Recent payment activity');
        }
      }

      // Check for failed payments
      if (stats.failedPayments > stats.successfulPayments * 0.2) {
        eligibility.requirements.push('Too many failed payments');
      } else if (stats.failedPayments === 0) {
        eligibility.reasons.push('No failed payment history');
      }

      // Check user preferences
      if (preferences?.autoPaymentEnabled) {
        eligibility.reasons.push('Auto-payment enabled in preferences');
      } else {
        eligibility.requirements.push('Enable auto-payment in preferences');
      }

      eligibility.eligible = eligibility.requirements.length === 0;

      return eligibility;
    } catch (error) {
      console.error('Error checking auto-payment eligibility:', error);
      return {
        eligible: false,
        reasons: [],
        requirements: ['Unable to verify eligibility']
      };
    }
  }

  /**
   * Enable/disable auto-payment for user
   * @param {string} userId - User ID
   * @param {boolean} enabled - Whether to enable auto-payment
   * @returns {Object} Update result
   */
  static async setAutoPaymentEnabled(userId, enabled) {
    try {
      let preferences = await UserPreferences.findOne({ userId });

      if (!preferences) {
        preferences = new UserPreferences({ userId });
      }

      // If enabling, check eligibility first
      if (enabled) {
        const eligibility = await this.checkAutoPaymentEligibility(userId);
        if (!eligibility.eligible) {
          return {
            success: false,
            error: 'Not eligible for auto-payment',
            requirements: eligibility.requirements
          };
        }
      }

      preferences.autoPaymentEnabled = enabled;
      await preferences.save();

      return {
        success: true,
        message: `Auto-payment ${enabled ? 'enabled' : 'disabled'} successfully`
      };
    } catch (error) {
      console.error('Error setting auto-payment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AutoPaymentService;