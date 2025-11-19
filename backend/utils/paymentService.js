const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { sendTemplateNotification } = require('./notificationService');
const { generateQRCodeDataURL, generatePaymentInstructions } = require('./qrCodeService');

// Generate unique transaction ID
const generateTransactionId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN_${timestamp}_${random}`.toUpperCase();
};

// Generate unique reference number for QR payments
const generateReferenceNumber = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `QR_${timestamp}_${random}`.toUpperCase();
};

// Create QR code-based payment for GCash
const createQRPayment = async (bookingId, amount, userId) => {
  try {
    console.log('Creating QR payment for booking:', bookingId, 'amount:', amount, 'user:', userId);
    const transactionId = generateTransactionId();
    const referenceNumber = generateReferenceNumber();

    // Create payment record first
    const payment = new Payment({
      bookingId,
      userId,
      amount,
      paymentMethod: 'gcash_qr',
      paymentProvider: 'gcash_qr',
      transactionId,
      referenceNumber,
      status: 'pending',
      paymentData: {
        createdAt: new Date(),
        qrGenerated: true,
        referenceNumber,
      }
    });

    await payment.save();
    console.log('Payment record created:', payment._id);

    // Generate QR code data
    const qrData = {
      amount,
      referenceNumber,
      merchantName: 'TRIXTECH',
      merchantId: 'TRIXTECH001',
      description: `Booking Payment - ${transactionId}`,
      paymentId: payment._id.toString(),
      callbackUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payments/verify-qr/${referenceNumber}`
    };

    const qrCodeDataURL = await generateQRCodeDataURL(qrData);
    const paymentInstructions = generatePaymentInstructions(qrData);

    // Update payment with QR data
    payment.paymentData.qrCode = qrCodeDataURL;
    payment.paymentData.instructions = paymentInstructions;
    await payment.save();

    return {
      success: true,
      paymentId: payment._id,
      transactionId,
      referenceNumber,
      qrCode: qrCodeDataURL,
      instructions: paymentInstructions,
      status: 'pending'
    };

  } catch (error) {
    console.error('Error creating QR payment:', error);
    throw error;
  }
};


// Get payment status
const getPaymentStatus = async (paymentId) => {
  try {
    let payment;

    // Check if paymentId is a valid ObjectId
    if (require('mongoose').Types.ObjectId.isValid(paymentId)) {
      // Try to find by _id first (for backward compatibility)
      payment = await Payment.findById(paymentId)
        .populate('bookingId')
        .populate('userId', 'name email');
    }

    if (!payment) {
      // If not found by _id or not a valid ObjectId, try by referenceNumber
      payment = await Payment.findOne({ referenceNumber: paymentId })
        .populate('bookingId')
        .populate('userId', 'name email');
    }

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
    let payment;

    // Check if paymentId is a valid ObjectId
    if (require('mongoose').Types.ObjectId.isValid(paymentId)) {
      // Try to find by _id first (for backward compatibility)
      payment = await Payment.findById(paymentId);
    }

    if (!payment) {
      // If not found by _id or not a valid ObjectId, try by referenceNumber
      payment = await Payment.findOne({ referenceNumber: paymentId });
    }

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

// Verify QR code payment (called when GCash processes the payment)
const verifyQRPayment = async (referenceNumber, paymentData = {}) => {
  try {
    // Find payment by reference number
    const payment = await Payment.findOne({ referenceNumber })
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.status === 'completed') {
      return { success: true, message: 'Payment already completed', payment };
    }

    // For test payments, allow verification without full validation
    if (paymentData.test) {
      console.log('Processing test QR payment verification');
    }

    // Update payment status
    payment.status = 'completed';
    payment.completedAt = new Date();
    payment.paymentData = { ...payment.paymentData, ...paymentData, verifiedAt: new Date() };
    await payment.save();

    // Confirm the booking
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
        console.error('Error sending QR payment confirmation notifications:', notificationError);
      }
    }

    return {
      success: true,
      payment,
      booking: payment.bookingId,
      message: 'QR payment verified and booking confirmed'
    };

  } catch (error) {
    console.error('Error verifying QR payment:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createQRPayment,
  verifyQRPayment,
  getPaymentStatus,
  cancelPayment,
  generateTransactionId,
  generateReferenceNumber,
};