const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
    },
    category: {
      type: String,
      enum: [
        // Service-based categories
        'event-planning',
        'catering',
        'photography',
        'entertainment',
        'decoration',
        'setup-teardown',
        'cleaning',
        // Equipment/Supply categories
        'furniture',
        'lighting',
        'sound-system',
        'tents-canopies',
        'linens-tableware',
        'party-supplies',
        // Event type categories
        'wedding',
        'corporate',
        'birthday',
        'graduation',
        'other'
      ],
      required: true,
    },
    serviceType: {
      type: String,
      enum: ['service', 'equipment', 'supply'],
      required: true,
      default: 'service',
    },
    eventTypes: [{
      type: String,
      enum: ['wedding', 'corporate', 'birthday', 'graduation', 'party', 'conference', 'other'],
    }],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceType: {
      type: String,
      enum: ['per-hour', 'per-day', 'per-event', 'per-person', 'per-item', 'flat-rate'],
      default: 'flat-rate',
    },
    duration: {
      type: Number, // in minutes
      required: function() {
        return this.serviceType === 'service';
      },
    },
    image: {
      type: String,
    },
    gallery: [{
      type: String,
    }],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
      required: function() {
        return this.serviceType === 'equipment' || this.serviceType === 'supply';
      },
    },
    location: {
      type: String,
      enum: ['indoor', 'outdoor', 'both'],
      default: 'both',
    },
    tags: [{
      type: String,
    }],
    features: [{
      type: String,
    }],
    includedItems: [{
      type: String,
    }],
    requirements: [{
      type: String,
    }],
    minOrder: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxOrder: {
      type: Number,
      min: 1,
    },
    leadTime: {
      type: Number, // hours required for preparation
      default: 24,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
