const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const ReservationQueue = require('../models/ReservationQueue');
const BookingAnalytics = require('../models/BookingAnalytics');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendBookingConfirmation, sendAdminBookingNotification, sendLowStockAlert } = require('../utils/emailService');
const { sendTemplateNotification } = require('../utils/notificationService');
const { findAlternativeServices, processReservationQueue } = require('../utils/recommendationService');
const { triggerLowStockCheck } = require('../utils/lowStockAlertService');
const lockService = require('../utils/lockService');

const router = express.Router();

// Check availability for a service at specific date/time
router.get('/check-availability/:serviceId', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { date, quantity = 1, deliveryTime } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const requestedQuantity = parseInt(quantity) || 1;
    const bookingDate = new Date(date);

    // Check if date is in the past
    if (bookingDate < new Date()) {
      return res.json({
        success: true,
        available: false,
        reason: 'Cannot book dates in the past',
        availableQuantity: 0
      });
    }

    // Generate lock key for this availability check
    const lockKey = lockService.generateBookingLockKey(serviceId, date);
    const lockOwner = `check-${req.user.id}-${Date.now()}`;

    // Use distributed locking to prevent race conditions
    const result = await lockService.withLock(lockKey, lockOwner, async () => {
      let isAvailable = true;
      let availableQuantity = service.quantity || 1;
      let reason = '';
      let deliveryTruckAvailable = true;
      let deliveryTruckReason = '';
      let nextAvailableDeliveryTime = null;

      // Import delivery service
      const { requiresDeliveryTruck, checkDeliveryTruckAvailability } = require('../utils/deliveryService');

      // Check delivery truck availability if service requires delivery
      const serviceRequiresDelivery = requiresDeliveryTruck(service);
      if (serviceRequiresDelivery && deliveryTime) {
        const deliveryDateTime = new Date(`${date}T${deliveryTime}`);
        const deliveryCheck = await checkDeliveryTruckAvailability(deliveryDateTime, 60); // 60 minutes default

        deliveryTruckAvailable = deliveryCheck.available;
        if (!deliveryTruckAvailable) {
          deliveryTruckReason = deliveryCheck.reason;
          nextAvailableDeliveryTime = deliveryCheck.nextAvailableTime;
        }
      }

      if (service.category === 'equipment') {
        // For equipment, check total booked quantity on this date (only paid bookings)
        const existingBookings = await Booking.find({
          serviceId,
          bookingDate: {
            $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
            $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
          },
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] },
        });

        const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
        availableQuantity = Math.max(0, service.quantity - totalBooked);

        if (availableQuantity < requestedQuantity) {
          isAvailable = false;
          reason = `Only ${availableQuantity} items available for this date`;
        }
      } else {
        // For services, check if any booking exists on this date (only paid bookings)
        const existingBooking = await Booking.findOne({
          serviceId,
          bookingDate: {
            $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
            $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
          },
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] },
        });

        if (existingBooking) {
          isAvailable = false;
          availableQuantity = 0;
          reason = 'This service is already booked for this date';
        }
      }

      // Overall availability combines service availability and delivery truck availability
      const overallAvailable = isAvailable && deliveryTruckAvailable;
      const finalReason = !overallAvailable
        ? (!deliveryTruckAvailable ? deliveryTruckReason : reason)
        : '';

      return {
        success: true,
        available: overallAvailable,
        availableQuantity,
        requestedQuantity,
        reason: finalReason,
        serviceName: service.name,
        maxQuantity: service.quantity || 1,
        requiresDelivery: serviceRequiresDelivery,
        deliveryTruckAvailable,
        deliveryTruckReason: deliveryTruckReason || null,
        nextAvailableDeliveryTime,
        deliveryTime: deliveryTime || null
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create booking (customers only)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId, quantity, bookingDate, notes, deliveryTime } = req.body;

    if (!serviceId || !bookingDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const requestedQuantity = quantity || 1;
    const bookingDateObj = new Date(bookingDate);

    // Import delivery service
    const { requiresDeliveryTruck, checkDeliveryTruckAvailability } = require('../utils/deliveryService');
    const serviceRequiresDelivery = requiresDeliveryTruck(service);

    // Check delivery truck availability if service requires delivery
    if (serviceRequiresDelivery && deliveryTime) {
      const deliveryDateTime = new Date(`${bookingDate}T${deliveryTime}`);
      const deliveryCheck = await checkDeliveryTruckAvailability(deliveryDateTime, 60); // 60 minutes default

      if (!deliveryCheck.available) {
        return res.status(409).json({
          success: false,
          message: deliveryCheck.reason,
          deliveryTruckConflict: true,
          nextAvailableTime: deliveryCheck.nextAvailableTime,
          conflictingBookings: deliveryCheck.conflictingBookings
        });
      }
    }

    // Check available quantity
    if (service.quantity !== undefined && service.quantity < requestedQuantity) {
      return res.status(409).json({
        success: false,
        message: `Only ${service.quantity} items available. Requested: ${requestedQuantity}`
      });
    }

    // Check availability
    let isAvailable = true;
    let availableQuantity = service.quantity || 1;

    if (service.category === 'equipment') {
      const existingBookings = await Booking.find({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
          $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
        },
        status: { $in: ['pending', 'confirmed'] },
      });

      const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
      availableQuantity = Math.max(0, service.quantity - totalBooked);

      if (availableQuantity < requestedQuantity) {
        isAvailable = false;
      }
    } else {
      // For non-equipment services, check for existing booking on the same day
      const existingBooking = await Booking.findOne({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
          $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
        },
        status: { $in: ['pending', 'confirmed'] },
      });

      if (existingBooking) {
        isAvailable = false;
        availableQuantity = 0;
      }
    }

    if (isAvailable) {
      // Use distributed locking for the booking creation process
      const bookingLockKey = lockService.generateBookingLockKey(serviceId, bookingDateObj.toISOString().split('T')[0]);
      const bookingLockOwner = `book-${req.user.id}-${Date.now()}`;

      const bookingResult = await lockService.withLock(bookingLockKey, bookingLockOwner, async () => {
        // Double-check availability right before creating booking
        let finalAvailable = true;
        let finalAvailableQuantity = service.quantity || 1;

        if (service.category === 'equipment') {
          const existingBookings = await Booking.find({
            serviceId,
            bookingDate: {
              $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
              $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
            },
            status: 'confirmed',
            paymentStatus: { $in: ['partial', 'paid'] },
          });

          const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
          finalAvailableQuantity = Math.max(0, service.quantity - totalBooked);

          if (finalAvailableQuantity < requestedQuantity) {
            finalAvailable = false;
          }
        } else {
          const existingBooking = await Booking.findOne({
            serviceId,
            bookingDate: {
              $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
              $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
            },
            status: 'confirmed',
            paymentStatus: { $in: ['partial', 'paid'] },
          });

          if (existingBooking) {
            finalAvailable = false;
            finalAvailableQuantity = 0;
          }
        }

        if (!finalAvailable) {
          // Add to reservation queue instead
          const alternatives = await findAlternativeServices(serviceId, new Date(bookingDate), requestedQuantity);

          const queueEntry = new ReservationQueue({
            customerId: req.user.id,
            serviceId,
            requestedQuantity,
            bookingDate: new Date(bookingDate),
            notes,
            alternativeSuggestions: alternatives.map(alt => ({
              serviceId: alt.serviceId,
              reason: alt.reason,
              availability: alt.availableQuantity,
            })),
          });

          await queueEntry.save();

          return {
            queued: true,
            queueId: queueEntry._id,
            alternatives: alternatives.slice(0, 3),
            message: 'Item became unavailable during booking. Added to reservation queue.'
          };
        }

        // Validate service has pricing information
        if (!service.basePrice || service.basePrice <= 0 || isNaN(service.basePrice)) {
          throw new Error(`Service "${service.name}" has invalid pricing (₱${service.basePrice}). Please contact support or try a different service.`);
        }

        // Calculate dynamic price based on days before checkout
        const bookingDateTime = new Date(bookingDate);
        const now = new Date();
        const daysBeforeCheckout = Math.ceil((bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const calculatedPrice = service.calculatePrice(Math.max(0, daysBeforeCheckout));

        // Ensure calculated price is valid
        if (!calculatedPrice || isNaN(calculatedPrice) || calculatedPrice <= 0) {
          throw new Error('Unable to calculate service price. Please try again or contact support.');
        }

        const totalPrice = calculatedPrice * requestedQuantity;

        // Ensure total price is valid
        if (isNaN(totalPrice) || totalPrice <= 0) {
          throw new Error('Invalid total price calculation. Please contact support.');
        }

        // Calculate applied multiplier safely
        const appliedMultiplier = service.basePrice > 0 ? calculatedPrice / service.basePrice : 1.0;

        // Create booking with pending status (will be confirmed after payment)
        const bookingData = {
          customerId: req.user.id,
          serviceId,
          quantity: requestedQuantity,
          bookingDate: bookingDateTime,
          totalPrice,
          basePrice: service.basePrice,
          appliedMultiplier,
          daysBeforeCheckout: Math.max(0, daysBeforeCheckout),
          status: 'pending', // Changed from 'confirmed' to 'pending'
          paymentStatus: 'unpaid', // Explicitly set payment status
          paymentType: 'full', // Default to full payment
          amountPaid: 0,
          remainingBalance: totalPrice,
          downPaymentPercentage: 30, // Default 30%
          notes,
          requiresDelivery: serviceRequiresDelivery,
        };

        // Add delivery time fields if service requires delivery
        if (serviceRequiresDelivery) {
          let deliveryStartTime;
          if (deliveryTime) {
            // Use provided delivery time
            deliveryStartTime = new Date(`${bookingDate}T${deliveryTime}`);
          } else {
            // Auto-set delivery time to booking date/time if not provided
            deliveryStartTime = new Date(bookingDate);
          }
          bookingData.deliveryStartTime = deliveryStartTime;
          bookingData.deliveryEndTime = new Date(deliveryStartTime.getTime() + 60 * 60 * 1000); // 1 hour duration
          bookingData.deliveryDuration = 60; // 1 hour
          bookingData.requiresDelivery = true; // Ensure requiresDelivery is set
        }

        // Create booking (without transaction for standalone MongoDB)
        let booking;
        try {
          booking = new Booking(bookingData);
          await booking.save();

          // Decrease inventory if it's equipment or supply
          if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
            // Use batch tracking for inventory reduction (FIFO)
            await service.reduceBatchQuantity(requestedQuantity);

            // Trigger low stock alert check
            try {
              await triggerLowStockCheck(serviceId);
            } catch (alertError) {
              console.error('Error triggering low stock alert:', alertError);
              // Don't fail the booking if alert fails
            }
          }

          // Decrease inventory for included equipment in professional services
          if (service.serviceType === 'service' && service.includedEquipment && service.includedEquipment.length > 0) {
            for (const equipmentItem of service.includedEquipment) {
              try {
                const equipmentService = await Service.findById(equipmentItem.equipmentId);
                if (equipmentService && (equipmentService.serviceType === 'equipment' || equipmentService.serviceType === 'supply')) {
                  // Use batch tracking for inventory reduction (FIFO)
                  await equipmentService.reduceBatchQuantity(equipmentItem.quantity);

                  // Trigger low stock alert check for equipment
                  try {
                    await triggerLowStockCheck(equipmentItem.equipmentId);
                  } catch (alertError) {
                    console.error('Error triggering low stock alert for equipment:', alertError);
                    // Don't fail the booking if alert fails
                  }
                }
              } catch (equipmentError) {
                console.error('Error reducing equipment inventory:', equipmentError);
                // Don't fail the booking if equipment inventory reduction fails
              }
            }
          }

          console.log('Booking and inventory update completed');

        } catch (bookingError) {
          console.error('Booking creation failed:', bookingError);
          throw bookingError; // Re-throw to be caught by outer catch
        }

        await booking.populate('serviceId');
        await booking.populate('customerId', 'name email');

        // Send pending booking notification
                try {
                  // Customer notification for pending booking
                  await sendTemplateNotification(req.user.id, 'BOOKING_PENDING', {
                    message: `Your booking for ${service.name} has been created and is pending payment.`,
                    metadata: {
                      bookingId: booking._id,
                      serviceId: service._id,
                      amount: booking.totalPrice,
                    },
                  });

                  // Admin notification for new pending booking
                  const adminUsers = await User.find({ role: 'admin' });
                  console.log('Found admin users for pending booking notification:', adminUsers.length);

                  for (const admin of adminUsers) {
                    console.log('Sending pending booking notification to admin:', admin._id);
                    await sendTemplateNotification(admin._id, 'NEW_PENDING_BOOKING_ADMIN', {
                      message: `New pending booking received from customer for ${service.name}.`,
                      metadata: {
                        bookingId: booking._id,
                        serviceId: service._id,
                        amount: booking.totalPrice,
                      },
                    });
                    console.log('Admin pending booking notification sent successfully');
                  }

          // Emit real-time events for pending booking
          const io = global.io;
          if (io) {
            io.to(`user_${req.user.id}`).emit('booking-created', {
              booking: {
                id: booking._id,
                serviceName: service.name,
                quantity: requestedQuantity,
                date: booking.bookingDate,
                totalPrice: booking.totalPrice,
                status: 'pending',
              }
            });

            io.to('admin').emit('new-pending-booking', {
              booking: {
                id: booking._id,
                serviceName: service.name,
                quantity: requestedQuantity,
                date: booking.bookingDate,
                totalPrice: booking.totalPrice,
                status: 'pending',
              }
            });
          }
        } catch (notificationError) {
          console.error('Error sending pending booking notifications:', notificationError);
        }

        return {
          success: true,
          booking,
          requiresPayment: true,
          message: 'Booking created. Please complete payment to confirm.'
        };
      });

      // Handle the result from the lock operation
      if (bookingResult.queued) {
        return res.status(202).json({
          success: true,
          queued: true,
          queueId: bookingResult.queueId,
          alternatives: bookingResult.alternatives,
          message: bookingResult.message
        });
      } else {
        return res.status(200).json(bookingResult);
      }
    } else {
      // Add to reservation queue when not available
      // Add to reservation queue
      const alternatives = await findAlternativeServices(serviceId, new Date(bookingDate), requestedQuantity);

      const queueEntry = new ReservationQueue({
        customerId: req.user.id,
        serviceId,
        requestedQuantity,
        bookingDate: new Date(bookingDate),
        notes,
        alternativeSuggestions: alternatives.map(alt => ({
          serviceId: alt.serviceId,
          reason: alt.reason,
          availability: alt.availableQuantity,
        })),
      });

      await queueEntry.save();

      // Send notification about queue placement
      await sendTemplateNotification(req.user.id, 'BOOKING_QUEUED', {
        message: `Your requested ${service.name} is currently unavailable. You've been added to the reservation queue.`,
        metadata: {
          serviceId: service._id,
          requestedQuantity,
          alternativesCount: alternatives.length,
        },
      });

      // Send email with alternatives
      const customer = await User.findById(req.user.id);
      if (customer) {
        // Custom email for queued reservations
        const mailOptions = {
          from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
          to: customer.email,
          subject: 'Reservation Queued - TRIXTECH',
          html: `
            <h2>Your Reservation Has Been Queued</h2>
            <p>Dear ${customer.name},</p>
            <p>Your requested booking for <strong>${service.name}</strong> is currently unavailable for the selected date.</p>
            <p>You've been added to our reservation queue with first-come, first-served priority.</p>
            <p><strong>Requested:</strong> ${requestedQuantity} ${service.category === 'equipment' ? 'items' : 'service'}</p>
            <p><strong>Date:</strong> ${new Date(bookingDate).toLocaleDateString()}</p>

            ${alternatives.length > 0 ? `
            <h3>Alternative Options Available:</h3>
            <ul>
              ${alternatives.map(alt => `
                <li>
                  <strong>${alt.name}</strong> - ₱${alt.price}
                  ${alt.isAvailable ? '<span style="color: green;">(Available)</span>' : '<span style="color: red;">(Limited)</span>'}
                  <br><small>${alt.reason}</small>
                </li>
              `).join('')}
            </ul>
            ` : ''}

            <p>We'll notify you immediately when your reservation becomes available!</p>
            <p>Thank you for your patience.</p>
          `,
        };

        try {
          const transporter = require('../utils/emailService').transporter;
          if (transporter) {
            await transporter.sendMail(mailOptions);
          }
        } catch (emailError) {
          console.error('Error sending queue email:', emailError);
        }
      }

      res.status(202).json({
        success: true,
        queued: true,
        queueId: queueEntry._id,
        alternatives: alternatives.slice(0, 3),
        message: 'Item currently unavailable. Added to reservation queue with first-come, first-served priority.'
      });
    }
  } catch (error) {
    next(error);
  }
});



