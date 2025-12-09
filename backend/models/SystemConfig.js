const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema(
  {
    // Location settings
    location: {
      maxServiceToEventDistance: {
        type: Number,
        default: 50, // Maximum distance in km from service location to event location
        min: 0,
      },
      maxUserToEventDistance: {
        type: Number,
        default: 100, // Maximum distance in km from user location to event location
        min: 0,
      },
      defaultCountry: {
        type: String,
        default: 'Philippines',
      },
      defaultCoordinates: {
        lat: {
          type: Number,
          default: 14.5995, // Default to Manila coordinates
          min: -90,
          max: 90,
        },
        lng: {
          type: Number,
          default: 120.9842, // Default to Manila coordinates
          min: -180,
          max: 180,
        },
      },
      geocoding: {
        provider: {
          type: String,
          enum: ['nominatim', 'google', 'mapbox'],
          default: 'nominatim',
        },
        apiKey: {
          type: String, // For providers that require API keys
        },
        rateLimit: {
          type: Number,
          default: 1000, // Requests per hour
          min: 1,
        },
        cacheExpiryHours: {
          type: Number,
          default: 24, // How long to cache geocoding results
          min: 1,
        },
      },
      distanceCalculation: {
        formula: {
          type: String,
          enum: ['haversine', 'vincenty', 'spherical'],
          default: 'haversine',
        },
        earthRadiusKm: {
          type: Number,
          default: 6371, // Earth's radius in kilometers
          min: 1,
        },
      },
      validation: {
        requireEventLocation: {
          type: Boolean,
          default: true, // Whether event location is required for bookings
        },
        requireServiceLocation: {
          type: Boolean,
          default: true, // Whether service location is required for equipment
        },
        requireUserLocation: {
          type: Boolean,
          default: false, // Whether user location is required for bookings
        },
        strictDistanceValidation: {
          type: Boolean,
          default: false, // Whether to strictly enforce distance limits
        },
      },
    },
    // System-wide settings
    system: {
      name: {
        type: String,
        default: 'TrixTech Booking System',
      },
      version: {
        type: String,
        default: '1.0.0',
      },
      maintenance: {
        type: Boolean,
        default: false,
      },
      maintenanceMessage: {
        type: String,
        default: 'System is under maintenance. Please try again later.',
      },
    },
    // Feature flags
    features: {
      locationServices: {
        type: Boolean,
        default: true,
      },
      geocoding: {
        type: Boolean,
        default: true,
      },
      distanceValidation: {
        type: Boolean,
        default: true,
      },
      deliveryServices: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

// Ensure only one system config document exists
systemConfigSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existing = await this.constructor.findOne();
    if (existing) {
      const error = new Error('Only one system configuration document is allowed');
      return next(error);
    }
  }
  next();
});

// Static method to get the system config
systemConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = new this();
    await config.save();
  }
  return config;
};

// Static method to update location settings
systemConfigSchema.statics.updateLocationSettings = async function(updates) {
  const config = await this.getConfig();
  if (updates.location) {
    config.location = { ...config.location, ...updates.location };
  }
  return config.save();
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);