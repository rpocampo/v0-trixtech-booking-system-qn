const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema(
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
        'equipment',
        'party',
        'corporate',
        'wedding',
        'birthday',
        'funeral',
        'graduation party'
      ],
      required: true,
    },
    equipmentType: {
      type: String,
      enum: ['equipment', 'supply', 'service'],
      required: true,
      default: 'equipment',
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
        return this.equipmentType === 'service';
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
        return this.equipmentType === 'equipment' || this.equipmentType === 'supply';
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
    includedEquipment: [{
      equipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipment',
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
      name: String, // Cache the equipment name for display
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
        return this.equipmentType === 'equipment' || this.equipmentType === 'supply';
      },
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Location fields for equipment storage/availability
    equipmentLocation: {
      coordinates: {
        lat: {
          type: Number,
          min: -90,
          max: 90,
        },
        lng: {
          type: Number,
          min: -180,
          max: 180,
        },
      },
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      region: {
        type: String, // State/Province
      },
      postalCode: {
        type: String,
      },
      country: {
        type: String,
        default: 'Philippines',
      },
      formattedAddress: {
        type: String, // Full formatted address from geocoding
      },
      isDefaultLocation: {
        type: Boolean,
        default: false, // Whether this is the default pickup location
      },
    },
    // Batch/Lot tracking for inventory management
    batches: [{
      batchId: {
        type: String,
        required: true,
      },
      supplier: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 0,
      },
      unitCost: {
        type: Number,
        min: 0,
      },
      purchaseDate: {
        type: Date,
        default: Date.now,
      },
      expiryDate: {
        type: Date,
      },
      location: {
        type: String, // Warehouse location
      },
      notes: {
        type: String,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      }
    }],
  },
  { timestamps: true }
);

// Pre-save middleware to automatically detect location for equipment
equipmentSchema.pre('save', function(next) {
  // Only auto-detect for equipment and supply types
  if (this.equipmentType === 'equipment' || this.equipmentType === 'supply') {
    // Skip if location is already explicitly set and not 'both'
    if (this.location && this.location !== 'both') {
      return next();
    }

    const name = this.name ? this.name.toLowerCase() : '';
    const category = this.category ? this.category.toLowerCase() : '';

    // Equipment that is typically outdoor-only
    const outdoorKeywords = [
      'tent', 'canopy', 'awning', 'outdoor', 'garden', 'patio', 'lawn',
      'barbecue', 'bbq', 'grill', 'fire pit', 'fireplace', 'outdoor furniture',
      'deck', 'porch', 'terrace', 'balcony', 'pool', 'spa', 'jacuzzi',
      'hot tub', 'outdoor lighting', 'string lights', 'lantern', 'torch'
    ];

    // Equipment that is typically indoor-only
    const indoorKeywords = [
      'indoor', 'interior', 'house', 'home', 'room', 'hall', 'theater',
      'auditorium', 'conference room', 'meeting room', 'classroom',
      'kitchen', 'dining room', 'living room', 'bedroom', 'bathroom',
      'office', 'workspace', 'desk', 'chair', 'table', 'sofa', 'couch'
    ];

    // Check for outdoor keywords
    const isOutdoor = outdoorKeywords.some(keyword =>
      name.includes(keyword) || category.includes(keyword)
    );

    // Check for indoor keywords
    const isIndoor = indoorKeywords.some(keyword =>
      name.includes(keyword) || category.includes(keyword)
    );

    // Specific equipment types that are outdoor-only
    const outdoorEquipmentTypes = [
      'tents-canopies', 'outdoor-furniture', 'barbecue-grills',
      'outdoor-lighting', 'pools-spas', 'gardening-tools'
    ];

    // Specific equipment types that are indoor-only
    const indoorEquipmentTypes = [
      'indoor-furniture', 'kitchen-equipment', 'office-equipment',
      'audio-visual', 'stage-lighting', 'sound-systems'
    ];

    if (outdoorEquipmentTypes.includes(category) || isOutdoor) {
      this.location = 'outdoor';
    } else if (indoorEquipmentTypes.includes(category) || isIndoor) {
      this.location = 'indoor';
    } else {
      // Default to 'both' for equipment that can be used in either location
      this.location = 'both';
    }
  }

  next();
});

