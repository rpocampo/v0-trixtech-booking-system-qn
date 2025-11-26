const mongoose = require('mongoose');
const crypto = require('crypto');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['email_verification', 'account_creation', 'contact_verification', 'booking_confirmation'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5, // Maximum 5 attempts
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for efficient queries
otpSchema.index({ email: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Method to verify OTP
otpSchema.methods.verifyOTP = function(enteredOTP) {
  if (this.isUsed) {
    throw new Error('OTP has already been used');
  }

  if (this.expiresAt < new Date()) {
    throw new Error('OTP has expired');
  }

  if (this.attempts >= 5) {
    throw new Error('Maximum verification attempts exceeded');
  }

  this.attempts += 1;

  if (this.otp !== enteredOTP) {
    throw new Error('Invalid OTP code');
  }

  this.isUsed = true;
  return true;
};

// Static method to generate secure OTP
otpSchema.statics.generateOTP = function() {
  // Generate 6-digit numeric OTP using cryptographically secure random
  return crypto.randomInt(100000, 1000000).toString();
};

// Static method to find valid OTP
otpSchema.statics.findValidOTP = function(email, purpose, otp) {
  return this.findOne({
    email,
    purpose,
    otp,
    isUsed: false,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 5 }
  });
};

// Static method to cleanup expired OTPs (called by cleanup job)
otpSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isUsed: true },
      { attempts: { $gte: 5 } }
    ]
  });
  return result.deletedCount;
};

module.exports = mongoose.model('OTP', otpSchema);