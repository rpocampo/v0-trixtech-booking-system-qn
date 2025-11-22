const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'PHP',
    },
    paymentMethod: {
      type: String,
      enum: ['gcash_qr'],
      required: true,
      default: 'gcash_qr',
    },
    paymentProvider: {
      type: String,
      enum: ['gcash_qr'],
      default: 'gcash_qr',
    },
    paymentType: {
      type: String,
      enum: ['full', 'down_payment', 'remaining_balance'],
      default: 'full',
    },
    isDownPayment: {
      type: Boolean,
      default: false,
    },
    isFinalPayment: {
      type: Boolean,
      default: false,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    referenceNumber: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
    },
    paymentData: {
      // Store provider-specific payment data
      type: mongoose.Schema.Types.Mixed,
    },
    failureReason: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ referenceNumber: 1 });

module.exports = mongoose.model('Payment', paymentSchema);