// Get delivery schedules for customer (shows customer's own delivery bookings)
router.get('/delivery-schedules', authMiddleware, async (req, res, next) => {
  try {
    const { date } = req.query;
    const { getDeliverySchedules } = require('../utils/deliveryService');

    // Get all delivery schedules for the date
    const allSchedules = await getDeliverySchedules(date ? new Date(date) : null);

    // Filter to only show customer's own bookings
    const customerSchedules = allSchedules.filter(schedule =>
      schedule.customerEmail === req.user.email
    );

    res.json({
      success: true,
      schedules: customerSchedules,
      total: customerSchedules.length
    });

  } catch (error) {
    next(error);
  }
});

// Get single booking by ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('serviceId')
      .populate('customerId', 'name email');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if user owns this booking or is admin
    // Handle case where customerId might be null (user deleted or populate failed)
    const bookingOwnerId = booking.customerId ? booking.customerId._id?.toString() : null;
    const isOwner = bookingOwnerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isDeletedUserBooking = bookingOwnerId === null; // User was deleted

    if (!isOwner && !isAdmin && !isDeletedUserBooking) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // If user was deleted, only allow admin access
    if (isDeletedUserBooking && !isAdmin) {
      return res.status(403).json({ success: false, message: 'This booking is no longer accessible' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
});

// Get user bookings
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ customerId: req.user.id })
      .populate('serviceId')
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
});

