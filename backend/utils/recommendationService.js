const Service = require('../models/Service');
const Booking = require('../models/Booking');
const ReservationQueue = require('../models/ReservationQueue');

// Find alternative services based on category and availability
const findAlternativeServices = async (originalServiceId, bookingDate, requestedQuantity = 1) => {
  try {
    const originalService = await Service.findById(originalServiceId);
    if (!originalService) return [];

    // Find services in the same category
    const similarServices = await Service.find({
      category: originalService.category,
      isAvailable: true,
      _id: { $ne: originalServiceId }
    });

    const alternatives = [];

    for (const service of similarServices) {
      let availableQuantity = service.quantity || 1;
      let reason = '';
      let isAvailable = true;

      // For equipment, check availability on the specific date
      if (service.category === 'equipment' && service.quantity) {
        const existingBookings = await Booking.find({
          serviceId: service._id,
          bookingDate: bookingDate,
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] },
        });

        const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
        availableQuantity = Math.max(0, service.quantity - totalBooked);

        if (availableQuantity < requestedQuantity) {
          isAvailable = false;
          reason = `Only ${availableQuantity} available on this date`;
        } else {
          reason = `${availableQuantity} available on this date`;
        }
      } else if (service.category !== 'equipment') {
        // For services, check if already booked on this date
        const existingBooking = await Booking.findOne({
          serviceId: service._id,
          bookingDate: bookingDate,
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] },
        });

        if (existingBooking) {
          isAvailable = false;
          reason = 'Already booked on this date';
        } else {
          reason = 'Available on this date';
        }
      }

      // Calculate similarity score (simple implementation)
      let similarityScore = 0;
      const servicePrice = service.basePrice || 0;
      const originalPrice = originalService.basePrice || 0;
      if (servicePrice <= originalPrice * 1.2 && servicePrice >= originalPrice * 0.8) {
        similarityScore += 30; // Price similarity
      }
      if (service.duration && originalService.duration &&
          Math.abs(service.duration - originalService.duration) <= 30) {
        similarityScore += 20; // Duration similarity
      }
      if (isAvailable) {
        similarityScore += 50; // Availability bonus
      }

      alternatives.push({
        serviceId: service._id,
        name: service.name,
        price: service.basePrice || 0,
        duration: service.duration,
        quantity: service.quantity,
        availableQuantity,
        isAvailable,
        reason,
        similarityScore,
        image: service.image,
      });
    }

    // Sort by similarity score and availability
    return alternatives
      .sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return b.similarityScore - a.similarityScore;
      })
      .slice(0, 3); // Return top 3 alternatives

  } catch (error) {
    console.error('Error finding alternative services:', error);
    return [];
  }
};

// Process reservation queue - check if any queued reservations can now be fulfilled
const processReservationQueue = async () => {
  try {

    const queuedReservations = await ReservationQueue.find({
      status: 'queued',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: 1 }); // First-come, first-served

    let processedCount = 0;

    for (const reservation of queuedReservations) {
      const canFulfill = await reservation.canFulfill();

      if (canFulfill) {
        try {
          const booking = await reservation.fulfill();
          processedCount++;

          // Send notification to customer
          const { sendTemplateNotification } = require('./notificationService');
          const { sendBookingConfirmation } = require('./emailService');

          await sendTemplateNotification(reservation.customerId, 'BOOKING_CONFIRMED', {
            message: `Your queued reservation for ${booking.serviceId.name} has been confirmed!`,
            metadata: {
              bookingId: booking._id,
              serviceId: booking.serviceId._id,
              amount: booking.totalPrice,
            },
          });

          // Send email confirmation
          const User = require('../models/User');
          const customer = await User.findById(reservation.customerId);
          if (customer) {
            await sendBookingConfirmation(customer.email, {
              serviceName: booking.serviceId.name,
              quantity: booking.quantity,
              date: booking.bookingDate,
              time: new Date(booking.bookingDate).toLocaleTimeString(),
              totalPrice: booking.totalPrice,
            });
          }

          console.log(`Processed queued reservation ${reservation._id} for customer ${reservation.customerId}`);
        } catch (error) {
          console.error(`Failed to fulfill reservation ${reservation._id}:`, error);
        }
      }
    }

    if (processedCount > 0) {
      console.log(`Processed ${processedCount} queued reservations`);
    }

    return processedCount;
  } catch (error) {
    console.error('Error processing reservation queue:', error);
    return 0;
  }
};

// Clean up expired reservations
const cleanupExpiredReservations = async () => {
  try {

    const result = await ReservationQueue.updateMany(
      {
        status: 'queued',
        expiresAt: { $lt: new Date() }
      },
      { status: 'expired' }
    );

    if (result.modifiedCount > 0) {
      console.log(`Expired ${result.modifiedCount} queued reservations`);
    }

    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error);
    return 0;
  }
};

module.exports = {
  findAlternativeServices,
  processReservationQueue,
  cleanupExpiredReservations,
};