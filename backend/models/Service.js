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
    includedEquipment: [{
      equipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
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
        return this.serviceType === 'equipment' || this.serviceType === 'supply';
      },
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
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

// Instance method to add a new batch
serviceSchema.methods.addBatch = function(batchData) {
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
serviceSchema.methods.getActiveBatches = function() {
  return this.batches.filter(batch => batch.isActive);
};

// Instance method to get batches by expiry status
serviceSchema.methods.getExpiringBatches = function(daysAhead = 30) {
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
serviceSchema.methods.getExpiredBatches = function() {
  const now = new Date();
  return this.batches.filter(batch =>
    batch.isActive &&
    batch.expiryDate &&
    batch.expiryDate < now
  );
};

// Instance method to reduce batch quantity (FIFO - First In, First Out)
serviceSchema.methods.reduceBatchQuantity = async function(reduceQuantity) {
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
serviceSchema.methods.restoreBatchQuantity = async function(restoreQuantity) {
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
serviceSchema.methods.getBatchInventoryDetails = function() {
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

// Static method to get inventory summary across all services
serviceSchema.statics.getInventorySummary = async function() {
  const services = await this.find({
    serviceType: { $in: ['equipment', 'supply'] },
    isAvailable: true
  });

  const summary = {
    totalServices: services.length,
    totalQuantity: 0,
    totalBatches: 0,
    expiringCount: 0,
    expiredCount: 0,
    lowStockCount: 0,
    services: []
  };

  for (const service of services) {
    const details = service.getBatchInventoryDetails();
    summary.totalQuantity += details.totalQuantity;
    summary.totalBatches += details.totalBatches;
    summary.expiringCount += details.expiringCount;
    summary.expiredCount += details.expiredCount;

    if (service.quantity <= 5) {
      summary.lowStockCount++;
    }

    summary.services.push({
      id: service._id,
      name: service.name,
      category: service.category,
      quantity: service.quantity,
      batches: details.totalBatches,
      expiring: details.expiringCount,
      expired: details.expiredCount
    });
  }

  return summary;
};

module.exports = mongoose.model('Service', serviceSchema);