// Get all bookings (admin only) - only show paid/partial bookings for transactions
router.get('/admin/all', adminMiddleware, async (req, res, next) => {
  try {
    const { limit, includeUnpaid } = req.query;
    const limitNum = limit ? parseInt(limit) : undefined;

    let query = Booking.find()
      .populate('serviceId')
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 });

    // Only show paid or partially paid bookings unless explicitly requested
    if (!includeUnpaid) {
      query = query.where('paymentStatus').in(['partial', 'paid']);
    }

    // Get total count before applying limit
    const totalCount = await Booking.countDocuments(query.getFilter());

    if (limitNum) {
      query = query.limit(limitNum);
    }

    const bookings = await query;

    res.json({ success: true, bookings, total: totalCount });
  } catch (error) {
    next(error);
  }
});

// Update booking status (admin only)
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const { status, paymentStatus } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, paymentStatus },
      { new: true }
    ).populate('serviceId').populate('customerId');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Send notifications based on status change
    try {
      if (status === 'completed') {
        // Notify customer that booking is completed
        await sendTemplateNotification(booking.customerId._id, 'BOOKING_COMPLETED', {
          message: `Your booking for ${booking.serviceId.name} has been completed successfully.`,
          metadata: {
            bookingId: booking._id,
            serviceId: booking.serviceId._id,
            amount: booking.totalPrice,
          },
        });

        // Send completion email to customer
        const customer = await User.findById(booking.customerId._id);
        if (customer) {
          await sendBookingConfirmation(customer.email, {
            serviceName: booking.serviceId.name,
            quantity: booking.quantity,
            date: booking.bookingDate,
            time: new Date(booking.bookingDate).toLocaleTimeString(),
            totalPrice: booking.totalPrice,
          });
        }
      }

      // Emit real-time event for status update
      const io = global.io;
      if (io && booking.customerId) {
        io.to(`user_${booking.customerId._id}`).emit('booking-updated', {
          booking: {
            id: booking._id,
            serviceName: booking.serviceId.name,
            status: booking.status,
            date: booking.bookingDate,
          }
        });
      }
    } catch (notificationError) {
      console.error('Error sending status update notifications:', notificationError);
      // Don't fail the booking update if notifications fail
    }

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
});

