const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  },
  used: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  usedAt: {
    type: Date,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
});

// Index for automatic expiration
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for token lookup
passwordResetTokenSchema.index({ token: 1 });

// Index for user and email lookups
passwordResetTokenSchema.index({ userId: 1 });
passwordResetTokenSchema.index({ email: 1 });

// Pre-save middleware to hash token
passwordResetTokenSchema.pre('save', async function(next) {
  if (this.isNew && !this.token.startsWith('$2')) {
    // Token is already hashed by crypto, no need to hash again with bcrypt
    // This is just a placeholder for any future token processing
  }
  next();
});

// Instance method to check if token is expired
passwordResetTokenSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Instance method to check if token is valid
passwordResetTokenSchema.methods.isValid = function() {
  return !this.used && !this.isExpired();
};

// Static method to clean up expired tokens
passwordResetTokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { used: true }
    ]
  });
  return result.deletedCount;
};

// Static method to find valid token
passwordResetTokenSchema.statics.findValidToken = async function(token) {
  return await this.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() }
  }).populate('userId');
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);