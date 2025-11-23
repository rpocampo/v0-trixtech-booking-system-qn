const nodemailer = require('nodemailer');
const User = require('../models/User');
const OTP = require('../models/OTP');

let transporter = null;

// Initialize email transporter
const initializeEmailService = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email service disabled - EMAIL_USER or EMAIL_PASSWORD not configured');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  console.log('Email service initialized');
  return transporter;
};

// Retry utility with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Circuit breaker state
let emailCircuitBreaker = {
  failures: 0,
  lastFailureTime: null,
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
};

// Circuit breaker check
const checkCircuitBreaker = () => {
  const now = Date.now();

  if (emailCircuitBreaker.state === 'OPEN') {
    if (now - emailCircuitBreaker.lastFailureTime > emailCircuitBreaker.recoveryTimeout) {
      emailCircuitBreaker.state = 'HALF_OPEN';
      console.log('Circuit breaker: HALF_OPEN - Testing service');
      return true;
    }
    return false;
  }

  return true;
};

// Update circuit breaker on failure
const recordFailure = () => {
  emailCircuitBreaker.failures++;
  emailCircuitBreaker.lastFailureTime = Date.now();

  if (emailCircuitBreaker.failures >= emailCircuitBreaker.failureThreshold) {
    emailCircuitBreaker.state = 'OPEN';
    console.log('Circuit breaker: OPEN - Service unavailable');
  }
};

// Update circuit breaker on success
const recordSuccess = () => {
  if (emailCircuitBreaker.state === 'HALF_OPEN') {
    emailCircuitBreaker.state = 'CLOSED';
    emailCircuitBreaker.failures = 0;
    console.log('Circuit breaker: CLOSED - Service recovered');
  }
};

// Send booking confirmation email with fallback
const sendBookingConfirmation = async (email, bookingDetails) => {
  if (!transporter) {
    console.log('Email service not configured, skipping confirmation');
    return;
  }

  if (!checkCircuitBreaker()) {
    console.log('Circuit breaker open, skipping email to prevent further failures');
    return;
  }

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: email,
    subject: 'Booking Confirmation - TRIXTECH',
    html: `
      <h2>Your booking has been confirmed!</h2>
      <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
      ${bookingDetails.quantity > 1 ? `<p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${bookingDetails.time}</p>
      <p><strong>Total Price:</strong> ₱${bookingDetails.totalPrice}</p>
      <p>Thank you for booking with TRIXTECH!</p>
    `,
  };

  try {
    await retryWithBackoff(async () => {
      await transporter.sendMail(mailOptions);
    });

    recordSuccess();
    console.log(`Booking confirmation sent to ${email}`);
  } catch (error) {
    recordFailure();
    console.error('Error sending email after retries:', error);

    // Fallback: Log to database for manual follow-up
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: null, // System notification
        type: 'system',
        title: 'Email Delivery Failed',
        message: `Failed to send booking confirmation to ${email}. Manual follow-up required.`,
        priority: 'high',
        channels: ['in-app'],
        metadata: { email, bookingDetails, error: error.message }
      });
    } catch (dbError) {
      console.error('Failed to log email failure to database:', dbError);
    }
  }
};

// Send booking cancellation email
const sendCancellationEmail = async (email, bookingDetails) => {
  if (!transporter) return;

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: email,
    subject: 'Booking Cancelled - TRIXTECH',
    html: `
      <h2>Your booking has been cancelled</h2>
      <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
      ${bookingDetails.quantity > 1 ? `<p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p>If you have any questions, please contact our support team.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Cancellation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Send admin notification for new booking
const sendAdminBookingNotification = async (bookingDetails, customerDetails) => {
  if (!transporter || !process.env.ADMIN_EMAIL) return;

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: process.env.ADMIN_EMAIL,
    subject: 'New Booking Received - TRIXTECH',
    html: `
      <h2>New Booking Alert!</h2>
      <p><strong>Customer:</strong> ${customerDetails.name} (${customerDetails.email})</p>
      <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
      ${bookingDetails.quantity > 1 ? `<p><strong>Quantity:</strong> ${bookingDetails.quantity}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString()}</p>
      <p><strong>Total Price:</strong> ₱${bookingDetails.totalPrice}</p>
      <p>Please review and confirm the booking.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Admin notification sent for new booking`);
  } catch (error) {
    console.error('Error sending admin email:', error);
  }
};

