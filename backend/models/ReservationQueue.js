const mongoose = require('mongoose');

const reservationQueueSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
    },
    priority: {
      type: Number,
      default: 0, // Higher number = higher priority
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'fulfilled', 'cancelled', 'expired'],
      default: 'queued',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
    alternativeSuggestions: [{
      serviceId: mongoose.Schema.Types.ObjectId,
      reason: String,
      availability: Number,
    }],
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
reservationQueueSchema.index({ status: 1, createdAt: 1 });
reservationQueueSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to check if reservation can be fulfilled
reservationQueueSchema.methods.canFulfill = async function() {
  const Service = mongoose.model('Service');
  const Booking = mongoose.model('Booking');

  const service = await Service.findById(this.serviceId);
  if (!service) return false;

  // For equipment, check total booked on this date
  if (service.category === 'equipment') {
    const existingBookings = await Booking.find({
      serviceId: this.serviceId,
      bookingDate: this.bookingDate,
      status: { $in: ['pending', 'confirmed'] },
    });

    const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
    return (totalBooked + this.requestedQuantity) <= service.quantity;
  }

  // For services, check if any booking exists on this date
  const existingBooking = await Booking.findOne({
    serviceId: this.serviceId,
    bookingDate: this.bookingDate,
    status: { $in: ['pending', 'confirmed'] },
  });

  return !existingBooking;
};

// Method to fulfill reservation
reservationQueueSchema.methods.fulfill = async function() {
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');

  // Get service to calculate price
  const service = await Service.findById(this.serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  // Create the booking
  const booking = new Booking({
    customerId: this.customerId,
    serviceId: this.serviceId,
    quantity: this.requestedQuantity,
    bookingDate: this.bookingDate,
    totalPrice: service.price * this.requestedQuantity,
    status: 'confirmed', // Auto-confirm fulfilled reservations
    notes: this.notes,
  });

  await booking.save();
  await booking.populate('serviceId');
  await booking.populate('customerId', 'name email');

  // Update queue status
  this.status = 'fulfilled';
  await this.save();

  return booking;
};

module.exports = mongoose.model('ReservationQueue', reservationQueueSchema);