// Cancel booking
router.put('/:id/cancel', authMiddleware, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.customerId && booking.customerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
});

// Create booking intent (payment-first approach)
router.post('/create-intent', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId, quantity, bookingDate, notes, duration, dailyRate } = req.body;

    if (!serviceId || !bookingDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const requestedQuantity = quantity || 1;
    const bookingDateObj = new Date(bookingDate);

    // Check available quantity
    if (service.quantity !== undefined && service.quantity < requestedQuantity) {
      return res.status(409).json({
        success: false,
        message: `Only ${service.quantity} items available. Requested: ${requestedQuantity}`
      });
    }

    // Check availability (only check confirmed bookings since we're payment-first)
    let isAvailable = true;
    let availableQuantity = service.quantity || 1;

    if (service.category === 'equipment') {
      const existingBookings = await Booking.find({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
          $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
        },
        status: 'confirmed', // Only confirmed bookings block availability
      });

      const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
      availableQuantity = Math.max(0, service.quantity - totalBooked);

      if (availableQuantity < requestedQuantity) {
        isAvailable = false;
      }
    } else {
      // For non-equipment services, check for existing booking on the same day
      const existingBooking = await Booking.findOne({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate()),
          $lt: new Date(bookingDateObj.getFullYear(), bookingDateObj.getMonth(), bookingDateObj.getDate() + 1)
        },
        status: 'confirmed', // Only confirmed bookings block availability
      });

      if (existingBooking) {
        isAvailable = false;
        availableQuantity = 0;
      }
    }

    if (!isAvailable) {
      // Add to reservation queue
      const alternatives = await findAlternativeServices(serviceId, new Date(bookingDate), requestedQuantity);

      const queueEntry = new ReservationQueue({
        customerId: req.user.id,
        serviceId,
        requestedQuantity,
        bookingDate: new Date(bookingDate),
        notes,
        alternativeSuggestions: alternatives.map(alt => ({
          serviceId: alt.serviceId,
          reason: alt.reason,
          availability: alt.availableQuantity,
        })),
      });

      await queueEntry.save();

      return res.status(202).json({
        success: true,
        queued: true,
        queueId: queueEntry._id,
        alternatives: alternatives.slice(0, 3),
        message: 'Item currently unavailable. Added to reservation queue with first-come, first-served priority.'
      });
    }

    // Calculate price using duration-based pricing
    const durationDays = duration || 1;
    const dailyRateValue = dailyRate || service.basePrice || service.price || 0;
    const totalPrice = dailyRateValue * durationDays * requestedQuantity;

    // Create booking intent (temporary, not saved to database yet)
    const bookingIntent = {
      customerId: req.user.id,
      serviceId: service._id,
      quantity: requestedQuantity,
      bookingDate: new Date(bookingDate),
      totalPrice,
      notes,
      duration: durationDays,
      dailyRate: dailyRateValue,
      service: {
        name: service.name,
        category: service.category,
        price: dailyRateValue
      }
    };

    // Create payment record for the intent
    const Payment = require('../models/Payment');
    const { generateTransactionId, generateReferenceNumber } = require('../utils/paymentService');

    const transactionId = generateTransactionId();
    const referenceNumber = generateReferenceNumber();

    // Create payment record
    const payment = new Payment({
      bookingId: null, // Will be set when booking is confirmed
      userId: req.user.id,
      amount: bookingIntent.totalPrice,
      paymentMethod: 'gcash_qr',
      paymentProvider: 'gcash_qr',
      transactionId,
      referenceNumber,
      status: 'pending',
      paymentType: 'full', // Default to full payment
      isDownPayment: false,
      isFinalPayment: true,
      paymentData: {
        createdAt: new Date(),
        qrGenerated: true,
        referenceNumber,
        usesUserQR: false, // Intent doesn't use user QR
        bookingIntent: bookingIntent // Store the intent data
      }
    });

    await payment.save();

    // Generate payment QR code data
    const { generateQRCodeDataURL, generatePaymentInstructions } = require('../utils/qrCodeService');

    // Generate QR code data
    const paymentDescription = `Full Payment - ${transactionId}`;

    const qrData = {
      amount: bookingIntent.totalPrice,
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

    res.status(200).json({
      success: true,
      bookingIntent,
      payment: {
        qrCode,
        instructions,
        referenceNumber,
        transactionId,
        paymentId: payment._id,
      },
      message: 'Payment required. Complete payment to confirm booking.'
    });

  } catch (error) {
    console.error('Error creating booking intent:', error);
    next(error);
  }
});

