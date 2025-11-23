const OTP = require('../models/OTP');
const { sendOTPEmail } = require('./emailService');

// Generate and send OTP
const generateAndSendOTP = async (email, purpose, metadata = {}) => {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Check if there's already a valid OTP for this email and purpose
    const existingOTP = await OTP.findOne({
      email,
      purpose,
      isUsed: false,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 }
    });

    if (existingOTP) {
      // Check if we should allow resending (minimum 1 minute between sends)
      const timeSinceLastSend = Date.now() - existingOTP.createdAt.getTime();
      if (timeSinceLastSend < 60000) { // 1 minute
        throw new Error('Please wait before requesting another OTP');
      }
    }

    // Generate new OTP
    const otp = OTP.generateOTP();

    // Create OTP record
    const otpRecord = new OTP({
      email,
      otp,
      purpose,
      metadata,
    });

    await otpRecord.save();

    // Send OTP email
    await sendOTPEmail(email, otp, purpose);

    return {
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
    };

  } catch (error) {
    console.error('Error generating/sending OTP:', error);
    throw error;
  }
};

// Verify OTP
const verifyOTP = async (email, otp, purpose) => {
  try {
    // Find valid OTP
    const otpRecord = await OTP.findValidOTP(email, purpose, otp);

    if (!otpRecord) {
      throw new Error('Invalid or expired OTP');
    }

    // Verify the OTP
    otpRecord.verifyOTP(otp);
    await otpRecord.save();

    return {
      success: true,
      message: 'OTP verified successfully',
      metadata: otpRecord.metadata,
    };

  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

// Get OTP status (for debugging/admin purposes)
const getOTPStatus = async (email, purpose) => {
  try {
    const otpRecords = await OTP.find({
      email,
      purpose,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).limit(5);

    return otpRecords.map(record => ({
      id: record._id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      attempts: record.attempts,
      isExpired: record.expiresAt < new Date(),
    }));

  } catch (error) {
    console.error('Error getting OTP status:', error);
    throw error;
  }
};

// Cleanup expired OTPs (should be called by a scheduled job)
const cleanupExpiredOTPs = async () => {
  try {
    const deletedCount = await OTP.cleanupExpired();
    console.log(`Cleaned up ${deletedCount} expired OTP records`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
    throw error;
  }
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  generateAndSendOTP,
  verifyOTP,
  getOTPStatus,
  cleanupExpiredOTPs,
  validateEmail,
};