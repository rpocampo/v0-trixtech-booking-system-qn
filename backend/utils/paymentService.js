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

    if (user.gcashQRCode) {
      // Use user's personal GCash QR code data directly
      // Instead of generating a QR code, return the raw data for the frontend to handle
      qrCodeDataURL = user.gcashQRCode; // Return the raw QR data string

      // Custom instructions for personal QR code
      paymentInstructions = {
        title: 'Pay with GCash QR Code',
        instructions: [
          '1. Open your GCash app',
          '2. Tap the QR scanner icon or select "Pay QR"',
          '3. Scan the QR code shown below',
          '4. Verify the amount and recipient details',
          '5. Confirm and complete the payment',
          '6. The system will automatically detect your payment'
        ],
        amount,
        reference: referenceNumber,
        merchant: user.name,
        note: `Please send exactly ₱${amount.toFixed(2)} to complete your booking payment. Include "${referenceNumber}" in the message/notes field for faster processing.`,
        qrData: user.gcashQRCode // Include the raw QR data for frontend
      };
    } else {
      // Generate dynamic QR code (fallback)
      const paymentDescription = `Payment - ${transactionId}`;

      const qrData = {
        amount,
        referenceNumber,
        merchantName: 'TRIXTECH',
        merchantId: 'TRIXTECH001',
        description: paymentDescription,
        paymentId: payment._id.toString(),
        callbackUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payments/verify-qr/${referenceNumber}`
      };

      qrCodeDataURL = await generateQRCodeDataURL(qrData);
      paymentInstructions = generatePaymentInstructions(qrData);
    }

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
    payment.status = 'paid';
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