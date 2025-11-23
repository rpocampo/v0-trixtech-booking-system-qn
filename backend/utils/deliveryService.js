// Delivery truck availability management
const Booking = require('../models/Booking');

// Check if a service requires delivery truck
const requiresDeliveryTruck = (service) => {
  // Services that require physical delivery/pickup
  const deliveryCategories = ['equipment', 'furniture', 'lighting', 'sound-system', 'tents-canopies', 'linens-tableware'];
  const deliveryServiceTypes = ['equipment', 'supply'];

  return deliveryCategories.includes(service.category) ||
         deliveryServiceTypes.includes(service.serviceType) ||
         service.requiresDelivery === true;
};

// Check delivery truck availability for a specific time slot
const checkDeliveryTruckAvailability = async (requestedDateTime, duration = 60) => {
  try {
    const requestedStart = new Date(requestedDateTime);
    const requestedEnd = new Date(requestedStart.getTime() + duration * 60 * 1000); // duration in minutes

    // Add 1-hour buffer after delivery
    const bufferEnd = new Date(requestedEnd.getTime() + 60 * 60 * 1000); // 1 hour buffer

    // Find all bookings that require delivery truck and have overlapping time slots (only paid bookings)
    const conflictingBookings = await Booking.find({
      requiresDelivery: true,
      status: 'confirmed',
      paymentStatus: { $in: ['partial', 'paid'] },
      $or: [
        // Case 1: Requested start time falls within existing delivery window
        {
          deliveryStartTime: { $lte: requestedStart },
          deliveryEndTime: { $gt: requestedStart }
        },
        // Case 2: Requested end time falls within existing delivery window
        {
          deliveryStartTime: { $lt: requestedEnd },
          deliveryEndTime: { $gte: requestedEnd }
        },
        // Case 3: Existing delivery is completely within requested window
        {
          deliveryStartTime: { $gte: requestedStart },
          deliveryEndTime: { $lte: requestedEnd }
        },
        // Case 4: Requested window is completely within existing delivery
        {
          deliveryStartTime: { $lte: requestedStart },
          deliveryEndTime: { $gte: requestedEnd }
        },
        // Case 5: Check 1-hour buffer after existing deliveries
        {
          deliveryEndTime: { $gt: requestedStart },
          deliveryEndTime: { $lte: bufferEnd }
        }
      ]
    }).populate('serviceId', 'name category').populate('customerId', 'name');

    const isAvailable = conflictingBookings.length === 0;

    let nextAvailableTime = null;
    let reason = '';

    if (!isAvailable) {
      // Find the latest end time to calculate next available slot
      const latestEndTime = Math.max(...conflictingBookings.map(booking => {
        const endTime = new Date(booking.deliveryEndTime);
        // Add 1-hour buffer
        return endTime.getTime() + (60 * 60 * 1000);
      }));

      nextAvailableTime = new Date(latestEndTime);

      const conflictingService = conflictingBookings[0].serviceId?.name || 'another service';
      reason = `This delivery time conflicts with an existing booking for ${conflictingService}. The company has only one delivery truck. Please wait at least 1 hour after the previous delivery.`;
    }

    return {
      available: isAvailable,
      nextAvailableTime,
      conflictingBookings: conflictingBookings.map(booking => ({
        id: booking._id,
        serviceName: booking.serviceId?.name || 'Unknown Service',
        customerName: booking.customerId?.name || 'Unknown Customer',
        startTime: booking.deliveryStartTime,
        endTime: booking.deliveryEndTime,
        duration: booking.deliveryDuration
      })),
      reason,
      requestedTime: requestedStart,
      duration: duration
    };
  } catch (error) {
    console.error('Error checking delivery truck availability:', error);
    return {
      available: false,
      error: error.message,
      reason: 'Error checking delivery availability. Please try again.'
    };
  }
};

// Get all delivery schedules for admin dashboard
const getDeliverySchedules = async (date = null) => {
  try {
    const query = {
      requiresDelivery: true,
      status: 'confirmed',
      paymentStatus: { $in: ['partial', 'paid'] }
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.deliveryStartTime = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    const deliveries = await Booking.find(query)
      .populate('serviceId', 'name category')
      .populate('customerId', 'name email phone')
      .sort({ deliveryStartTime: 1 });

    return deliveries.map(booking => ({
      id: booking._id,
      serviceName: booking.serviceId?.name || 'Unknown Service',
      serviceCategory: booking.serviceId?.category || 'Unknown',
      customerName: booking.customerId?.name || 'Unknown Customer',
      customerEmail: booking.customerId?.email || '',
      customerPhone: booking.customerId?.phone || '',
      startTime: booking.deliveryStartTime,
      endTime: booking.deliveryEndTime,
      duration: booking.deliveryDuration,
      status: booking.status,
      quantity: booking.quantity,
      totalPrice: booking.totalPrice,
      notes: booking.notes
    }));
  } catch (error) {
    console.error('Error getting delivery schedules:', error);
    throw error;
  }
};

// Get delivery truck status (available/unavailable)
const getDeliveryTruckStatus = async () => {
  try {
    const now = new Date();

    // Find current active delivery
    const currentDelivery = await Booking.findOne({
      requiresDelivery: true,
      status: 'confirmed',
      deliveryStartTime: { $lte: now },
      deliveryEndTime: { $gt: now }
    }).populate('serviceId', 'name').populate('customerId', 'name');

    if (currentDelivery) {
      return {
        status: 'busy',
        currentDelivery: {
          serviceName: currentDelivery.serviceId?.name || 'Unknown Service',
          customerName: currentDelivery.customerId?.name || 'Unknown Customer',
          endTime: currentDelivery.deliveryEndTime,
          timeRemaining: Math.max(0, Math.floor((currentDelivery.deliveryEndTime - now) / (1000 * 60))) // minutes remaining
        },
        nextAvailableTime: new Date(currentDelivery.deliveryEndTime.getTime() + (60 * 60 * 1000)) // +1 hour buffer
      };
    }

    // Find next scheduled delivery (only paid bookings)
    const nextDelivery = await Booking.findOne({
      requiresDelivery: true,
      status: 'confirmed',
      paymentStatus: { $in: ['partial', 'paid'] },
      deliveryStartTime: { $gt: now }
    }).populate('serviceId', 'name').populate('customerId', 'name').sort({ deliveryStartTime: 1 });

    return {
      status: 'available',
      nextDelivery: nextDelivery ? {
        serviceName: nextDelivery.serviceId?.name || 'Unknown Service',
        customerName: nextDelivery.customerId?.name || 'Unknown Customer',
        startTime: nextDelivery.deliveryStartTime,
        timeUntilNext: Math.floor((nextDelivery.deliveryStartTime - now) / (1000 * 60)) // minutes until next
      } : null
    };
  } catch (error) {
    console.error('Error getting delivery truck status:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
};

module.exports = {
  requiresDeliveryTruck,
  checkDeliveryTruckAvailability,
  getDeliverySchedules,
  getDeliveryTruckStatus
};