const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { authMiddleware } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'customer',
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'trixtech_secret_key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'trixtech_secret_key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// Forgot Password - Request reset
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists (but don't reveal this information)
    const user = await User.findOne({ email });
    if (!user) {
      // Return success to prevent email enumeration attacks
      return res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    // Clean up any existing unused tokens for this user
    await PasswordResetToken.deleteMany({
      userId: user._id,
      used: false
    });

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').hash(resetToken).digest('hex');

    // Create password reset token
    const passwordResetToken = new PasswordResetToken({
      userId: user._id,
      token: hashedToken,
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    await passwordResetToken.save();

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
      console.log(`Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
});

// Verify Reset Token
router.get('/verify-reset-token/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').hash(token).digest('hex');

    const resetToken = await PasswordResetToken.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    res.json({ success: true, message: 'Token is valid' });
  } catch (error) {
    console.error('Verify token error:', error);
    next(error);
  }
});

// Reset Password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    if (!/(?=.*[a-z])/.test(password) || !/(?=.*[A-Z])/.test(password) || !/(?=.*\d)/.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
    }

    // Hash the token to find the reset token
    const hashedToken = crypto.createHash('sha256').hash(token).digest('hex');

    const resetToken = await PasswordResetToken.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Update user password
    const user = resetToken.userId;
    user.password = password;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    resetToken.usedAt = new Date();
    await resetToken.save();

    // Clean up any other unused tokens for this user
    await PasswordResetToken.deleteMany({
      userId: user._id,
      used: false
    });

    console.log(`Password reset successful for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
});

module.exports = router;
