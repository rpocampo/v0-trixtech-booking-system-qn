const express = require('express');
const multer = require('multer');
const path = require('path');
const Service = require('../models/Service');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
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

// Get all services
router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find({ isAvailable: true });
    res.json({ success: true, services });
  } catch (error) {
    next(error);
  }
});

// Get service by ID
router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Create service (admin only)
router.post('/', adminMiddleware, upload.single('image'), async (req, res, next) => {
  try {
    const { name, description, category, price, duration, quantity } = req.body;

    const serviceData = {
      name,
      description,
      category,
      price: parseFloat(price),
      duration: parseInt(duration),
      quantity: quantity ? parseInt(quantity) : undefined,
    };

    // Handle image upload
    if (req.file) {
      serviceData.image = `/uploads/${req.file.filename}`;
    }

    const service = new Service(serviceData);
    await service.save();
    res.status(201).json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Update service (admin only)
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Delete service (admin only)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