// Confirm booking after successful payment
router.post('/confirm', authMiddleware, async (req, res, next) => {
  try {
    const { paymentReference, bookingIntent } = req.body;

    if (!paymentReference || !bookingIntent) {
      return res.status(400).json({ success: false, message: 'Missing payment reference or booking intent' });
    }

    // Find the payment record (it should exist from create-intent)
    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({
      referenceNumber: paymentReference,
      userId: req.user.id
    });

    if (!payment) {
      return res.status(400).json({ success: false, message: 'Payment not found' });
    }

    // Check if payment is already completed
    if (payment.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Payment already processed' });
    }

    // Mark payment as completed (this would normally be done by GCash callback)
    payment.status = 'completed';
    payment.completedAt = new Date();
    await payment.save();

    // Double-check availability before creating booking
    const service = await Service.findById(bookingIntent.serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
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
      });

      if (existingBooking) {
        isAvailable = false;
      }
    }

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: 'Service is no longer available for the selected date and time.'
      });
    }

    // Create the actual booking now that payment is confirmed
    const bookingData = {
      customerId: req.user.id,
      serviceId: bookingIntent.serviceId,
      quantity: bookingIntent.quantity,
      bookingDate: new Date(bookingIntent.bookingDate),
      totalPrice: bookingIntent.totalPrice,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentId: payment._id,
      notes: bookingIntent.notes,
      duration: bookingIntent.duration,
      dailyRate: bookingIntent.dailyRate,
    };

    // Check if service requires delivery and set delivery fields
    const bookingService = await Service.findById(bookingIntent.serviceId);
    if (bookingService) {
      const serviceRequiresDelivery = requiresDeliveryTruck(bookingService);
      if (serviceRequiresDelivery) {
        // Auto-set delivery time to booking date/time
        const deliveryStartTime = new Date(bookingIntent.bookingDate);
        bookingData.deliveryStartTime = deliveryStartTime;
        bookingData.deliveryEndTime = new Date(deliveryStartTime.getTime() + 60 * 60 * 1000); // 1 hour duration
        bookingData.deliveryDuration = 60; // 1 hour
        bookingData.requiresDelivery = true;
      }
    }

    const booking = new Booking(bookingData);

    await booking.save();
    await booking.populate('serviceId');
    await booking.populate('customerId', 'name email');

    // Update payment with booking reference
    payment.bookingId = booking._id;
    await payment.save();

    // Decrease inventory for equipment/supply items using batch tracking
    if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
      // Use batch tracking for inventory reduction (FIFO)
      await service.reduceBatchQuantity(bookingIntent.quantity);

      console.log('Inventory update completed using batch tracking for booking confirmation');

      // Trigger low stock alert check
      try {
        await triggerLowStockCheck(bookingIntent.serviceId);
      } catch (alertError) {
        console.error('Error triggering low stock alert:', alertError);
        // Don't fail the booking if alert fails
      }
    }

    // Decrease inventory for included equipment in professional services
    if (service.serviceType === 'service' && service.includedEquipment && service.includedEquipment.length > 0) {
      for (const equipmentItem of service.includedEquipment) {
        try {
          const equipmentService = await Service.findById(equipmentItem.equipmentId);
          if (equipmentService && (equipmentService.serviceType === 'equipment' || equipmentService.serviceType === 'supply')) {
            // Use batch tracking for inventory reduction (FIFO)
            await equipmentService.reduceBatchQuantity(equipmentItem.quantity);

            // Trigger low stock alert check for equipment
            try {
              await triggerLowStockCheck(equipmentItem.equipmentId);
            } catch (alertError) {
              console.error('Error triggering low stock alert for equipment:', alertError);
              // Don't fail the booking if alert fails
            }
          }
        } catch (equipmentError) {
          console.error('Error reducing equipment inventory:', equipmentError);
          // Don't fail the booking if equipment inventory reduction fails
        }
      }
    }

    // Send confirmation notifications
    try {
      await sendTemplateNotification(req.user.id, 'BOOKING_CONFIRMED', {
        message: `Your booking for ${service.name} has been confirmed!`,
        metadata: {
          bookingId: booking._id,
          serviceId: service._id,
          amount: booking.totalPrice,
        }
      });

      // Send booking confirmation email
      const customer = await User.findById(req.user.id);
      if (customer && customer.email) {
        await sendBookingConfirmation(customer.email, {
          serviceName: service.name,
          quantity: booking.quantity,
          date: booking.bookingDate,
          time: booking.bookingDate.toLocaleTimeString(),
          totalPrice: booking.totalPrice,
        });
      }

      // Admin notification
      const User = require('../models/User');
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await sendTemplateNotification(admin._id, 'NEW_BOOKING_ADMIN', {
          message: `New confirmed booking from customer for ${service.name}.`,
          metadata: {
            bookingId: booking._id,
            serviceId: service._id,
            amount: booking.totalPrice,
          }
        });
      }

      // Send admin booking notification email
      if (process.env.ADMIN_EMAIL) {
        await sendAdminBookingNotification({
          serviceName: service.name,
          quantity: booking.quantity,
          date: booking.bookingDate,
          totalPrice: booking.totalPrice,
        }, {
          name: customer.name,
          email: customer.email,
        });
      }

      // Emit real-time events
      const io = global.io;
      if (io) {
        io.to(`user_${req.user.id}`).emit('booking-confirmed', {
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

    // Record booking analytics patterns
    try {
      await recordBookingAnalytics(req.user.id, bookingIntent.serviceId, bookingIntent.quantity);
    } catch (analyticsError) {
      console.error('Error recording booking analytics:', analyticsError);
      // Don't fail the booking if analytics recording fails
    }

    // Track user preferences
    try {
      const UserPreferences = require('../models/UserPreferences');
      const service = await Service.findById(bookingIntent.serviceId);
      if (service) {
        await UserPreferences.trackServiceBooking(
          req.user.id,
          bookingIntent.serviceId,
          service.category,
          bookingIntent.totalPrice,
          null // eventType - could be added later if available
        );
      }
    } catch (preferenceError) {
      console.error('Error tracking user preferences:', preferenceError);
      // Don't fail the booking if preference tracking fails
    }

    res.status(201).json({
      success: true,
      booking,
      cartCleared: true, // Flag to indicate cart should be cleared on frontend
      message: 'Booking confirmed successfully!'
    });

  } catch (error) {
    console.error('Error confirming booking:', error);
    next(error);
  }
});

