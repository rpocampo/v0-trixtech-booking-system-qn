const express = require('express');
const multer = require('multer');
const path = require('path');
const Equipment = require('../models/Equipment');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Validation helper for inclusions
const validateInclusions = (includedItems, equipmentType) => {
  if (!includedItems || !Array.isArray(includedItems)) {
    return { valid: false, message: 'Equipment inclusions must be provided as an array' };
  }

  const validItems = includedItems.filter(item => item && item.trim().length > 0);

  // Skip inclusion requirement for equipment equipment type
  if (equipmentType !== "equipment" && validItems.length === 0) {
    return { valid: false, message: 'At least one equipment inclusion is required' };
  }

  if (validItems.length !== includedItems.length) {
    return { valid: false, message: 'Equipment inclusions cannot contain empty items' };
  }

  return { valid: true, inclusions: validItems };
};

// Helper function to parse includedEquipment from FormData
const parseIncludedEquipment = (req) => {
  const equipment = [];

  // Check if we have equipment data in the request
  if (req.body['includedEquipment[][equipmentId]']) {
    const equipmentIds = Array.isArray(req.body['includedEquipment[][equipmentId]'])
      ? req.body['includedEquipment[][equipmentId]']
      : [req.body['includedEquipment[][equipmentId]']];

    const quantities = Array.isArray(req.body['includedEquipment[][quantity]'])
      ? req.body['includedEquipment[][quantity]']
      : [req.body['includedEquipment[][quantity]']];

    const names = Array.isArray(req.body['includedEquipment[][name]'])
      ? req.body['includedEquipment[][name]']
      : [req.body['includedEquipment[][name]']];

    // Build equipment array
    for (let i = 0; i < equipmentIds.length; i++) {
      if (equipmentIds[i] && quantities[i] && names[i]) {
        equipment.push({
          equipmentId: equipmentIds[i],
          quantity: parseInt(quantities[i]) || 1,
          name: names[i]
        });
      }
    }
  }

  return equipment;
};

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

// Get all equipment with filtering
router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      equipmentType,
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

    if (equipmentType) {
      query.equipmentType = equipmentType;
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

    const equipment = await Equipment.find(query).sort(sortOptions);

    // Ensure price is properly calculated for each equipment
    const equipmentWithPrice = equipment.map(eq => {
      const equipmentObj = eq.toObject();
      // Ensure price is set from basePrice - virtual getters don't serialize properly
      equipmentObj.price = eq.basePrice || 0;
      return equipmentObj;
    });

    res.json({ success: true, equipment: equipmentWithPrice });
  } catch (error) {
    next(error);
  }
});

// Get equipment by ID
router.get('/:id', async (req, res, next) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    // Track equipment view for authenticated users
    if (req.user && req.user.id) {
      try {
        const UserPreferences = require('../models/UserPreferences');
        await UserPreferences.trackServiceView(req.user.id, equipment._id, equipment.category, equipment.basePrice);
      } catch (preferenceError) {
        console.error('Error tracking equipment view:', preferenceError);
        // Don't fail the request if preference tracking fails
      }
    }

    // Ensure price is properly set from basePrice
    const equipmentObj = equipment.toObject();
    equipmentObj.price = equipment.basePrice || 0;

    res.json({ success: true, equipment: equipmentObj });
  } catch (error) {
    next(error);
  }
});

// Create equipment (admin only)
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
      equipmentType,
      eventTypes,
      price,
      priceType,
      duration,
      quantity,
      location,
      equipmentLocation, // New equipment location object
      tags,
      features,
      includedItems,
      requirements,
      minOrder,
      maxOrder,
      leadTime
    } = req.body;

    // Parse includedEquipment from FormData
    const includedEquipment = parseIncludedEquipment(req);

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Equipment name and description are required'
      });
    }

    // Validate and parse price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Equipment price must be a valid positive number'
      });
    }

    const equipmentData = {
      name,
      description,
      shortDescription,
      category,
      equipmentType: equipmentType || 'equipment',
      eventTypes: eventTypes ? (Array.isArray(eventTypes) ? eventTypes : [eventTypes]) : [],
      price: parsedPrice,
      priceType: priceType || 'flat-rate',
      location: location || 'both',
      equipmentLocation: equipmentLocation || {},
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      features: features ? (Array.isArray(features) ? features : [features]) : [],
      includedItems: includedItems ? (Array.isArray(includedItems) ? includedItems : [includedItems]) : [],
      includedEquipment: includedEquipment ? (Array.isArray(includedEquipment) ? includedEquipment : [includedEquipment]) : [],
      requirements: requirements ? (Array.isArray(requirements) ? requirements : [requirements]) : [],
      minOrder: minOrder ? parseInt(minOrder) : 1,
      leadTime: leadTime ? parseInt(leadTime) : 24,
    };

    // Validate inclusions
    const inclusionsValidation = validateInclusions(equipmentData.includedItems, equipmentData.equipmentType);
    if (!inclusionsValidation.valid) {
      return res.status(400).json({
        success: false,
        message: inclusionsValidation.message
      });
    }
    equipmentData.includedItems = inclusionsValidation.inclusions;

    // Handle duration for services
    if (equipmentType === 'service' && duration) {
      equipmentData.duration = parseInt(duration);
    }

    // Handle quantity for equipment/supplies
    if ((equipmentType === 'equipment' || equipmentType === 'supply') && quantity) {
      equipmentData.quantity = parseInt(quantity);
    }

    // Handle maxOrder for all equipment types
    if (maxOrder) {
      equipmentData.maxOrder = parseInt(maxOrder);
    }

    // Handle image uploads
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        equipmentData.image = `/uploads/${req.files.image[0].filename}`;
      }

      if (req.files.gallery) {
        equipmentData.gallery = req.files.gallery.map(file => `/uploads/${file.filename}`);
      }
    }

    const equipment = new Equipment(equipmentData);
    await equipment.save();
    res.status(201).json({ success: true, equipment });
  } catch (error) {
    next(error);
  }
});

