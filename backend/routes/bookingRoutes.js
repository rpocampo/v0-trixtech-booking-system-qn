const express = require('express');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const ReservationQueue = require('../models/ReservationQueue');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendBookingConfirmation, sendAdminBookingNotification, sendLowStockAlert } = require('../utils/emailService');
const { sendTemplateNotification } = require('../utils/notificationService');
const { findAlternativeServices, processReservationQueue } = require('../utils/recommendationService');

const router = express.Router();

// Check availability for a service at specific date/time
router.get('/check-availability/:serviceId', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { date, quantity = 1 } = req.query;

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

    let isAvailable = true;
    let availableQuantity = service.quantity || 1;
    let reason = '';

    if (service.category === 'equipment') {
      // For equipment, check total booked quantity on this date
      const existingBookings = await Booking.find({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
          $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
        },
        status: { $in: ['pending', 'confirmed'] },
      });

      const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
      availableQuantity = Math.max(0, service.quantity - totalBooked);

      if (availableQuantity < requestedQuantity) {
        isAvailable = false;
        reason = `Only ${availableQuantity} items available for this date`;
      }
    } else {
      // For services, check if any booking exists on this date
      const existingBooking = await Booking.findOne({
        serviceId,
        bookingDate: {
          $gte: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate()),
          $lt: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate() + 1)
        },
        status: { $in: ['pending', 'confirmed'] },
      });

      if (existingBooking) {
        isAvailable = false;
        availableQuantity = 0;
        reason = 'This service is already booked for this date';
      }
    }

    res.json({
      success: true,
      available: isAvailable,
      availableQuantity,
      requestedQuantity,
      reason,
      serviceName: service.name,
      maxQuantity: service.quantity || 1
    });
  } catch (error) {
    next(error);
  }
});

// Create booking (customers only)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId, quantity, bookingDate, notes } = req.body;

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
      // Create booking with optimistic locking approach
      // We'll use a unique constraint approach by checking availability again right before saving

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
            status: { $in: ['pending', 'confirmed'] },
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
            status: { $in: ['pending', 'confirmed'] },
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

          return res.status(202).json({
            success: true,
            queued: true,
            queueId: queueEntry._id,
            alternatives: alternatives.slice(0, 3),
            message: 'Item became unavailable during booking. Added to reservation queue.'
          });
        }

        // Create booking with pending status (will be confirmed after payment)
        const booking = new Booking({
          customerId: req.user.id,
          serviceId,
          quantity: requestedQuantity,
          bookingDate: new Date(bookingDate),
          totalPrice: service.price * requestedQuantity,
          status: 'pending', // Changed from 'confirmed' to 'pending'
          paymentStatus: 'unpaid', // Explicitly set payment status
          notes,
        });

        await booking.save();

        await booking.populate('serviceId');
        await booking.populate('customerId', 'name email');

        // Send pending booking notification
        try {
          console.log('Creating pending booking:', booking._id);

          // Customer notification for pending booking
          const customerNotification = await sendTemplateNotification(req.user.id, 'BOOKING_PENDING', {
            message: `Your booking for ${service.name} has been created and is pending payment.`,
            metadata: {
              bookingId: booking._id,
              serviceId: service._id,
              amount: booking.totalPrice,
            },
          });
          console.log('Pending booking notification created:', customerNotification?._id);

          // Admin notification for new pending booking
          const adminUsers = await User.find({ role: 'admin' });
          console.log('Found admin users:', adminUsers.length);

          for (const admin of adminUsers) {
            const adminNotification = await sendTemplateNotification(admin._id, 'NEW_PENDING_BOOKING_ADMIN', {
              message: `New pending booking received from customer for ${service.name}.`,
              metadata: {
                bookingId: booking._id,
                serviceId: service._id,
                amount: booking.totalPrice,
              },
            });
            console.log('Admin pending booking notification created for', admin._id, ':', adminNotification?._id);
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

        res.status(200).json({
          success: true,
          booking,
          requiresPayment: true,
          message: 'Booking created. Please complete payment to confirm.'
        });
    } else {
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
    if (booking.customerId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
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

// Get all bookings (admin only)
router.get('/admin/all', adminMiddleware, async (req, res, next) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit) : undefined;

    let query = Booking.find()
      .populate('serviceId')
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 });

    if (limitNum) {
      query = query.limit(limitNum);
    }

    const bookings = await query;

    res.json({ success: true, bookings });
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
      if (io) {
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

    if (booking.customerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
