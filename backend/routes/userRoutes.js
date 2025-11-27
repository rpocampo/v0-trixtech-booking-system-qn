const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Configure multer for QR code uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/qr-codes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `gcash-qr-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

const router = express.Router();

// Get all users (admin only)
router.get('/', adminMiddleware, async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, address },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// Upload GCash QR code
router.post('/:id/gcash-qr', authMiddleware, upload.single('qrCode'), async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No QR code file uploaded' });
    }

    const qrCodeUrl = `/uploads/qr-codes/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { gcashQRCode: qrCodeUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'GCash QR code uploaded successfully',
      user,
      qrCodeUrl
    });
  } catch (error) {
    next(error);
  }
});

// Set GCash QR code URL (alternative to upload)
router.put('/:id/gcash-qr', authMiddleware, async (req, res, next) => {
  try {
    const { qrCodeUrl } = req.body;

    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!qrCodeUrl) {
      return res.status(400).json({ success: false, message: 'QR code URL is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { gcashQRCode: qrCodeUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'GCash QR code set successfully',
      user
    });
  } catch (error) {
    next(error);
  }
});

// Remove GCash QR code
router.delete('/:id/gcash-qr', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete the file if it exists
    if (user.gcashQRCode && user.gcashQRCode.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', user.gcashQRCode);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    user.gcashQRCode = null;
    await user.save();

    res.json({
      success: true,
      message: 'GCash QR code removed successfully',
      user: user.toObject({ getters: true })
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
