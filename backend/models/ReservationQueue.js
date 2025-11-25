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
      min: 0,
      max: 100
    },
    priorityReason: {
      type: String,
      enum: ['vip', 'loyalty', 'bulk_booking', 'event_organizer', 'manual_override', 'none'],
      default: 'none'
    },
    vipLevel: {
      type: String,
      enum: ['platinum', 'gold', 'silver', 'bronze', 'none'],
      default: 'none'
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
reservationQueueSchema.index({ status: 1, priority: -1, createdAt: 1 });
reservationQueueSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
reservationQueueSchema.index({ customerId: 1, status: 1 });

// Method to calculate priority based on user profile
reservationQueueSchema.methods.calculatePriority = async function() {
  const User = mongoose.model('User');
  const Booking = mongoose.model('Booking');

  const user = await User.findById(this.customerId);
  if (!user) return 0;

  let priority = 0;

  // VIP level priority
  switch (this.vipLevel) {
    case 'platinum': priority += 80; break;
    case 'gold': priority += 60; break;
    case 'silver': priority += 40; break;
    case 'bronze': priority += 20; break;
  }

  // Priority reason bonus
  switch (this.priorityReason) {
    case 'vip': priority += 30; break;
    case 'loyalty': priority += 20; break;
    case 'bulk_booking': priority += 15; break;
    case 'event_organizer': priority += 25; break;
    case 'manual_override': priority += 50; break;
  }

  // Loyalty bonus based on booking history
  const bookingCount = await Booking.countDocuments({
    customerId: this.customerId,
    status: 'confirmed'
  });
  priority += Math.min(bookingCount * 2, 20); // Max 20 points for loyalty

  // Time decay - newer reservations get slight priority
  const hoursSinceCreation = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  priority += Math.max(0, 10 - hoursSinceCreation); // Bonus decreases over time

  this.priority = Math.min(100, Math.max(0, priority));
  return this.save();
};

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
      status: 'confirmed',
      paymentStatus: { $in: ['partial', 'paid'] },
    });

    const totalBooked = existingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
    return (totalBooked + this.requestedQuantity) <= service.quantity;
  }

  // For services, check if any booking exists on this date
  const existingBooking = await Booking.findOne({
    serviceId: this.serviceId,
    bookingDate: this.bookingDate,
    status: 'confirmed',
    paymentStatus: { $in: ['partial', 'paid'] },
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

  // Calculate dynamic price based on days before checkout
  const bookingDateTime = new Date(this.bookingDate);
  const now = new Date();
  const daysBeforeCheckout = Math.ceil((bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const calculatedPrice = service.calculatePrice(Math.max(0, daysBeforeCheckout));
  const totalPrice = calculatedPrice * this.requestedQuantity;

  // Calculate applied multiplier safely
  const appliedMultiplier = service.basePrice > 0 ? calculatedPrice / service.basePrice : 1.0;

  // Create the booking with all required fields
  const booking = new Booking({
    customerId: this.customerId,
    serviceId: this.serviceId,
    quantity: this.requestedQuantity,
    bookingDate: bookingDateTime,
    totalPrice,
    basePrice: service.basePrice,
    appliedMultiplier,
    daysBeforeCheckout: Math.max(0, daysBeforeCheckout),
    status: 'confirmed', // Auto-confirm fulfilled reservations
    paymentStatus: 'paid', // Reservations are fulfilled when available, assume paid
    notes: this.notes,
  });

  await booking.save();
  await booking.populate('serviceId');
  await booking.populate('customerId', 'name email');

  // Decrease inventory for equipment/supply items
  if (service.serviceType === 'equipment' || service.serviceType === 'supply') {
    service.quantity = Math.max(0, service.quantity - this.requestedQuantity);
    await service.save();
  }

  // Update queue status
  this.status = 'fulfilled';
  await this.save();

  return booking;
};

module.exports = mongoose.model('ReservationQueue', reservationQueueSchema);