// Add instance method to calculate price based on days before checkout
equipmentSchema.methods.calculatePrice = function(daysBeforeCheckout = 0) {
  // Ensure basePrice is valid
  if (!this.basePrice || this.basePrice <= 0 || isNaN(this.basePrice)) {
    console.error(`Invalid basePrice for equipment ${this._id}: ${this.basePrice}`);
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
equipmentSchema.statics.getPricingInfo = function(equipmentId, daysBeforeCheckout = 0) {
  return this.findById(equipmentId).then(equipment => {
    if (!equipment) return null;

    const price = equipment.calculatePrice(daysBeforeCheckout);
    const basePrice = equipment.basePrice;

    // Find applicable tier for information
    let applicableTier = null;
    if (equipment.pricingTiers && equipment.pricingTiers.length > 0) {
      const sortedTiers = equipment.pricingTiers.sort((a, b) => b.daysBefore - a.daysBefore);
      applicableTier = sortedTiers.find(tier => daysBeforeCheckout >= tier.daysBefore);
    }

    return {
      basePrice,
      calculatedPrice: price,
      discount: applicableTier ? Math.round((1 - applicableTier.multiplier) * 100) : 0,
      tier: applicableTier,
      allTiers: equipment.pricingTiers || []
    };
  });
};

// Instance method to add a new batch
equipmentSchema.methods.addBatch = function(batchData) {
  const { batchId, supplier, quantity, unitCost, expiryDate, location, notes } = batchData;

  // Validate required fields
  if (!batchId || !supplier || quantity === undefined) {
    throw new Error('Batch ID, supplier, and quantity are required');
  }

  // Check if batch ID already exists
  const existingBatch = this.batches.find(batch => batch.batchId === batchId && batch.isActive);
  if (existingBatch) {
    throw new Error(`Batch ID ${batchId} already exists`);
  }

  // Add the batch
  this.batches.push({
    batchId,
    supplier,
    quantity,
    unitCost: unitCost || 0,
    expiryDate,
    location,
    notes,
    isActive: true,
    createdAt: new Date()
  });

  // Update total quantity
  this.quantity += quantity;

  return this.save();
};

// Instance method to get active batches
equipmentSchema.methods.getActiveBatches = function() {
  return this.batches.filter(batch => batch.isActive);
};

// Instance method to get batches by expiry status
equipmentSchema.methods.getExpiringBatches = function(daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.batches.filter(batch =>
    batch.isActive &&
    batch.expiryDate &&
    batch.expiryDate <= futureDate &&
    batch.expiryDate > new Date()
  );
};

// Instance method to get expired batches
equipmentSchema.methods.getExpiredBatches = function() {
  const now = new Date();
  return this.batches.filter(batch =>
    batch.isActive &&
    batch.expiryDate &&
    batch.expiryDate < now
  );
};

// Instance method to reduce batch quantity (FIFO - First In, First Out)
equipmentSchema.methods.reduceBatchQuantity = async function(reduceQuantity) {
  if (reduceQuantity <= 0) return;

  let remainingToReduce = reduceQuantity;
  const activeBatches = this.getActiveBatches().sort((a, b) =>
    new Date(a.createdAt) - new Date(b.createdAt)
  ); // Sort by creation date (FIFO)

  for (const batch of activeBatches) {
    if (remainingToReduce <= 0) break;

    const reduceFromBatch = Math.min(remainingToReduce, batch.quantity);
    batch.quantity -= reduceFromBatch;
    remainingToReduce -= reduceFromBatch;

    // Mark batch as inactive if empty
    if (batch.quantity <= 0) {
      batch.isActive = false;
    }
  }

  // Update total quantity
  this.quantity = Math.max(0, this.quantity - reduceQuantity);

  await this.save();
  return this.quantity;
};

// Instance method to restore batch quantity (reverse of reduceBatchQuantity)
equipmentSchema.methods.restoreBatchQuantity = async function(restoreQuantity) {
  if (restoreQuantity <= 0) return;

  // For restoration, we add to the most recently added active batch (LIFO for restoration)
  // or create a new batch if needed
  let activeBatches = this.getActiveBatches().sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  ); // Sort by creation date descending (most recent first)

  if (activeBatches.length === 0) {
    // No active batches, create a restoration batch
    this.batches.push({
      batchId: `RESTORED_${Date.now()}`,
      supplier: 'System Restoration',
      quantity: restoreQuantity,
      unitCost: 0,
      location: 'Restored Inventory',
      notes: 'Inventory restored due to booking cancellation',
      isActive: true,
      createdAt: new Date()
    });
  } else {
    // Add to the most recent batch
    activeBatches[0].quantity += restoreQuantity;
  }

  // Update total quantity
  this.quantity += restoreQuantity;

  await this.save();
  return this.quantity;
};

// Instance method to get batch inventory details
equipmentSchema.methods.getBatchInventoryDetails = function() {
  const activeBatches = this.getActiveBatches();
  const expiringBatches = this.getExpiringBatches(30);
  const expiredBatches = this.getExpiredBatches();

  return {
    totalQuantity: this.quantity,
    totalBatches: activeBatches.length,
    batches: activeBatches,
    expiringCount: expiringBatches.length,
    expiredCount: expiredBatches.length,
    expiringBatches,
    expiredBatches
  };
};

// Static method to get inventory summary across all equipment
equipmentSchema.statics.getInventorySummary = async function() {
  const equipment = await this.find({
    equipmentType: { $in: ['equipment', 'supply'] },
    isAvailable: true
  });

  const summary = {
    totalEquipment: equipment.length,
    totalQuantity: 0,
    totalBatches: 0,
    expiringCount: 0,
    expiredCount: 0,
    lowStockCount: 0,
    equipment: []
  };

  for (const eq of equipment) {
    const details = eq.getBatchInventoryDetails();
    summary.totalQuantity += details.totalQuantity;
    summary.totalBatches += details.totalBatches;
    summary.expiringCount += details.expiringCount;
    summary.expiredCount += details.expiredCount;

    if (eq.quantity <= 5) {
      summary.lowStockCount++;
    }

    summary.equipment.push({
      id: eq._id,
      name: eq.name,
      category: eq.category,
      quantity: eq.quantity,
      batches: details.totalBatches,
      expiring: details.expiringCount,
      expired: details.expiredCount
    });
  }

  return summary;
};

module.exports = mongoose.model('Equipment', equipmentSchema);
