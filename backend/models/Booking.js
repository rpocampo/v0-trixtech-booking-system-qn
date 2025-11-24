const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    basePrice: {
      type: Number,
      required: true,
    },
    appliedMultiplier: {
      type: Number,
      default: 1.0,
    },
    daysBeforeCheckout: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paymentType: {
      type: String,
      enum: ['full'],
      default: 'full',
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    downPaymentPercentage: {
      type: Number,
      default: 30, // Default 30% down payment
    },
    notes: {
      type: String,
    },
    duration: {
      type: Number, // Duration in days
      default: 1,
      min: 1,
    },
    dailyRate: {
      type: Number, // Daily rate for the booking
      default: 0,
    },
    // Delivery truck availability fields
    requiresDelivery: {
      type: Boolean,
      default: false,
    },
    deliveryStartTime: {
      type: Date,
    },
    deliveryEndTime: {
      type: Date,
    },
    deliveryDuration: {
      type: Number, // in minutes
      default: 60, // 1 hour default
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
