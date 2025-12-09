const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const SystemConfig = require('../models/SystemConfig');
const locationService = require('../utils/locationService');

// Geocode an address
router.post('/geocode', authMiddleware, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    const locationData = await locationService.geocodeAddress(address);

    res.json({
      success: true,
      data: locationData
    });
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to geocode address'
    });
  }
});

// Reverse geocode coordinates
router.post('/reverse-geocode', authMiddleware, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude are required'
      });
    }

    const addressData = await locationService.reverseGeocode({ lat, lng });

    res.json({
      success: true,
      data: addressData
    });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reverse geocode coordinates'
    });
  }
});

// Validate distances for booking
router.post('/validate-distance', authMiddleware, async (req, res) => {
  try {
    const {
      serviceLocation,
      eventLocation,
      userLocation
    } = req.body;

    const bookingData = {
      serviceLocation,
      eventLocation,
      userLocation
    };

    const validation = await locationService.validateBookingDistances(bookingData);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Distance validation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to validate distances'
    });
  }
});

// Get location configuration
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();

    res.json({
      success: true,
      data: {
        location: config.location,
        features: config.features
      }
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get location configuration'
    });
  }
});

// Update location configuration (admin only)
router.put('/config', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const updates = req.body;
    const config = await SystemConfig.updateLocationSettings(updates);

    res.json({
      success: true,
      data: {
        location: config.location,
        features: config.features
      },
      message: 'Location configuration updated successfully'
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update location configuration'
    });
  }
});

// Calculate distance between two points
router.post('/calculate-distance', authMiddleware, async (req, res) => {
  try {
    const { point1, point2 } = req.body;

    if (!point1?.lat || !point1?.lng || !point2?.lat || !point2?.lng) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates for both points are required'
      });
    }

    const distance = locationService.calculateDistance(point1, point2);

    res.json({
      success: true,
      data: {
        distance,
        unit: 'km',
        points: { point1, point2 }
      }
    });
  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate distance'
    });
  }
});

// Get cache statistics
router.get('/cache/stats', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = locationService.getCacheStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics'
    });
  }
});

// Clear geocoding cache (admin only)
router.post('/cache/clear', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    locationService.clearCache();

    res.json({
      success: true,
      message: 'Geocoding cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

module.exports = router;