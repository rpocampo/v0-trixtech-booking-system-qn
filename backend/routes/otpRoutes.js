const express = require('express');
const { generateAndSendOTP, verifyOTP, getOTPStatus } = require('../utils/otpService');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Send OTP for verification
router.post('/send', async (req, res, next) => {
  try {
    const { email, purpose, metadata } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email and purpose are required'
      });
    }

    // Validate purpose
    const validPurposes = ['email_verification', 'account_creation', 'contact_verification', 'booking_confirmation'];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purpose. Must be one of: ' + validPurposes.join(', ')
      });
    }

    const result = await generateAndSendOTP(email, purpose, metadata || {});

    res.json({
      success: true,
      message: result.message,
      expiresIn: result.expiresIn,
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP. Please try again later.'
    });
  }
});

// Verify OTP
router.post('/verify', async (req, res, next) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and purpose are required'
      });
    }

    const result = await verifyOTP(email, otp, purpose);

    res.json({
      success: true,
      message: result.message,
      metadata: result.metadata,
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);

    // Provide specific error messages based on error type
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('expired')) {
      statusCode = 410; // Gone
      message = 'OTP has expired. Please request a new one.';
    } else if (error.message.includes('Invalid OTP')) {
      message = 'Invalid OTP code. Please check and try again.';
    } else if (error.message.includes('Maximum verification attempts')) {
      statusCode = 429; // Too Many Requests
      message = 'Too many failed attempts. Please request a new OTP.';
    } else if (error.message.includes('already been used')) {
      message = 'OTP has already been used. Please request a new one.';
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// Get OTP status (admin only - for debugging)
router.get('/status/:email/:purpose', adminMiddleware, async (req, res, next) => {
  try {
    const { email, purpose } = req.params;

    const status = await getOTPStatus(email, purpose);

    res.json({
      success: true,
      email,
      purpose,
      otps: status,
    });

  } catch (error) {
    console.error('Error getting OTP status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OTP status'
    });
  }
});

// Test endpoint for OTP functionality (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-send', async (req, res, next) => {
    try {
      const { email, purpose } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Generate a test OTP without sending email
      const OTP = require('../models/OTP');
      const otp = OTP.generateOTP();

      // Create OTP record
      const otpRecord = new OTP({
        email,
        otp,
        purpose: purpose || 'email_verification',
        metadata: { test: true },
      });

      await otpRecord.save();

      res.json({
        success: true,
        message: 'Test OTP generated (check console for OTP code)',
        otp, // Only return in development
        expiresIn: 600,
      });

    } catch (error) {
      console.error('Error in test OTP generation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate test OTP'
      });
    }
  });
}

module.exports = router;