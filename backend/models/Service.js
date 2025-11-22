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
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    priceType: {
      type: String,
      enum: ['per-hour', 'per-day', 'per-event', 'per-person', 'per-item', 'flat-rate'],
      default: 'flat-rate',
    },
    pricingTiers: [{
      daysBefore: {
        type: Number,
        required: true,
        min: 0,
      },
      multiplier: {
        type: Number,
        required: true,
        min: 0.1,
        default: 1.0,
      },
      label: {
        type: String,
        default: function() {
          return `${this.daysBefore} days before`;
        }
      }
    }],
    // Keep price for backward compatibility, but use basePrice + pricingTiers for calculations
    price: {
      type: Number,
      get: function() {
        return this.basePrice;
      },
      set: function(value) {
        this.basePrice = value;
      }
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
    deliveryRequired: {
      type: Boolean,
      default: function() {
        // Equipment and supplies typically require delivery
        return this.serviceType === 'equipment' || this.serviceType === 'supply';
      },
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Add instance method to calculate price based on days before checkout
serviceSchema.methods.calculatePrice = function(daysBeforeCheckout = 0) {
  // Ensure basePrice is valid
  if (!this.basePrice || this.basePrice <= 0 || isNaN(this.basePrice)) {
    console.error(`Invalid basePrice for service ${this._id}: ${this.basePrice}`);
    return 0; // Return 0 to indicate invalid pricing
  }

  if (!this.pricingTiers || this.pricingTiers.length === 0) {
    return Math.round(this.basePrice);
  }

  // Sort tiers by daysBefore descending to find the most specific tier
  const sortedTiers = this.pricingTiers.sort((a, b) => b.daysBefore - a.daysBefore);

  // Find the applicable tier
  const applicableTier = sortedTiers.find(tier => daysBeforeCheckout >= tier.daysBefore);

  if (applicableTier && applicableTier.multiplier && !isNaN(applicableTier.multiplier)) {
    const calculatedPrice = this.basePrice * applicableTier.multiplier;
    return Math.round(calculatedPrice);
  }

  // If no tier applies or invalid tier, use base price
  return Math.round(this.basePrice);
};

// Add static method to get pricing information
serviceSchema.statics.getPricingInfo = function(serviceId, daysBeforeCheckout = 0) {
  return this.findById(serviceId).then(service => {
    if (!service) return null;

    const price = service.calculatePrice(daysBeforeCheckout);
    const basePrice = service.basePrice;

    // Find applicable tier for information
    let applicableTier = null;
    if (service.pricingTiers && service.pricingTiers.length > 0) {
      const sortedTiers = service.pricingTiers.sort((a, b) => b.daysBefore - a.daysBefore);
      applicableTier = sortedTiers.find(tier => daysBeforeCheckout >= tier.daysBefore);
    }

    return {
      basePrice,
      calculatedPrice: price,
      discount: applicableTier ? Math.round((1 - applicableTier.multiplier) * 100) : 0,
      tier: applicableTier,
      allTiers: service.pricingTiers || []
    };
  });
};

module.exports = mongoose.model('Service', serviceSchema);
