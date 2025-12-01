const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const UserPreferences = require('../models/UserPreferences');
const Service = require('../models/Service');
const Package = require('../models/Package');

const router = express.Router();

// Get personalized recommendations for a user
router.get('/personalized', authMiddleware, async (req, res, next) => {
  try {
    const { limit = 6 } = req.query;

    const preferences = await UserPreferences.findOne({ userId: req.user.id });

    let recommendations = [];

    if (preferences) {
      recommendations = await preferences.getPersonalizedRecommendations(parseInt(limit));
    }

    // If no personalized recommendations, show popular services
    if (recommendations.length === 0) {
      const popularServices = await Service.find({
        isAvailable: true,
        isPopular: true
      })
      .limit(parseInt(limit))
      .sort({ basePrice: 1 }); // Show lower-priced popular services first

      recommendations = popularServices.map(service => ({
        item: {
          _id: service._id,
          name: service.name,
          description: service.description,
          shortDescription: service.description?.substring(0, 100) + (service.description?.length > 100 ? '...' : ''),
          category: service.category,
          basePrice: service.basePrice,
          image: service.image,
          isPopular: service.isPopular
        },
        type: 'service',
        score: 0.5,
        reason: 'Popular service - great choice for events!'
      }));

      // If still no recommendations, show any available services
      if (recommendations.length === 0) {
        const anyServices = await Service.find({
          isAvailable: true
        })
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }); // Show newest services first

        recommendations = anyServices.map(service => ({
          item: {
            _id: service._id,
            name: service.name,
            description: service.description,
            shortDescription: service.description?.substring(0, 100) + (service.description?.length > 100 ? '...' : ''),
            category: service.category,
            basePrice: service.basePrice,
            image: service.image,
            isPopular: service.isPopular
          },
          type: 'service',
          score: 0.3,
          reason: 'New service - check it out!'
        }));
      }
    }

    res.json({
      success: true,
      recommendations,
      total: recommendations.length
    });
  } catch (error) {
    next(error);
  }
});

// Track service view for preference learning
router.post('/track-view', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.body;

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Service ID is required' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await UserPreferences.trackServiceView(req.user.id, serviceId, service.category, service.basePrice);

    res.json({ success: true, message: 'View tracked successfully' });
  } catch (error) {
    next(error);
  }
});

// Add service to favorites
router.post('/favorites', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.body;

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Service ID is required' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const preferences = await UserPreferences.getOrCreatePreferences(req.user.id);
    await preferences.addToFavorites(serviceId, service.category);

    res.json({ success: true, message: 'Added to favorites' });
  } catch (error) {
    next(error);
  }
});

// Remove service from favorites
router.delete('/favorites/:serviceId', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    const preferences = await UserPreferences.findOne({ userId: req.user.id });
    if (!preferences) {
      return res.status(404).json({ success: false, message: 'Preferences not found' });
    }

    await preferences.removeFromFavorites(serviceId);

    res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    next(error);
  }
});

// Get user's favorites
router.get('/favorites', authMiddleware, async (req, res, next) => {
  try {
    const preferences = await UserPreferences.findOne({ userId: req.user.id })
      .populate('favorites.serviceId');

    if (!preferences) {
      return res.json({ success: true, favorites: [] });
    }

    const favorites = preferences.favorites
      .filter(fav => fav.serviceId) // Filter out any deleted services
      .map(fav => ({
        serviceId: fav.serviceId,
        addedAt: fav.addedAt,
        category: fav.category
      }));

    res.json({ success: true, favorites });
  } catch (error) {
    next(error);
  }
});

// Get user's preference summary
router.get('/preferences/summary', authMiddleware, async (req, res, next) => {
  try {
    const preferences = await UserPreferences.findOne({ userId: req.user.id });

    if (!preferences) {
      return res.json({
        success: true,
        preferences: null,
        message: 'No preferences found yet'
      });
    }

    // Get top categories
    const topCategories = preferences.categoryPreferences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(cat => ({
        category: cat.category,
        score: cat.score,
        interactionCount: cat.interactionCount
      }));

    // Get top event types
    const topEventTypes = preferences.eventTypePreferences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(et => ({
        eventType: et.eventType,
        score: et.score,
        bookingCount: et.bookingCount
      }));

    const summary = {
      topCategories,
      topEventTypes,
      pricePreferences: preferences.pricePreferences,
      bookingPatterns: preferences.bookingPatterns,
      favoritesCount: preferences.favorites.length,
      recentlyViewedCount: preferences.recentlyViewed.length,
      recommendationSettings: preferences.recommendationSettings
    };

    res.json({ success: true, preferences: summary });
  } catch (error) {
    next(error);
  }
});

// Update recommendation settings
router.put('/settings', authMiddleware, async (req, res, next) => {
  try {
    const { enablePersonalized, enableCollaborative, maxRecommendations } = req.body;

    const preferences = await UserPreferences.getOrCreatePreferences(req.user.id);

    if (enablePersonalized !== undefined) {
      preferences.recommendationSettings.enablePersonalized = enablePersonalized;
    }
    if (enableCollaborative !== undefined) {
      preferences.recommendationSettings.enableCollaborative = enableCollaborative;
    }
    if (maxRecommendations !== undefined) {
      preferences.recommendationSettings.maxRecommendations = Math.max(1, Math.min(20, maxRecommendations));
    }

    await preferences.save();

    res.json({
      success: true,
      message: 'Recommendation settings updated',
      settings: preferences.recommendationSettings
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;