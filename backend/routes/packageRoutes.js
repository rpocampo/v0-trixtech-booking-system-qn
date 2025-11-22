const express = require('express');
const Package = require('../models/Package');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get package suggestions based on criteria
router.get('/suggest', authMiddleware, async (req, res, next) => {
  try {
    const {
      eventType,
      guestCount,
      selectedServices,
      budget,
      deliveryNeeded,
      maxSuggestions = 3
    } = req.query;

    // Parse selectedServices if provided
    let parsedServices = [];
    if (selectedServices) {
      try {
        parsedServices = JSON.parse(selectedServices);
      } catch (error) {
        // If parsing fails, treat as comma-separated IDs
        parsedServices = selectedServices.split(',').map(id => ({ id: id.trim() }));
      }
    }

    const criteria = {
      eventType,
      guestCount: guestCount ? parseInt(guestCount) : undefined,
      selectedServices: parsedServices,
      budget: budget ? parseFloat(budget) : undefined,
      deliveryNeeded: deliveryNeeded === 'true',
      maxSuggestions: parseInt(maxSuggestions)
    };

    const suggestions = await Package.suggestPackages(criteria);

    res.json({
      success: true,
      suggestions,
      criteria
    });
  } catch (error) {
    next(error);
  }
});

// Get all packages (with optional filtering)
router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      eventType,
      minPrice,
      maxPrice,
      deliveryIncluded,
      isPopular,
      limit = 20,
      skip = 0
    } = req.query;

    let query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (eventType) {
      query.eventTypes = eventType;
    }

    if (minPrice || maxPrice) {
      query.totalPrice = {};
      if (minPrice) query.totalPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.totalPrice.$lte = parseFloat(maxPrice);
    }

    if (deliveryIncluded !== undefined) {
      query.deliveryIncluded = deliveryIncluded === 'true';
    }

    if (isPopular !== undefined) {
      query.isPopular = isPopular === 'true';
    }

    const packages = await Package.find(query)
      .populate('inclusions.serviceId', 'name category price isAvailable')
      .sort({ isPopular: -1, priority: -1, totalPrice: 1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Package.countDocuments(query);

    res.json({
      success: true,
      packages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get package by ID with full details
router.get('/:id', async (req, res, next) => {
  try {
    const { eventType, guestCount } = req.query;

    const package = await Package.getPackageWithAvailability(
      req.params.id,
      eventType,
      guestCount ? parseInt(guestCount) : undefined
    );

    if (!package) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    res.json({ success: true, package });
  } catch (error) {
    next(error);
  }
});

// Create package (admin only)
router.post('/', adminMiddleware, async (req, res, next) => {
  try {
    const packageData = req.body;

    // Calculate total price
    const package = new Package(packageData);
    package.totalPrice = package.calculateTotalPrice();

    await package.save();

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      package
    });
  } catch (error) {
    next(error);
  }
});

// Update package (admin only)
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'name', 'description', 'shortDescription', 'category', 'eventTypes',
      'basePrice', 'inclusions', 'addOns', 'deliveryIncluded', 'deliveryFee',
      'setupFee', 'discountPercentage', 'minGuests', 'maxGuests', 'duration',
      'image', 'gallery', 'isActive', 'isPopular', 'priority', 'tags',
      'requirements', 'termsAndConditions'
    ];

    // Filter out disallowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const package = await Package.findByIdAndUpdate(
      req.params.id,
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!package) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    // Recalculate total price
    package.totalPrice = package.calculateTotalPrice();
    await package.save();

    res.json({
      success: true,
      message: 'Package updated successfully',
      package
    });
  } catch (error) {
    next(error);
  }
});

// Delete package (admin only)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const package = await Package.findByIdAndDelete(req.params.id);

    if (!package) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get package categories
router.get('/meta/categories', async (req, res, next) => {
  try {
    const categories = await Package.distinct('category', { isActive: true });

    res.json({
      success: true,
      categories: categories.sort()
    });
  } catch (error) {
    next(error);
  }
});

// Get package event types
router.get('/meta/event-types', async (req, res, next) => {
  try {
    const eventTypes = await Package.distinct('eventTypes', { isActive: true });

    res.json({
      success: true,
      eventTypes: eventTypes.sort()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;