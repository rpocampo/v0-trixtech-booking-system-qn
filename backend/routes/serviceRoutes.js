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

// Get all services with filtering
router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      serviceType,
      eventType,
      location,
      minPrice,
      maxPrice,
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    let query = { isAvailable: true };

    // Apply filters
    if (category) {
      query.category = category;
    }

    if (serviceType) {
      query.serviceType = serviceType;
    }

    if (eventType) {
      query.eventTypes = { $in: [eventType] };
    }

    if (location) {
      query.location = { $in: [location, 'both'] };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const services = await Service.find(query).sort(sortOptions);
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
router.post('/', adminMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), async (req, res, next) => {
  try {
    const {
      name,
      description,
      shortDescription,
      category,
      serviceType,
      eventTypes,
      price,
      priceType,
      duration,
      quantity,
      location,
      tags,
      features,
      includedItems,
      requirements,
      minOrder,
      maxOrder,
      leadTime
    } = req.body;

    const serviceData = {
      name,
      description,
      shortDescription,
      category,
      serviceType: serviceType || 'service',
      eventTypes: eventTypes ? (Array.isArray(eventTypes) ? eventTypes : [eventTypes]) : [],
      price: parseFloat(price),
      priceType: priceType || 'flat-rate',
      location: location || 'both',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      features: features ? (Array.isArray(features) ? features : [features]) : [],
      includedItems: includedItems ? (Array.isArray(includedItems) ? includedItems : [includedItems]) : [],
      requirements: requirements ? (Array.isArray(requirements) ? requirements : [requirements]) : [],
      minOrder: minOrder ? parseInt(minOrder) : 1,
      leadTime: leadTime ? parseInt(leadTime) : 24,
    };

    // Handle duration for services
    if (serviceType === 'service' && duration) {
      serviceData.duration = parseInt(duration);
    }

    // Handle quantity for equipment/supplies
    if ((serviceType === 'equipment' || serviceType === 'supply') && quantity) {
      serviceData.quantity = parseInt(quantity);
      if (maxOrder) {
        serviceData.maxOrder = parseInt(maxOrder);
      }
    }

    // Handle image uploads
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        serviceData.image = `/uploads/${req.files.image[0].filename}`;
      }

      if (req.files.gallery) {
        serviceData.gallery = req.files.gallery.map(file => `/uploads/${file.filename}`);
      }
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
    const oldService = await Service.findById(req.params.id);
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Emit real-time event for service update
    const io = global.io;
    if (io) {
      io.emit('service-updated', {
        serviceId: service._id,
        serviceName: service.name,
        category: service.category,
        quantity: service.quantity,
        oldQuantity: oldService?.quantity,
        isAvailable: service.isAvailable,
      });
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
