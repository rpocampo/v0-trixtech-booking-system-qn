const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { sendTemplateNotification } = require('./notificationService');
const { generateQRCodeDataURL, generatePaymentInstructions } = require('./qrCodeService');
const { getInventoryHealthReport, analyzeInventoryPatterns } = require('./inventoryAnalyticsService');

// Auto-update inventory reports after booking confirmation
const updateInventoryReports = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId).populate('serviceId');

    if (!booking || !booking.serviceId) {
      console.log('Booking or service not found for inventory report update');
      return;
    }

    const service = booking.serviceId;
    const servicesToUpdate = [];

    // Add main service if it's equipment or supply
    if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
      servicesToUpdate.push(service);
    }

    // Add included equipment items for any service that has includedEquipment
    if (service.includedEquipment && service.includedEquipment.length > 0) {
      for (const equipmentItem of service.includedEquipment) {
        try {
          const equipmentService = await require('../models/Service').findById(equipmentItem.equipmentId);
          if (equipmentService && (equipmentService.serviceType === 'equipment' || equipmentService.serviceType === 'supply')) {
            servicesToUpdate.push(equipmentService);
          }
        } catch (equipmentError) {
          console.error('Error fetching included equipment for reports:', equipmentError);
        }
      }
    }

    // Generate updated inventory health report
    const healthReport = await getInventoryHealthReport();

    // Update reports for all relevant services
    for (const serviceToUpdate of servicesToUpdate) {
      const serviceReport = healthReport.services.find(s => s.serviceId.toString() === serviceToUpdate._id.toString());

      if (serviceReport) {
        console.log(`Inventory report updated for ${serviceToUpdate.name}: ${serviceReport.healthStatus} (${serviceReport.currentStock} remaining, ${serviceReport.daysRemaining} days left)`);

        // Emit real-time update for admin dashboard
        const io = global.io;
        if (io) {
          io.to('admin').emit('inventory-report-updated', {
            serviceId: serviceToUpdate._id,
            serviceName: serviceToUpdate.name,
            currentStock: serviceReport.currentStock,
            healthStatus: serviceReport.healthStatus,
            daysRemaining: serviceReport.daysRemaining,
            recommendations: serviceReport.recommendations,
            bookingId: booking._id,
            bookingServiceName: service.name
          });
        }

        // Check if this service needs urgent attention
        if (serviceReport.healthStatus === 'critical' || serviceReport.healthStatus === 'out_of_stock') {
          // Send urgent notification to admins
          const User = require('../models/User');
          const adminUsers = await User.find({ role: 'admin' });

          for (const admin of adminUsers) {
            await sendTemplateNotification(admin._id, 'INVENTORY_CRITICAL', {
              message: `URGENT: ${serviceToUpdate.name} inventory is ${serviceReport.healthStatus.replace('_', ' ')}. Only ${serviceReport.currentStock} units remaining.`,
              metadata: {
                serviceId: serviceToUpdate._id,
                serviceName: serviceToUpdate.name,
                currentStock: serviceReport.currentStock,
                daysRemaining: serviceReport.daysRemaining,
                healthStatus: serviceReport.healthStatus,
                bookingId: booking._id,
                bookingServiceName: service.name
              }
            });
          }
        }
      }
    }

    // Log comprehensive inventory update
    console.log(`Inventory reports updated for booking ${bookingId}: ${servicesToUpdate.length} services monitored`);

  } catch (error) {
    console.error('Error updating inventory reports:', error);
  }
};

