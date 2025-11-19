const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { sendTemplateNotification } = require('./notificationService');

// GCash Sandbox Configuration
const GCASH_CONFIG = {
  sandbox: {
    baseUrl: 'https://api-sandbox.gcash.com',
    clientId: process.env.GCASH_SANDBOX_CLIENT_ID || 'test-client-id',
    clientSecret: process.env.GCASH_SANDBOX_CLIENT_SECRET || 'test-client-secret',
    merchantId: process.env.GCASH_SANDBOX_MERCHANT_ID || 'test-merchant-id',
    redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
  },
  production: {
    baseUrl: 'https://api.gcash.com',
    clientId: process.env.GCASH_CLIENT_ID,
    clientSecret: process.env.GCASH_CLIENT_SECRET,
    merchantId: process.env.GCASH_MERCHANT_ID,
    redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
  }
};

// Get GCash configuration based on environment
const getGcashConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? GCASH_CONFIG.production : GCASH_CONFIG.sandbox;
};

// Generate unique transaction ID
const generateTransactionId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `GCASH_${timestamp}_${random}`.toUpperCase();
};

// Create payment intent for GCash
const createPaymentIntent = async (bookingId, amount, userId) => {
  try {
    // For sandbox/testing, we'll simulate the GCash payment flow
    // In production, this would make actual API calls to GCash

    const transactionId = generateTransactionId();
    const config = getGcashConfig();

    // Create payment record
    const payment = new Payment({
      bookingId,
      userId,
      amount,
      paymentMethod: 'gcash',
      paymentProvider: config === GCASH_CONFIG.sandbox ? 'gcash_sandbox' : 'gcash_production',
      transactionId,
      status: 'pending',
      paymentData: {
        createdAt: new Date(),
        config: {
          redirectUrl: config.redirectUrl,
          merchantId: config.merchantId,
        }
      }
    });

    await payment.save();

    // In sandbox mode, we'll simulate different scenarios
    const isSandbox = config === GCASH_CONFIG.sandbox;

    if (isSandbox) {
      // For testing, we'll randomly simulate success/failure
      // In production, this would be the actual GCash payment URL
      const paymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/gcash-simulator?transactionId=${transactionId}&amount=${amount}`;
      return {
        success: true,
        paymentId: payment._id,
        transactionId,
        paymentUrl,
        status: 'pending'
      };
    }

    // Production GCash integration would go here
    // This would make actual API calls to GCash payment gateway

    return {
      success: false,
      error: 'Production GCash integration not implemented yet'
    };

  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// Process payment callback/webhook
const processPaymentCallback = async (transactionId, status, paymentData = {}) => {
  try {
    const payment = await Payment.findOne({ transactionId })
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Update payment status
    payment.status = status;
    payment.paymentData = { ...payment.paymentData, ...paymentData };

    if (status === 'completed') {
      payment.completedAt = new Date();
      payment.referenceNumber = paymentData.referenceNumber || `REF_${Date.now()}`;
    } else if (status === 'failed') {
      payment.failureReason = paymentData.failureReason || 'Payment failed';
    }

    await payment.save();

    // If payment is successful, confirm the booking
    if (status === 'completed') {
      const booking = payment.bookingId;
      if (booking) {
        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        await booking.save();

        // Send confirmation notifications
        try {
          await sendTemplateNotification(payment.userId._id, 'BOOKING_CONFIRMED', {
            metadata: {
              bookingId: booking._id,
              serviceId: booking.serviceId,
              amount: payment.amount,
            }
          });

          // Admin notification
          const User = require('../models/User');
          const adminUsers = await User.find({ role: 'admin' });
          for (const admin of adminUsers) {
            await sendTemplateNotification(admin._id, 'NEW_BOOKING_ADMIN', {
              metadata: {
                bookingId: booking._id,
                serviceId: booking.serviceId,
                amount: payment.amount,
              }
            });
          }
        } catch (notificationError) {
          console.error('Error sending payment confirmation notifications:', notificationError);
        }
      }
    }

    return {
      success: true,
      payment,
      booking: payment.bookingId
    };

  } catch (error) {
    console.error('Error processing payment callback:', error);
    throw error;
  }
};

// Get payment status
const getPaymentStatus = async (paymentId) => {
  try {
    const payment = await Payment.findById(paymentId)
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    return {
      success: true,
      payment: {
        id: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
      }
    };
  } catch (error) {
    console.error('Error getting payment status:', error);
    return { success: false, error: error.message };
  }
};

// Cancel payment
const cancelPayment = async (paymentId, reason = 'User cancelled') => {
  try {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.status !== 'pending') {
      return { success: false, error: 'Payment cannot be cancelled' };
    }

    payment.status = 'cancelled';
    payment.failureReason = reason;
    await payment.save();

    return { success: true, payment };
  } catch (error) {
    console.error('Error cancelling payment:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createPaymentIntent,
  processPaymentCallback,
  getPaymentStatus,
  cancelPayment,
  getGcashConfig,
  generateTransactionId,
};