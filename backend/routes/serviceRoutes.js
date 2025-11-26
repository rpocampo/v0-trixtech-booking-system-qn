const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Service = require('../models/Service');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Validation helper for inclusions
const validateInclusions = (includedItems) => {
  if (!includedItems || !Array.isArray(includedItems)) {
    return { valid: false, message: 'Service inclusions must be provided as an array' };
  }

  const validItems = includedItems.filter(item => item && item.trim().length > 0);

  if (validItems.length === 0) {
    return { valid: false, message: 'At least one service inclusion is required' };
  }

  if (validItems.length !== includedItems.length) {
    return { valid: false, message: 'Service inclusions cannot contain empty items' };
  }

  return { valid: true, inclusions: validItems };
};

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../uploads/');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
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

    // Ensure price is properly calculated for each service
    const servicesWithPrice = services.map(service => {
      const serviceObj = service.toObject();
      // Ensure price is set from basePrice - virtual getters don't serialize properly
      serviceObj.price = service.basePrice || 0;
      return serviceObj;
    });

    res.json({ success: true, services: servicesWithPrice });
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

    // Track service view for authenticated users
    if (req.user && req.user.id) {
      try {
        const UserPreferences = require('../models/UserPreferences');
        await UserPreferences.trackServiceView(req.user.id, service._id, service.category, service.basePrice);
      } catch (preferenceError) {
        console.error('Error tracking service view:', preferenceError);
        // Don't fail the request if preference tracking fails
      }
    }

    // Ensure price is properly set from basePrice
    const serviceObj = service.toObject();
    serviceObj.price = service.basePrice || 0;

    res.json({ success: true, service: serviceObj });
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

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Service name and description are required'
      });
    }

    // Check for duplicate service name (only for create, not update)
    const existingService = await Service.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingService) {
      return res.status(409).json({
        success: false,
        message: 'A service with this name already exists. Please choose a different name.'
      });
    }

    // Validate and parse price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Service price must be a valid positive number'
      });
    }

    const serviceData = {
      name,
      description,
      shortDescription,
      category,
      serviceType: serviceType || 'service',
      eventTypes: eventTypes ? (Array.isArray(eventTypes) ? eventTypes : [eventTypes]) : [],
      price: parsedPrice,
      priceType: priceType || 'flat-rate',
      location: location || 'both',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      features: features ? (Array.isArray(features) ? features : [features]) : [],
      includedItems: includedItems ? (Array.isArray(includedItems) ? includedItems : [includedItems]) : [],
      requirements: requirements ? (Array.isArray(requirements) ? requirements : [requirements]) : [],
      minOrder: minOrder ? parseInt(minOrder) : 1,
      leadTime: leadTime ? parseInt(leadTime) : 24,
    };

    // Validate inclusions (skip for equipment-type services)
    if (serviceType === 'equipment' && category === 'equipment') {
      // Equipment services don't require inclusions
      serviceData.includedItems = includedItems ? (Array.isArray(includedItems) ? includedItems : [includedItems]) : [];
    } else {
      // Other service types require inclusions
      const inclusionsValidation = validateInclusions(serviceData.includedItems);
      if (!inclusionsValidation.valid) {
        return res.status(400).json({
          success: false,
          message: inclusionsValidation.message
        });
      }
      serviceData.includedItems = inclusionsValidation.inclusions;
    }

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

    // Emit real-time event for service creation
    const io = global.io;
    if (io) {
      io.emit('service-created', {
        serviceId: service._id,
        serviceName: service.name,
        category: service.category,
        serviceType: service.serviceType,
      });
    }

    res.status(201).json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Update service (admin only)
router.put('/:id', adminMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), async (req, res, next) => {
  try {
    const oldService = await Service.findById(req.params.id);
    if (!oldService) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

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

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Service name and description are required'
      });
    }

    // Validate and parse price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Service price must be a valid positive number'
      });
    }

    const updateData = {
      name,
      description,
      shortDescription,
      category,
      serviceType: serviceType || 'service',
      eventTypes: eventTypes ? (Array.isArray(eventTypes) ? eventTypes : [eventTypes]) : [],
      price: parsedPrice,
      priceType: priceType || 'flat-rate',
      location: location || 'both',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      features: features ? (Array.isArray(features) ? features : [features]) : [],
      includedItems: includedItems ? (Array.isArray(includedItems) ? includedItems : [includedItems]) : [],
      requirements: requirements ? (Array.isArray(requirements) ? requirements : [requirements]) : [],
      minOrder: minOrder ? parseInt(minOrder) : 1,
      leadTime: leadTime ? parseInt(leadTime) : 24,
    };

    // Validate inclusions (skip for equipment-type services)
    if (serviceType === 'equipment' && category === 'equipment') {
      // Equipment services don't require inclusions
      updateData.includedItems = includedItems ? (Array.isArray(includedItems) ? includedItems : [includedItems]) : [];
    } else {
      // Other service types require inclusions
      const inclusionsValidation = validateInclusions(updateData.includedItems);
      if (!inclusionsValidation.valid) {
        return res.status(400).json({
          success: false,
          message: inclusionsValidation.message
        });
      }
      updateData.includedItems = inclusionsValidation.inclusions;
    }

    // Handle duration for services
    if (serviceType === 'service' && duration) {
      updateData.duration = parseInt(duration);
    }

    // Handle quantity for equipment/supplies
    if ((serviceType === 'equipment' || serviceType === 'supply') && quantity) {
      updateData.quantity = parseInt(quantity);
      if (maxOrder) {
        updateData.maxOrder = parseInt(maxOrder);
      }
    }

    // Handle image uploads
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        updateData.image = `/uploads/${req.files.image[0].filename}`;
      }

      if (req.files.gallery) {
        updateData.gallery = req.files.gallery.map(file => `/uploads/${file.filename}`);
      }
    }

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

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

    // Emit real-time event for service deletion
    const io = global.io;
    if (io) {
      io.emit('service-deleted', {
        serviceId: service._id,
        serviceName: service.name,
        category: service.category,
      });
    }

    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    next(error);
  }
});

// Get pricing information for a service
router.get('/pricing/:serviceId', authMiddleware, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { daysBefore = 0 } = req.query;

    const pricingInfo = await Service.getPricingInfo(serviceId, parseInt(daysBefore));

    if (!pricingInfo) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({
      success: true,
      ...pricingInfo
    });
  } catch (error) {
    console.error('Error getting pricing info:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