// Send low stock alert to admin
const sendLowStockAlert = async (serviceName, currentQuantity) => {
  if (!transporter || !process.env.ADMIN_EMAIL) return;

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: process.env.ADMIN_EMAIL,
    subject: 'Low Stock Alert - TRIXTECH',
    html: `
      <h2>Low Stock Alert!</h2>
      <p><strong>Service:</strong> ${serviceName}</p>
      <p><strong>Current Quantity:</strong> ${currentQuantity}</p>
      <p>Please restock this item soon.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Low stock alert sent for ${serviceName}`);
  } catch (error) {
    console.error('Error sending low stock email:', error);
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, userName, resetUrl) => {
  if (!transporter) {
    console.log('Email service not configured, skipping password reset email');
    return;
  }

  if (!checkCircuitBreaker()) {
    console.log('Circuit breaker open, skipping password reset email');
    return;
  }

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: email,
    subject: 'Password Reset - TRIXTECH',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TRIXTECH</h1>
          <p style="color: #e8e8e8; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Hi ${userName},
          </p>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your TRIXTECH account. If you made this request, click the button below to reset your password:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(102,126,234,0.3);">
              Reset Password
            </a>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <p style="color: #666; margin: 0; font-size: 14px;">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.
            </p>
          </div>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            If the button above doesn't work, you can copy and paste this link into your browser:
          </p>

          <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #666;">
            ${resetUrl}
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            If you have any questions, please contact our support team.<br>
            This email was sent to ${email}
          </p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #999; font-size: 12px;">
            © 2024 TRIXTECH. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await retryWithBackoff(async () => {
      await transporter.sendMail(mailOptions);
    });

    recordSuccess();
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    recordFailure();
    console.error('Error sending password reset email after retries:', error);

    // Fallback: Log to database for manual follow-up
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: null, // System notification
        type: 'system',
        title: 'Password Reset Email Failed',
        message: `Failed to send password reset email to ${email}. Manual follow-up required.`,
        priority: 'high',
        channels: ['in-app'],
        metadata: { email, userName, resetUrl, error: error.message }
      });
    } catch (dbError) {
      console.error('Failed to log email failure to database:', dbError);
    }
  }
};

// Send OTP email for verification
const sendOTPEmail = async (email, otp, purpose) => {
  // In development mode, log OTP to console instead of sending email
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log(`🔑 DEVELOPMENT MODE: OTP for ${email} (${purpose}): ${otp}`);
    console.log(`📧 This OTP would be sent via email in production`);
    return { success: true, development: true };
  }

  if (!transporter) {
    throw new Error('Email service not configured. Please check EMAIL_USER and EMAIL_PASSWORD in .env file');
  }

  if (!checkCircuitBreaker()) {
    throw new Error('Email service temporarily unavailable. Please try again later.');
  }

  // Get purpose display text
  const getPurposeText = (purpose) => {
    switch (purpose) {
      case 'email_verification':
        return 'Email Verification';
      case 'account_creation':
        return 'Account Creation';
      case 'contact_verification':
        return 'Contact Verification';
      case 'booking_confirmation':
        return 'Booking Confirmation';
      default:
        return 'Verification';
    }
  };

  const purposeText = getPurposeText(purpose);

  const mailOptions = {
    from: process.env.SENDER_EMAIL || 'noreply@trixtech.com',
    to: email,
    subject: `Your OTP Code - ${purposeText} - TRIXTECH`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">TRIXTECH</h1>
          <p style="color: #e8e8e8; margin: 10px 0 0 0; font-size: 16px;">${purposeText}</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">Your Verification Code</h2>

          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #f8f9fa; border: 2px solid #667eea; border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; font-family: 'Courier New', monospace; letter-spacing: 8px;">${otp}</span>
            </div>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>Important:</strong> This code will expire in 10 minutes. Please use it immediately.
            </p>
          </div>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            You requested a verification code for ${purposeText.toLowerCase()}. If you didn't request this code, please ignore this email.
          </p>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Enter this code in the verification form to complete your request.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            If you have any questions, please contact our support team.<br>
            This email was sent to ${email}
          </p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #999; font-size: 12px;">
            © 2024 TRIXTECH. All rights reserved.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await retryWithBackoff(async () => {
      await transporter.sendMail(mailOptions);
    });

    recordSuccess();
    console.log(`OTP email sent to ${email} for ${purpose}`);
    return { success: true };
  } catch (error) {
    recordFailure();
    console.error('Error sending OTP email after retries:', error);

    // Log failure for debugging
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: null, // System notification
        type: 'system',
        title: 'OTP Email Delivery Failed',
        message: `Failed to send OTP email to ${email} for ${purpose}. Manual follow-up required.`,
        priority: 'high',
        channels: ['in-app'],
        metadata: { email, purpose, error: error.message }
      });
    } catch (dbError) {
      console.error('Failed to log OTP email failure to database:', dbError);
    }

    throw new Error('Failed to send OTP email. Please try again later.');
  }
};

// Send SMS notification (placeholder for future implementation)
const sendSMSNotification = async (userId, notificationData) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.phone) return;

    // Placeholder for SMS service integration (e.g., Twilio, AWS SNS, etc.)
    // In a real implementation, you would integrate with an SMS service provider
    console.log('SMS notification would be sent to:', user.phone, notificationData.message);

    // Example integration structure:
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: notificationData.message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: user.phone
    // });

  } catch (error) {
    console.error('Error sending SMS notification:', error);
  }
};

module.exports = {
  initializeEmailService,
  sendBookingConfirmation,
  sendCancellationEmail,
  sendAdminBookingNotification,
  sendLowStockAlert,
  sendPasswordResetEmail,
  sendOTPEmail,
  sendSMSNotification,
};
