const express = require('express');
const Delivery = require('../models/Delivery');
const Booking = require('../models/Booking');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get current delivery status
router.get('/status', async (req, res, next) => {
  try {
    const status = await Delivery.getCurrentStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    next(error);
  }
});

// Check delivery availability for a specific date/time
router.get('/availability', authMiddleware, async (req, res, next) => {
  try {
    const { date, duration = 60 } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const availability = await Delivery.checkAvailability(new Date(date), parseInt(duration));

    res.json({ success: true, availability });
  } catch (error) {
    next(error);
  }
});

// Get delivery schedule (admin only)
router.get('/schedule', adminMiddleware, async (req, res, next) => {
  try {
    const { date, status } = req.query;

    let query = {};

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      query.scheduledDate = {
        $gte: startDate,
        $lt: endDate
      };
    }

    if (status) {
      query.status = status;
    }

    const deliveries = await Delivery.find(query)
      .populate('customerId', 'name email phone')
      .populate('bookingId')
      .populate('items.serviceId', 'name category')
      .sort({ scheduledDate: 1 });

    res.json({ success: true, deliveries });
  } catch (error) {
    next(error);
  }
});

// Create delivery from booking (admin only)
router.post('/', adminMiddleware, async (req, res, next) => {
  try {
    const {
      bookingId,
      scheduledDate,
      deliveryAddress,
      deliveryNotes,
      contactPerson,
      estimatedDuration = 60
    } = req.body;

    if (!bookingId || !scheduledDate || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, scheduled date, and delivery address are required'
      });
    }

    // Check if booking exists and is confirmed
    const booking = await Booking.findById(bookingId)
      .populate('customerId', 'name email phone')
      .populate('serviceId', 'name category');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can have deliveries scheduled'
      });
    }

    // Check delivery availability
    const availability = await Delivery.checkAvailability(new Date(scheduledDate), estimatedDuration);

    if (!availability.available) {
      return res.status(409).json({
        success: false,
        message: 'Delivery time conflicts with existing deliveries',
        availability
      });
    }

    // Create delivery record
    const delivery = new Delivery({
      bookingId,
      customerId: booking.customerId._id,
      scheduledDate: new Date(scheduledDate),
      deliveryAddress,
      deliveryNotes,
      contactPerson,
      estimatedDuration,
      items: [{
        serviceId: booking.serviceId._id,
        name: booking.serviceId.name,
        quantity: booking.quantity,
        category: booking.serviceId.category
      }],
      totalWeight: 0, // Could be calculated based on items
    });

    await delivery.save();
    await delivery.populate('customerId', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Delivery scheduled successfully',
      delivery
    });
  } catch (error) {
    next(error);
  }
});

// Update delivery status (admin only)
router.put('/:id/status', adminMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    const oldStatus = delivery.status;
    delivery.status = status;

    // Set timestamps based on status
    if (status === 'in_progress' && oldStatus !== 'in_progress') {
      delivery.actualStartTime = new Date();
    } else if ((status === 'completed' || status === 'cancelled') && !delivery.actualEndTime) {
      delivery.actualEndTime = new Date();
    }

    await delivery.save();
    await delivery.populate('customerId', 'name email phone');

    res.json({
      success: true,
      message: `Delivery status updated to ${status}`,
      delivery
    });
  } catch (error) {
    next(error);
  }
});

// Get delivery by ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('bookingId')
      .populate('items.serviceId', 'name category');

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    // Check if user owns this delivery or is admin
    if (delivery.customerId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, delivery });
  } catch (error) {
    next(error);
  }
});

// Update delivery details (admin only)
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'scheduledDate', 'deliveryAddress', 'deliveryNotes',
      'contactPerson', 'estimatedDuration', 'priority'
    ];

    // Filter out disallowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // If updating scheduled date, check availability
    if (filteredUpdates.scheduledDate) {
      const delivery = await Delivery.findById(req.params.id);
      if (!delivery) {
        return res.status(404).json({ success: false, message: 'Delivery not found' });
      }

      const availability = await Delivery.checkAvailability(
        new Date(filteredUpdates.scheduledDate),
        delivery.estimatedDuration
      );

      if (!availability.available) {
        return res.status(409).json({
          success: false,
          message: 'New delivery time conflicts with existing deliveries',
          availability
        });
      }
    }

    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      filteredUpdates,
      { new: true }
    ).populate('customerId', 'name email phone');

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    res.json({
      success: true,
      message: 'Delivery updated successfully',
      delivery
    });
  } catch (error) {
    next(error);
  }
});

// Delete delivery (admin only)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const delivery = await Delivery.findByIdAndDelete(req.params.id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    res.json({
      success: true,
      message: 'Delivery deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;