// Auto-generate invoice for completed booking
const generateInvoice = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('serviceId')
      .populate('customerId', 'name email')
      .populate('paymentId');

    if (!booking) {
      throw new Error('Booking not found');
    }

    const invoiceNumber = `INV-${Date.now()}-${booking._id.toString().slice(-6).toUpperCase()}`;

    // Create invoice data
    const invoiceData = {
      invoiceNumber,
      bookingId: booking._id,
      customerName: booking.customerId?.name || 'Customer',
      customerEmail: booking.customerId?.email || '',
      serviceName: booking.serviceId?.name || 'Service',
      serviceDescription: booking.serviceId?.description || '',
      quantity: booking.quantity || 1,
      unitPrice: booking.basePrice || 0,
      totalPrice: booking.totalPrice || 0,
      bookingDate: booking.bookingDate,
      paymentDate: booking.paymentId?.completedAt || new Date(),
      paymentMethod: booking.paymentId?.paymentMethod || 'GCash QR',
      transactionId: booking.paymentId?.transactionId || '',
      notes: booking.notes || '',
      generatedAt: new Date()
    };

    // Store invoice data in booking (you could also create a separate Invoice model)
    booking.invoiceNumber = invoiceNumber;
    booking.invoiceData = invoiceData;
    await booking.save();

    console.log(`Invoice generated: ${invoiceNumber} for booking ${bookingId}`);

    return {
      success: true,
      invoiceNumber,
      invoiceData
    };
  } catch (error) {
    console.error('Error generating invoice:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

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

    // Generate dynamic QR code with payment amount for GCash
    qrCodeDataURL = await generateQRCodeDataURL({
      amount,
      referenceNumber,
      merchantName: 'TRIXTECH',
      merchantId: 'TRIXTECH001',
      description: `Booking Payment - ${referenceNumber}`,
      userQRCode: user.gcashQRCode // Use user's personal GCash QR code if available
    });

    // Instructions for GCash QR code payment
    paymentInstructions = {
      title: 'Pay with GCash QR Code',
      instructions: [
        '1. Click the QR code below to open GCash directly with the correct payment amount, OR scan it with your GCash app',
        '2. If scanning: Open GCash and tap the QR scanner icon, then scan the QR code',
        '3. The payment amount (₱' + amount.toFixed(2) + ') will be automatically entered',
        '4. Add this reference in the message/notes: ' + referenceNumber,
        '5. Confirm and complete the payment, or use the test payment button below to simulate payment for testing',
        '6. The system will automatically detect your payment'
      ],
      amount,
      reference: referenceNumber,
      merchant: 'G** A** P.',
      note: `Click the QR code to open GCash with ₱${amount.toFixed(2)} pre-filled, or scan it manually. Include "${referenceNumber}" in the message/notes field for faster processing.`,
      qrData: '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWJXZR45204601653036085802PH5910G** A** P.6007NASUGBU610412346304CDAA' // The actual GCash QR data
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

    // Rollback inventory if this was a create-intent payment with a booking
    if (payment.bookingId === null && payment.paymentData && payment.paymentData.bookingIntent) {
      const bookingIntent = payment.paymentData.bookingIntent;
      const Service = require('../models/Service');

      // Restore inventory for equipment/supply items
      const service = await Service.findById(bookingIntent.serviceId);
      if (service && (service.serviceType === 'equipment' || service.serviceType === 'supply')) {
        service.quantity = Math.min(service.quantity + bookingIntent.quantity, service.quantity); // Restore quantity
        await service.save();
        console.log('Inventory restored after payment cancellation for service:', service.name);
      }

      // Restore inventory for included equipment in any service that has includedEquipment
      if (service && service.includedEquipment && service.includedEquipment.length > 0) {
        for (const equipmentItem of service.includedEquipment) {
          try {
            const equipmentService = await Service.findById(equipmentItem.equipmentId);
            if (equipmentService && (equipmentService.serviceType === 'equipment' || equipmentService.serviceType === 'supply')) {
              equipmentService.quantity = Math.min(equipmentService.quantity + equipmentItem.quantity, equipmentService.quantity);
              await equipmentService.save();
              console.log('Inventory restored for included equipment:', equipmentService.name);
            }
          } catch (equipmentError) {
            console.error('Error restoring equipment inventory:', equipmentError);
          }
        }
      }
    }

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

    // Update payment status - preserve receiptVerification data
    payment.status = 'completed';
    payment.completedAt = new Date();

    // Merge receiptVerification data - preserve existing data and merge with new data
    const existingReceiptVerification = payment.paymentData.receiptVerification || {};
    const newReceiptVerification = paymentData.receiptVerification || {};

    payment.paymentData = {
      ...payment.paymentData,
      ...paymentData,
      verifiedAt: new Date(),
      // Merge existing and new receiptVerification data
      receiptVerification: {
        ...existingReceiptVerification,
        ...newReceiptVerification
      }
    };

    await payment.save();

    // Check if this is a cart payment with bookingIntents
    if (payment.bookingId === null && payment.paymentData && payment.paymentData.cartPayment && payment.paymentData.bookingIntents) {
      // This is a cart payment - create bookings for all intents
      const bookingIntents = payment.paymentData.bookingIntents;
      const Booking = require('../models/Booking');
      const Service = require('../models/Service');
      const Package = require('../models/Package');

      const createdBookings = [];
      let totalBookingsCreated = 0;

      for (const intent of bookingIntents) {
        try {
          let service, packageBooking = null;

          // Handle package bookings
          if (intent.isPackage && intent.packageId) {
            const pkg = await Package.findById(intent.packageId);
            if (!pkg) {
              console.error(`Package not found: ${intent.packageId}`);
              continue;
            }

            // Create package booking using the booking route logic
            const packageResult = await require('../routes/bookingRoutes').createPackageBooking(payment.userId._id, intent, payment._id);
            if (packageResult.success) {
              createdBookings.push(packageResult.booking);
              totalBookingsCreated++;
              continue;
            } else {
              console.error(`Failed to create package booking: ${packageResult.error}`);
              continue;
            }
          }

          // Handle individual service bookings
          service = await Service.findById(intent.serviceId);
          if (!service) {
            console.error(`Service not found: ${intent.serviceId}`);
            continue;
          }

          const bookingDateObj = new Date(intent.bookingDate);

          // Double-check availability before creating booking
          let isAvailable = true;

          if (service.category === 'equipment') {
            const existingBookings = await Booking.find({
              serviceId: intent.serviceId,
              bookingDate: {
                $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
                $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
              },
              status: 'confirmed',
              paymentStatus: { $in: ['partial', 'paid'] },
            });

            const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
            const availableQuantity = Math.max(0, service.quantity - totalBooked);

            if (availableQuantity < intent.quantity) {
              isAvailable = false;
            }
          } else {
            const existingBooking = await Booking.findOne({
              serviceId: intent.serviceId,
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
            console.error(`Service ${service.name} is no longer available for booking intent`);
            continue;
          }

          // Calculate dynamic price
          const daysBeforeCheckout = Math.max(0, Math.ceil((bookingDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
          const calculatedPrice = service.calculatePrice(daysBeforeCheckout);
          const appliedMultiplier = service.basePrice > 0 ? calculatedPrice / service.basePrice : 1.0;

          // Create the booking
          const booking = new Booking({
            customerId: payment.userId,
            serviceId: intent.serviceId,
            quantity: intent.quantity,
            bookingDate: bookingDateObj,
            basePrice: service.basePrice,
            appliedMultiplier,
            daysBeforeCheckout,
            totalPrice: intent.totalPrice,
            status: 'confirmed',
            paymentStatus: 'paid',
            paymentId: payment._id,
            notes: intent.notes || '',
            requiresDelivery: service.deliveryRequired || false,
          });

          await booking.save();
          await booking.populate('serviceId');
          await booking.populate('customerId', 'name email');

          createdBookings.push(booking);
          totalBookingsCreated++;

          // Decrease inventory for equipment/supply items
          if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
            const previousStock = service.quantity;
            await service.reduceBatchQuantity(intent.quantity);
            const newStock = service.quantity;

            // Log inventory transaction
            const InventoryTransaction = require('../models/InventoryTransaction');
            await InventoryTransaction.logTransaction({
              serviceId: intent.serviceId,
              bookingId: booking._id,
              transactionType: 'booking_deduction',
              quantity: -intent.quantity,
              previousStock,
              newStock,
              reason: `Cart payment booking deduction for service: ${service.name}`,
              metadata: {
                customerId: payment.userId._id,
                bookingDate: bookingDateObj,
                paymentId: payment._id,
              }
            });
          }

          // Decrease inventory for included equipment
          if (service.includedEquipment && service.includedEquipment.length > 0) {
            for (const equipmentItem of service.includedEquipment) {
              try {
                const equipmentService = await Service.findById(equipmentItem.equipmentId);
                if (equipmentService && (equipmentService.serviceType === 'equipment' || equipmentService.serviceType === 'supply')) {
                  const previousStock = equipmentService.quantity;
                  await equipmentService.reduceBatchQuantity(equipmentItem.quantity);
                  const newStock = equipmentService.quantity;

                  const InventoryTransaction = require('../models/InventoryTransaction');
                  await InventoryTransaction.logTransaction({
                    serviceId: equipmentItem.equipmentId,
                    bookingId: booking._id,
                    transactionType: 'booking_deduction',
                    quantity: -equipmentItem.quantity,
                    previousStock,
                    newStock,
                    reason: `Cart payment included equipment deduction: ${equipmentService.name}`,
                    metadata: {
                      customerId: payment.userId._id,
                      bookingDate: bookingDateObj,
                      mainServiceId: intent.serviceId,
                      paymentId: payment._id,
                    }
                  });
                }
              } catch (equipmentError) {
                console.error('Error deducting included equipment inventory:', equipmentError);
              }
            }
          }

          // Generate invoice for this booking
          try {
            const invoiceResult = await generateInvoice(booking._id);
            if (invoiceResult.success) {
              console.log(`Invoice ${invoiceResult.invoiceNumber} generated for cart booking ${booking._id}`);
            }
          } catch (invoiceError) {
            console.error('Error generating invoice for cart booking:', invoiceError);
          }

        } catch (intentError) {
          console.error(`Error processing booking intent:`, intentError);
          continue;
        }
      }

      if (createdBookings.length === 0) {
        return { success: false, error: 'No bookings could be created from the cart payment' };
      }

      // Send confirmation notifications for all bookings
      try {
        const totalAmount = createdBookings.reduce((sum, booking) => sum + booking.totalPrice, 0);

        await sendTemplateNotification(payment.userId._id, 'BOOKING_CONFIRMED', {
          message: `Your cart booking has been confirmed! ${createdBookings.length} item(s) booked for a total of ₱${totalAmount.toFixed(2)}`,
          metadata: {
            bookingIds: createdBookings.map(b => b._id),
            totalAmount,
            itemCount: createdBookings.length,
          }
        });

        // Admin notification
        const User = require('../models/User');
        const adminUsers = await User.find({ role: 'admin' });
        for (const admin of adminUsers) {
          await sendTemplateNotification(admin._id, 'NEW_BOOKING_ADMIN', {
            message: `New cart booking confirmed: ${createdBookings.length} item(s) for ₱${totalAmount.toFixed(2)}`,
            metadata: {
              bookingIds: createdBookings.map(b => b._id),
              totalAmount,
              itemCount: createdBookings.length,
            }
          });
        }

        // Emit real-time events
        const io = global.io;
        if (io) {
          io.to(`user_${payment.userId._id}`).emit('cart-booking-confirmed', {
            bookings: createdBookings.map(booking => ({
              id: booking._id,
              serviceName: booking.serviceId?.name || 'Service',
              quantity: booking.quantity,
              date: booking.bookingDate,
              totalPrice: booking.totalPrice,
              status: 'confirmed',
            })),
            totalAmount,
          });

          io.to('admin').emit('new-cart-booking', {
            bookings: createdBookings.map(booking => ({
              id: booking._id,
              serviceName: booking.serviceId?.name || 'Service',
              quantity: booking.quantity,
              date: booking.bookingDate,
              totalPrice: booking.totalPrice,
              status: 'confirmed',
            })),
            totalAmount,
          });
        }
      } catch (notificationError) {
        console.error('Error sending cart booking confirmation notifications:', notificationError);
      }

      return {
        success: true,
        payment,
        bookings: createdBookings,
        message: `Cart payment verified and ${createdBookings.length} booking(s) confirmed`
      };
    }

    // Check if this is a create-intent payment (has bookingIntent data) - legacy single booking
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
        // Send payment failed notification due to unavailability
        try {
          await sendTemplateNotification(payment.userId._id, 'PAYMENT_FAILED', {
            message: `Your payment for ${service.name} could not be processed because the service is no longer available.`,
            metadata: {
              bookingId: null,
              serviceId: service._id,
              amount: payment.amount,
              reason: 'Service no longer available',
            },
          });
        } catch (notificationError) {
          console.error('Error sending payment failed notification:', notificationError);
        }

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

      // Generate invoice automatically
      try {
        const invoiceResult = await generateInvoice(booking._id);
        if (invoiceResult.success) {
          console.log(`Invoice ${invoiceResult.invoiceNumber} generated for booking ${booking._id}`);
        }
      } catch (invoiceError) {
        console.error('Error generating invoice:', invoiceError);
        // Don't fail booking confirmation if invoice generation fails
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

      // Auto-generate and send invoice
      try {
        const { handleBookingConfirmed } = require('./invoiceService');
        await handleBookingConfirmed(booking._id);
      } catch (invoiceError) {
        console.error('Error in auto-invoice generation:', invoiceError);
        // Don't fail the booking if invoice generation fails
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
  generateInvoice,
};