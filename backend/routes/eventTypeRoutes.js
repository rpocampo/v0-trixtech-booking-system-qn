const express = require('express');
const EventType = require('../models/EventType');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all active event types
router.get('/', async (req, res, next) => {
  try {
    const eventTypes = await EventType.getActiveEventTypes()
      .populate('recommendedPackages');

    res.json({
      success: true,
      eventTypes: eventTypes.map(et => ({
        id: et._id,
        name: et.name,
        slug: et.slug,
        description: et.description,
        shortDescription: et.shortDescription,
        category: et.category,
        icon: et.icon,
        typicalGuestCount: et.typicalGuestCount,
        typicalDuration: et.typicalDuration,
        recommendedCategories: et.recommendedCategories,
        tags: et.tags,
        seasonalNotes: et.seasonalNotes,
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get event type by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const eventType = await EventType.getBySlug(req.params.slug)
      .populate('recommendedPackages');

    if (!eventType) {
      return res.status(404).json({ success: false, message: 'Event type not found' });
    }

    res.json({
      success: true,
      eventType: {
        id: eventType._id,
        name: eventType.name,
        slug: eventType.slug,
        description: eventType.description,
        shortDescription: eventType.shortDescription,
        category: eventType.category,
        icon: eventType.icon,
        typicalGuestCount: eventType.typicalGuestCount,
        typicalDuration: eventType.typicalDuration,
        recommendedServices: eventType.getServiceRecommendations(),
        recommendedPackages: eventType.recommendedPackages,
        tags: eventType.tags,
        seasonalNotes: eventType.seasonalNotes,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get service recommendations for an event type
router.get('/:slug/recommendations', async (req, res, next) => {
  try {
    const eventType = await EventType.getBySlug(req.params.slug);

    if (!eventType) {
      return res.status(404).json({ success: false, message: 'Event type not found' });
    }

    res.json({
      success: true,
      eventType: eventType.name,
      recommendations: eventType.getServiceRecommendations()
    });
  } catch (error) {
    next(error);
  }
});

// Create event type (admin only)
router.post('/', adminMiddleware, async (req, res, next) => {
  try {
    const eventTypeData = req.body;

    // Generate slug from name if not provided
    if (!eventTypeData.slug) {
      eventTypeData.slug = eventTypeData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const eventType = new EventType(eventTypeData);
    await eventType.save();

    res.status(201).json({
      success: true,
      message: 'Event type created successfully',
      eventType
    });
  } catch (error) {
    next(error);
  }
});

// Update event type (admin only)
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'name', 'slug', 'description', 'shortDescription', 'category',
      'typicalGuestCount', 'typicalDuration', 'recommendedServices',
      'recommendedPackages', 'image', 'icon', 'isActive', 'displayOrder',
      'tags', 'seasonalNotes'
    ];

    // Filter out disallowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const eventType = await EventType.findByIdAndUpdate(
      req.params.id,
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!eventType) {
      return res.status(404).json({ success: false, message: 'Event type not found' });
    }

    res.json({
      success: true,
      message: 'Event type updated successfully',
      eventType
    });
  } catch (error) {
    next(error);
  }
});

// Delete event type (admin only)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const eventType = await EventType.findByIdAndDelete(req.params.id);

    if (!eventType) {
      return res.status(404).json({ success: false, message: 'Event type not found' });
    }

    res.json({
      success: true,
      message: 'Event type deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get event type categories
router.get('/meta/categories', async (req, res, next) => {
  try {
    const categories = await EventType.distinct('category', { isActive: true });

    res.json({
      success: true,
      categories: categories.sort()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;