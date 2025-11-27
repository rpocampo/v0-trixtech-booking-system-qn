const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
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
        'basic',
        'premium',
        'deluxe',
        'custom',
        'event-package',
        'wedding-package',
        'corporate-package',
        'birthday-package'
      ],
      required: true,
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
    inclusions: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
      },
      name: String,
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
      category: String,
      description: String,
      isRequired: {
        type: Boolean,
        default: true,
      },
      price: {
        type: Number,
        default: 0,
      }
    }],
    addOns: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
      name: String,
      quantity: {
        type: Number,
        min: 1,
        default: 1,
      },
      category: String,
      description: String,
      price: {
        type: Number,
        default: 0,
      },
      isPopular: {
        type: Boolean,
        default: false,
      }
    }],
    deliveryIncluded: {
      type: Boolean,
      default: false,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    setupFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalPrice: {
      type: Number,
      default: function() {
        return this.calculateTotalPrice();
      }
    },
    minGuests: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxGuests: {
      type: Number,
      min: 1,
    },
    duration: {
      type: Number, // in hours
      default: 4,
    },
    image: {
      type: String,
    },
    gallery: [{
      type: String,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 0, // Higher number = higher priority in suggestions
    },
    tags: [{
      type: String,
    }],
    requirements: [{
      type: String,
    }],
    termsAndConditions: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
packageSchema.index({ category: 1, isActive: 1 });
packageSchema.index({ eventTypes: 1 });
packageSchema.index({ isPopular: -1, priority: -1 });

// Method to calculate total price
packageSchema.methods.calculateTotalPrice = function() {
  let total = this.basePrice;

  // Add inclusion prices
  if (this.inclusions && this.inclusions.length > 0) {
    total += this.inclusions.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Add delivery fee if included
  if (this.deliveryIncluded && this.deliveryFee) {
    total += this.deliveryFee;
  }

  // Add setup fee
  if (this.setupFee) {
    total += this.setupFee;
  }

  // Apply discount
  if (this.discountPercentage > 0) {
    total = total * (1 - this.discountPercentage / 100);
  }

  return Math.round(total);
};

// Method to check if package is available for given criteria
packageSchema.methods.isAvailableFor = async function(eventType, guestCount, services = []) {
  // Check event type compatibility
  if (this.eventTypes && this.eventTypes.length > 0 && !this.eventTypes.includes(eventType)) {
    return { available: false, reason: 'Not compatible with event type' };
  }

  // Check guest count
  if (guestCount) {
    if (this.minGuests && guestCount < this.minGuests) {
      return { available: false, reason: `Minimum ${this.minGuests} guests required` };
    }
    if (this.maxGuests && guestCount > this.maxGuests) {
      return { available: false, reason: `Maximum ${this.maxGuests} guests allowed` };
    }
  }

  // Check if all required inclusions are available
  if (this.inclusions && this.inclusions.length > 0) {
    for (const inclusion of this.inclusions) {
      if (inclusion.isRequired) {
        const Service = mongoose.model('Service');
        const service = await Service.findById(inclusion.serviceId);

        if (!service || !service.isAvailable) {
          return { available: false, reason: `${inclusion.name} is not available` };
        }

        if (service.quantity !== undefined && service.quantity < inclusion.quantity) {
          return { available: false, reason: `Only ${service.quantity} ${inclusion.name} available` };
        }
      }
    }
  }

  return { available: true };
};

// Static method to suggest packages based on criteria
packageSchema.statics.suggestPackages = async function(criteria) {
  const {
    eventType,
    guestCount,
    selectedServices = [],
    budget,
    deliveryNeeded = false,
    maxSuggestions = 3
  } = criteria;

  let query = { isActive: true };

  // Filter by event type
  if (eventType) {
    query.eventTypes = eventType;
  }

  // Filter by guest count
  if (guestCount) {
    query.$or = [
      { minGuests: { $lte: guestCount } },
      { minGuests: { $exists: false } }
    ];
    query.$and = [
      {
        $or: [
          { maxGuests: { $gte: guestCount } },
          { maxGuests: { $exists: false } }
        ]
      }
    ];
  }

  // Filter by budget
  if (budget) {
    query.totalPrice = { $lte: budget };
  }

  // Filter by delivery
  if (deliveryNeeded) {
    query.deliveryIncluded = true;
  }

  // Find matching packages
  let packages = await this.find(query)
    .populate('inclusions.serviceId', 'name category price isAvailable quantity')
    .sort({ isPopular: -1, priority: -1, totalPrice: 1 })
    .limit(maxSuggestions * 2); // Get more to filter

  // Filter and score packages
  const scoredPackages = [];
  for (const pkg of packages) {
    const availability = await pkg.isAvailableFor(eventType, guestCount, selectedServices);

    if (availability.available) {
      // Calculate relevance score
      let score = 0;

      // Base score from priority and popularity
      score += pkg.priority;
      if (pkg.isPopular) score += 10;

      // Score based on service matches
      if (selectedServices && selectedServices.length > 0) {
        const matchingServices = pkg.inclusions.filter(inclusion =>
          selectedServices.some(service => service.id === inclusion.serviceId.toString())
        );
        score += matchingServices.length * 5;
      }

      // Score based on budget fit
      if (budget && pkg.totalPrice <= budget) {
        const budgetFit = 1 - (pkg.totalPrice / budget);
        score += budgetFit * 20;
      }

      scoredPackages.push({
        package: pkg,
        score,
        availability
      });
    }
  }

  // Sort by score and return top suggestions
  scoredPackages.sort((a, b) => b.score - a.score);

  return scoredPackages.slice(0, maxSuggestions).map(item => ({
    ...item.package.toObject(),
    relevanceScore: item.score,
    availability: item.availability
  }));
};

// Static method to get package details with availability
packageSchema.statics.getPackageWithAvailability = async function(packageId, eventType, guestCount) {
  const pkg = await this.findById(packageId)
    .populate('inclusions.serviceId', 'name category price isAvailable quantity description')
    .populate('addOns.serviceId', 'name category price isAvailable quantity description');

  if (!pkg) {
    return null;
  }

  const availability = await pkg.isAvailableFor(eventType, guestCount);

  return {
    ...pkg.toObject(),
    availability,
    calculatedTotalPrice: pkg.calculateTotalPrice()
  };
};

module.exports = mongoose.model('Package', packageSchema);