// Function to record booking analytics patterns
async function recordBookingAnalytics(customerId, currentServiceId, quantity) {
  try {
    // Get current service details
    const currentService = await Service.findById(currentServiceId);
    if (!currentService) return;

    // Get recent bookings by this customer in the last 24 hours
    const recentBookings = await Booking.find({
      customerId,
      status: 'confirmed',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).populate('serviceId');

    // Find main services (typically higher-value or primary services)
    const mainServices = recentBookings.filter(booking => {
      const service = booking.serviceId;
      return service.category === 'party' || service.category === 'wedding' ||
             service.category === 'corporate' || service.category === 'birthday' ||
             service.category === 'funeral' || service.serviceType === 'service';
    });

    // Record patterns for each main service with additional services
    for (const mainBooking of mainServices) {
      if (mainBooking.serviceId._id.toString() !== currentServiceId.toString()) {
        // This is an additional service booked with a main service
        await BookingAnalytics.recordBookingPattern(
          mainBooking.serviceId._id,
          currentServiceId,
          mainBooking.serviceId.category,
          currentService.category,
          quantity
        );
      }
    }

    // Also record patterns where current service is main and others are additional
    const additionalBookings = recentBookings.filter(booking =>
      booking.serviceId._id.toString() !== currentServiceId.toString()
    );

    const isMainService = currentService.category === 'party' || currentService.category === 'wedding' ||
                          currentService.category === 'corporate' || currentService.category === 'birthday' ||
                          currentService.category === 'funeral' || currentService.serviceType === 'service';

    if (isMainService) {
      // Record patterns where current service is main and others are additional
      for (const additionalBooking of additionalBookings) {
        await BookingAnalytics.recordBookingPattern(
          currentServiceId,
          additionalBooking.serviceId._id,
          currentService.category,
          additionalBooking.serviceId.category,
          additionalBooking.quantity
        );
      }
    }

  } catch (error) {
    console.error('Error in recordBookingAnalytics:', error);
  }
}
// Get delivery schedules for admin (shows all delivery bookings)
router.get('/admin/delivery-schedules', adminMiddleware, async (req, res, next) => {
  try {
    const { date } = req.query;
    const { getDeliverySchedules } = require('../utils/deliveryService');

    // Get schedules from explicit delivery bookings
    const explicitSchedules = await getDeliverySchedules(date ? new Date(date) : null);

    // Always check for bookings that might require delivery based on service type
    const queryDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all confirmed/paid bookings for the date
    const allBookings = await Booking.find({
      status: 'confirmed',
      paymentStatus: { $in: ['partial', 'paid'] },
      bookingDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).populate('serviceId', 'name category serviceType').populate('customerId', 'name email phone');

    // Filter for services that require delivery
    const deliveryBookings = allBookings.filter(booking => {
      const service = booking.serviceId;
      if (!service) return false;

      const deliveryCategories = ['equipment', 'furniture', 'lighting', 'sound-system', 'tents-canopies', 'linens-tableware'];
      const deliveryServiceTypes = ['equipment', 'supply'];

      return deliveryCategories.includes(service.category) ||
             deliveryServiceTypes.includes(service.serviceType) ||
             service.requiresDelivery === true;
    });

    // Convert delivery bookings to schedule format
    const implicitSchedules = deliveryBookings.map(booking => {
      // Use explicit delivery time if available, otherwise calculate (booking date + 1 day)
      let deliveryDate;
      if (booking.deliveryStartTime) {
        deliveryDate = new Date(booking.deliveryStartTime);
      } else {
        deliveryDate = new Date(booking.bookingDate);
        deliveryDate.setDate(deliveryDate.getDate() + 1);
      }

      const endTime = booking.deliveryEndTime
        ? new Date(booking.deliveryEndTime)
        : new Date(deliveryDate.getTime() + 60 * 60 * 1000); // 1 hour duration

      return {
        id: booking._id,
        serviceName: booking.serviceId?.name || 'Unknown Service',
        serviceCategory: booking.serviceId?.category || 'Unknown',
        customerName: booking.customerId?.name || 'Unknown Customer',
        customerEmail: booking.customerId?.email || '',
        customerPhone: booking.customerId?.phone || '',
        startTime: deliveryDate,
        endTime: endTime,
        duration: booking.deliveryDuration || 60,
        status: booking.status,
        quantity: booking.quantity,
        totalPrice: booking.totalPrice,
        notes: booking.notes
      };
    });

    // Combine explicit and implicit schedules, removing duplicates
    const allSchedules = [...explicitSchedules];
    const existingIds = new Set(explicitSchedules.map(s => s.id));

    implicitSchedules.forEach(schedule => {
      if (!existingIds.has(schedule.id)) {
        allSchedules.push(schedule);
      }
    });

    // Sort by start time
    allSchedules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    res.json({
      success: true,
      schedules: allSchedules,
      total: allSchedules.length
    });

  } catch (error) {
    next(error);
  }
});

// Get delivery truck status (available/busy)
router.get('/admin/delivery-truck-status', adminMiddleware, async (req, res, next) => {
  try {
    const { getDeliveryTruckStatus } = require('../utils/deliveryService');

    const status = await getDeliveryTruckStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    next(error);
  }
});

// Get available delivery time slots for a specific date
router.get('/delivery-slots/available', authMiddleware, async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const { checkDeliveryTruckAvailability } = require('../utils/deliveryService');

    // Generate time slots from 8 AM to 6 PM (10 hours)
    const timeSlots = [];
    const startHour = 8; // 8 AM
    const endHour = 18; // 6 PM

    for (let hour = startHour; hour < endHour; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      const slotDateTime = new Date(`${date}T${timeString}`);

      // Check if this time slot is available
      const availability = await checkDeliveryTruckAvailability(slotDateTime, 60);

      timeSlots.push({
        time: timeString,
        displayTime: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
        available: availability.available,
        reason: availability.reason,
        nextAvailableTime: availability.nextAvailableTime
      });
    }

    res.json({
      success: true,
      date,
      timeSlots
    });
  } catch (error) {
    next(error);
  }
});

