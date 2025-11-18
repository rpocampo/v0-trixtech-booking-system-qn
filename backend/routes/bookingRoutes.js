const express = require('express');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendBookingConfirmation, sendAdminBookingNotification, sendLowStockAlert } = require('../utils/emailService');
const { sendTemplateNotification } = require('../utils/notificationService');

const router = express.Router();

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

    // Check available quantity
    if (service.quantity !== undefined && service.quantity < requestedQuantity) {
      return res.status(409).json({
        success: false,
        message: `Only ${service.quantity} items available. Requested: ${requestedQuantity}`
      });
    }

    // For equipment, check total booked quantity on this date
    if (service.category === 'equipment') {
      const existingBookings = await Booking.find({
        serviceId,
        bookingDate: new Date(bookingDate),
        status: { $in: ['pending', 'confirmed'] },
      });

      const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);

      if (totalBooked + requestedQuantity > service.quantity) {
        const available = service.quantity - totalBooked;
        return res.status(409).json({
          success: false,
          message: `Only ${available} items available for this date. Requested: ${requestedQuantity}`
        });
      }
    } else {
      // For non-equipment services, check for existing booking
      const existingBooking = await Booking.findOne({
        serviceId,
        bookingDate: new Date(bookingDate),
        status: { $in: ['pending', 'confirmed'] },
      });

      if (existingBooking) {
        return res.status(409).json({ success: false, message: 'Service already booked for this date' });
      }
    }

    const booking = new Booking({
      customerId: req.user.id,
      serviceId,
      quantity: requestedQuantity,
      bookingDate: new Date(bookingDate),
      totalPrice: service.price * requestedQuantity,
      notes,
    });

    await booking.save();
    await booking.populate('serviceId');
    await booking.populate('customerId', 'name email');

    // Send confirmation emails
    const customer = await User.findById(req.user.id);
    if (customer) {
      await sendBookingConfirmation(customer.email, {
        serviceName: service.name,
        quantity: requestedQuantity,
        date: booking.bookingDate,
        time: new Date(booking.bookingDate).toLocaleTimeString(),
        totalPrice: booking.totalPrice,
      });

      await sendAdminBookingNotification({
        serviceName: service.name,
        quantity: requestedQuantity,
        date: booking.bookingDate,
        totalPrice: booking.totalPrice,
      }, {
        name: customer.name,
        email: customer.email,
      });
    }

    // Check for low stock alert
    if (service.category === 'equipment' && service.quantity <= 5) {
      await sendLowStockAlert(service.name, service.quantity);
    }

    // Create notifications and emit real-time events
    try {
      console.log('Creating notifications for booking:', booking._id);

      // Customer notification
      const customerNotification = await sendTemplateNotification(req.user.id, 'BOOKING_CONFIRMED', {
        message: `Your booking for ${service.name} has been confirmed.`,
        metadata: {
          bookingId: booking._id,
          serviceId: service._id,
          amount: booking.totalPrice,
        },
      });
      console.log('Customer notification created:', customerNotification?._id);

      // Admin notification
      const adminUsers = await User.find({ role: 'admin' });
      console.log('Found admin users:', adminUsers.length);

      for (const admin of adminUsers) {
        const adminNotification = await sendTemplateNotification(admin._id, 'NEW_BOOKING_ADMIN', {
          message: `New booking received from customer for ${service.name}.`,
          metadata: {
            bookingId: booking._id,
            serviceId: service._id,
            amount: booking.totalPrice,
          },
        });
        console.log('Admin notification created for', admin._id, ':', adminNotification?._id);
      }

      // Emit real-time events
      const io = global.io;
      if (io) {
        // Notify customer
        io.to(`user_${req.user.id}`).emit('booking-created', {
          booking: {
            id: booking._id,
            serviceName: service.name,
            quantity: requestedQuantity,
            date: booking.bookingDate,
            totalPrice: booking.totalPrice,
            status: booking.status,
          }
        });

        // Notify admins
        io.to('admin').emit('new-booking', {
          booking: {
            id: booking._id,
            customerId: req.user.id,
            serviceName: service.name,
            quantity: requestedQuantity,
            date: booking.bookingDate,
            totalPrice: booking.totalPrice,
            status: booking.status,
          }
        });

        // Notify all clients about inventory change
        io.emit('inventory-updated', {
          serviceId: service._id,
          serviceName: service.name,
          availableQuantity: service.quantity - requestedQuantity,
        });
      }
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
      // Don't fail the booking if notifications fail
    }

    res.status(201).json({ success: true, booking });
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
    const bookings = await Booking.find()
      .populate('serviceId')
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 });

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