// Update equipment (admin only)
router.put('/:id', adminMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), async (req, res, next) => {
  try {
    const oldEquipment = await Equipment.findById(req.params.id);
    if (!oldEquipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    const {
      name,
      description,
      shortDescription,
      category,
      equipmentType,
      eventTypes,
      price,
      priceType,
      duration,
      quantity,
      location,
      equipmentLocation, // New equipment location object
      tags,
      features,
      includedItems,
      requirements,
      minOrder,
      maxOrder,
      leadTime
    } = req.body;

    // Parse includedEquipment from FormData
    const includedEquipment = parseIncludedEquipment(req);

    const updateData = {};

    // Only validate and include fields that are provided
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description.trim();
    }
    if (shortDescription !== undefined) {
      updateData.shortDescription = shortDescription;
    }
    if (category !== undefined) {
      updateData.category = category;
    }
    if (equipmentType !== undefined) {
      updateData.equipmentType = equipmentType;
    }
    if (eventTypes !== undefined) {
      updateData.eventTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    }

    // Validate and parse price only if provided
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Service price must be a valid positive number'
        });
      }
      updateData.basePrice = parsedPrice;
    }

    if (priceType !== undefined) {
      updateData.priceType = priceType;
    }
    if (location !== undefined) {
      updateData.location = location;
    }
    if (equipmentLocation !== undefined) {
      updateData.equipmentLocation = equipmentLocation;
    }
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : [tags];
    }
    if (features !== undefined) {
      updateData.features = Array.isArray(features) ? features : [features];
    }
    if (includedItems !== undefined) {
      updateData.includedItems = Array.isArray(includedItems) ? includedItems : [includedItems];
    }
    if (includedEquipment !== undefined) {
      updateData.includedEquipment = Array.isArray(includedEquipment) ? includedEquipment : [includedEquipment];
    }
    if (requirements !== undefined) {
      updateData.requirements = Array.isArray(requirements) ? requirements : [requirements];
    }
    if (minOrder !== undefined) {
      updateData.minOrder = parseInt(minOrder);
    }
    if (leadTime !== undefined) {
      updateData.leadTime = parseInt(leadTime);
    }

    // Validate inclusions only if includedItems is being updated
    if (includedItems !== undefined) {
      const inclusionsValidation = validateInclusions(updateData.includedItems, equipmentType !== undefined ? equipmentType : oldEquipment.equipmentType);
      if (!inclusionsValidation.valid) {
        return res.status(400).json({
          success: false,
          message: inclusionsValidation.message
        });
      }
      updateData.includedItems = inclusionsValidation.inclusions;
    }

    // Handle duration for services
    if (equipmentType === 'service' && duration) {
      updateData.duration = parseInt(duration);
    }

    // Handle quantity for equipment/supplies
    // Allow quantity updates for equipment/supply items even if equipmentType is not in request body
    if (quantity !== undefined) {
      // Check if this is an equipment/supply item from the database
      if (oldEquipment.equipmentType === 'equipment' || oldEquipment.equipmentType === 'supply') {
        updateData.quantity = parseInt(quantity);
      }
    }

    // Handle maxOrder for all service types
    if (maxOrder !== undefined) {
      updateData.maxOrder = parseInt(maxOrder);
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

    const equipment = await Equipment.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    // Emit real-time event for equipment update
    const io = global.io;
    if (io) {
      io.emit('equipment-updated', {
        equipmentId: equipment._id,
        equipmentName: equipment.name,
        category: equipment.category,
        quantity: equipment.quantity,
        oldQuantity: oldEquipment?.quantity,
        isAvailable: equipment.isAvailable,
      });
    }

    // Ensure price is properly set from basePrice for the response
    const equipmentObj = equipment.toObject();
    equipmentObj.price = equipment.basePrice || 0;

    res.json({ success: true, equipment: equipmentObj });
  } catch (error) {
    next(error);
  }
});

// Delete equipment (admin only)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const equipment = await Equipment.findByIdAndDelete(req.params.id);
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }
    res.json({ success: true, message: 'Equipment deleted' });
  } catch (error) {
    next(error);
  }
});

// Get pricing information for equipment
router.get('/pricing/:equipmentId', authMiddleware, async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { daysBefore = 0 } = req.query;

    const pricingInfo = await Equipment.getPricingInfo(equipmentId, parseInt(daysBefore));

    if (!pricingInfo) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
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