// Update booking details (guests and item quantities) - admin only
router.put('/:id/update-details', adminMiddleware, async (req, res, next) => {
  try {
    const { quantity, itemQuantities } = req.body;

    const booking = await Booking.findById(req.params.id)
      .populate('serviceId')
      .populate('customerId', 'name email');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Validate quantity
    if (quantity !== undefined) {
      if (quantity < 1 || quantity > 100) {
        return res.status(400).json({
          success: false,
          message: 'Number of guests must be between 1 and 100'
        });
      }
      booking.quantity = quantity;
    }

    // Validate and update item quantities
    if (itemQuantities && booking.serviceId) {
      // Check inventory levels for each item
      const service = await Service.findById(booking.serviceId._id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      // For equipment/supply services, check inventory levels
      if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
        const totalRequested = Object.values(itemQuantities).reduce((sum, qty) => sum + (qty || 0), 0);
        if (totalRequested > service.quantity) {
          return res.status(400).json({
            success: false,
            message: `Requested quantity (${totalRequested}) exceeds available inventory (${service.quantity})`
          });
        }
      }

      booking.itemQuantities = itemQuantities;
    }

    // Recalculate total price if quantity changed
    if (quantity !== undefined && booking.serviceId) {
      const service = booking.serviceId;
      const calculatedPrice = service.calculatePrice ? service.calculatePrice() : service.basePrice || service.price || 0;
      booking.totalPrice = calculatedPrice * booking.quantity;
    }

    await booking.save();

    // Send notification to customer about booking update
    try {
      await sendTemplateNotification(booking.customerId._id, 'BOOKING_UPDATED', {
        message: `Your booking details for ${booking.serviceId.name} have been updated by an administrator.`,
        metadata: {
          bookingId: booking._id,
          serviceId: booking.serviceId._id,
          quantity: booking.quantity,
        },
      });
    } catch (notificationError) {
      console.error('Error sending booking update notification:', notificationError);
      // Don't fail the update if notification fails
    }

    res.json({
      success: true,
      booking,
      message: 'Booking details updated successfully'
    });

  } catch (error) {
    console.error('Error updating booking details:', error);
    next(error);
  }
});

// Get predictive suggestions based on booking analytics
router.get('/suggestions/predictive', authMiddleware, async (req, res, next) => {
  try {
    const { category, serviceId } = req.query;

    let suggestions = [];

    if (serviceId) {
      // Get suggestions for a specific service
      suggestions = await BookingAnalytics.getSuggestionsForService(serviceId);
    } else if (category) {
      // Get suggestions for a category
      suggestions = await BookingAnalytics.getSuggestionsByCategory(category);
    } else {
      // Get general suggestions based on popular patterns
      const categories = ['party', 'wedding', 'corporate', 'birthday', 'funeral'];
      for (const cat of categories) {
        const categorySuggestions = await BookingAnalytics.getSuggestionsByCategory(cat, 3);
        suggestions.push(...categorySuggestions);
      }
      // Remove duplicates and sort by confidence
      const seen = new Set();
      suggestions = suggestions
        .filter(suggestion => {
          const id = suggestion.service._id.toString();
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);
    }

    res.json({
      success: true,
      suggestions,
      total: suggestions.length
    });

  } catch (error) {
    console.error('Error getting predictive suggestions:', error);
    next(error);
  }
});

module.exports = router;
