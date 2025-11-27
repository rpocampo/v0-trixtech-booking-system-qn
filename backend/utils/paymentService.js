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
const createQRPayment = async (bookingId, amount, userId, paymentType = 'full') => {
  try {
    const transactionId = generateTransactionId();
    const referenceNumber = generateReferenceNumber();

    // All payments are now full payments
    const isDownPayment = false;
    const isFinalPayment = false;

    // Get user to check if they have a personal GCash QR code
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

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
      paymentType,
      isDownPayment,
      isFinalPayment,
      paymentData: {
        createdAt: new Date(),
        qrGenerated: true,
        referenceNumber,
        usesUserQR: !!user.gcashQRCode, // Track if using user's QR
      }
    });

    await payment.save();

    let qrCodeDataURL;
    let paymentInstructions;

    // Use the hardcoded GCash QR code for all payments
    const hardcodedQRCode = '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDO83CHRX5204601653036085802PH5908MI**I M.6008Caloocan6104123463045192';
    qrCodeDataURL = 'data:image/png;base64,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'; // Use the generated QR code data URL

    // Custom instructions for the hardcoded QR code
    paymentInstructions = {
      title: 'Pay with GCash QR Code',
      instructions: [
        '1. Open your GCash app',
        '2. Tap the QR scanner icon or select "Pay QR"',
        '3. Scan the QR code shown below',
        '4. Verify the amount and recipient details',
        '5. Confirm and complete the payment, or use the test payment button below to simulate payment for testing',
        '6. The system will automatically detect your payment'
      ],
      amount,
      reference: referenceNumber,
      merchant: 'MI**I M.',
      note: `Please send exactly ₱${amount.toFixed(2)} to complete your booking payment. Include "${referenceNumber}" in the message/notes field for faster processing.`,
      qrData: hardcodedQRCode // Include the raw QR data for frontend
    };

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
      status: 'pending',
      paymentType,
      usesUserQR: !!user.gcashQRCode // Indicate if using user's QR
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

    // Update payment status
    payment.status = 'completed';
    payment.completedAt = new Date();
    payment.paymentData = { ...payment.paymentData, ...paymentData, verifiedAt: new Date() };
    await payment.save();

    // Check if this is a create-intent payment (has bookingIntent data)
    if (payment.bookingId === null && payment.paymentData && payment.paymentData.bookingIntent) {
      // This is a create-intent payment - create the booking now
      const bookingIntent = payment.paymentData.bookingIntent;
      const Booking = require('../models/Booking');
      const Service = require('../models/Service');

      // Double-check availability before creating booking
      const service = await Service.findById(bookingIntent.serviceId);
      if (!service) {
        return { success: false, error: 'Service not found' };
      }

      const bookingDateObj = new Date(bookingIntent.bookingDate);
      let isAvailable = true;

      if (service.category === 'equipment') {
        const existingBookings = await Booking.find({
          serviceId: bookingIntent.serviceId,
          bookingDate: {
            $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
            $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
          },
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] },
        });

        const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
        const availableQuantity = Math.max(0, service.quantity - totalBooked);

        if (availableQuantity < bookingIntent.quantity) {
          isAvailable = false;
        }
      } else {
        const existingBooking = await Booking.findOne({
          serviceId: bookingIntent.serviceId,
          bookingDate: {
            $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
            $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
          },
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] },
        });

        if (existingBooking) {
          isAvailable = false;
        }
      }

      if (!isAvailable) {
        return { success: false, error: 'Service is no longer available for the selected date and time.' };
      }

      // Create the actual booking now that payment is confirmed
      const booking = new Booking({
        customerId: payment.userId,
        serviceId: bookingIntent.serviceId,
        quantity: bookingIntent.quantity,
        bookingDate: new Date(bookingIntent.bookingDate),
        basePrice: service.basePrice,
        totalPrice: bookingIntent.totalPrice,
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentId: payment._id,
        notes: bookingIntent.notes,
      });

      await booking.save();
      await booking.populate('serviceId');
      await booking.populate('customerId', 'name email');

      // Update payment with booking reference
      payment.bookingId = booking._id;
      await payment.save();

      // Decrease inventory for equipment/supply items
      if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
        service.quantity = Math.max(0, service.quantity - bookingIntent.quantity);
        await service.save();
      }

      // Send confirmation notifications
      try {
        await sendTemplateNotification(payment.userId._id, 'BOOKING_CONFIRMED', {
          message: `Your booking for ${service.name} has been confirmed! Total amount: ₱${booking.totalPrice.toFixed(2)}`,
          metadata: {
            bookingId: booking._id,
            serviceId: service._id,
            amount: booking.totalPrice,
          }
        });

        // Admin notification
        const User = require('../models/User');
        const adminUsers = await User.find({ role: 'admin' });
        for (const admin of adminUsers) {
          await sendTemplateNotification(admin._id, 'NEW_BOOKING_ADMIN', {
            message: `New confirmed booking from customer for ${service.name}. Amount: ₱${booking.totalPrice.toFixed(2)}`,
            metadata: {
              bookingId: booking._id,
              serviceId: service._id,
              amount: booking.totalPrice,
            }
          });
        }

        // Emit real-time events
        const io = global.io;
        if (io) {
          io.to(`user_${payment.userId._id}`).emit('booking-confirmed', {
            booking: {
              id: booking._id,
              serviceName: service.name,
              quantity: bookingIntent.quantity,
              date: booking.bookingDate,
              totalPrice: booking.totalPrice,
              status: 'confirmed',
            }
          });

          io.to('admin').emit('new-confirmed-booking', {
            booking: {
              id: booking._id,
              serviceName: service.name,
              quantity: bookingIntent.quantity,
              date: booking.bookingDate,
              totalPrice: booking.totalPrice,
              status: 'confirmed',
            }
          });
        }
      } catch (notificationError) {
        console.error('Error sending booking confirmation notifications:', notificationError);
      }

      return {
        success: true,
        payment,
        booking: booking,
        message: `QR payment verified and booking confirmed`
      };
    }

    // Update the booking based on payment type (for existing bookings)
    const booking = payment.bookingId;
    if (booking) {
      // Update payment tracking - all payments are now full payments
      booking.amountPaid = payment.amount;
      booking.paymentType = 'full';

      // Full payment - booking is confirmed and fully paid
      booking.status = 'confirmed';
      booking.paymentStatus = 'paid';
      booking.remainingBalance = 0;

      await booking.save();

      // Send confirmation notifications
      try {
        await sendTemplateNotification(payment.userId._id, 'BOOKING_PAYMENT_CONFIRMED', {
          metadata: {
            bookingId: booking._id,
            serviceId: booking.serviceId,
            amount: payment.amount,
            paymentType: 'full',
            remainingBalance: 0,
          }
        });

        // Admin notification
        const User = require('../models/User');
        const adminUsers = await User.find({ role: 'admin' });

        for (const admin of adminUsers) {
          await sendTemplateNotification(admin._id, 'PAYMENT_RECEIVED_ADMIN', {
            metadata: {
              bookingId: booking._id,
              serviceId: booking.serviceId,
              amount: payment.amount,
              paymentType: 'full',
              remainingBalance: 0,
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