const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    expires: 30 * 24 * 60 * 60 // TTL index for automatic cleanup
  }
}, {
  timestamps: true
});

// Indexes for performance
cartSchema.index({ userId: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to update totals
cartSchema.pre('save', async function(next) {
  try {
    const Service = mongoose.model('Service');

    let totalItems = 0;
    let totalPrice = 0;

    if (this.items.length > 0) {
      const serviceIds = this.items.map(item => item.serviceId);
      const services = await Service.find({ _id: { $in: serviceIds } });
      const serviceMap = new Map(services.map(s => [s._id.toString(), s]));

      for (const item of this.items) {
        totalItems += item.quantity;

        // Get service price
        const service = serviceMap.get(item.serviceId.toString());
        if (service) {
          totalPrice += service.price * item.quantity;
        }
      }
    }

    this.totalItems = totalItems;
    this.totalPrice = totalPrice;
    this.lastActivity = new Date();

    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
cartSchema.methods.addItem = function(serviceId, quantity = 1) {
  const existingItem = this.items.find(item =>
    item.serviceId.toString() === serviceId.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.lastUpdated = new Date();
  } else {
    this.items.push({
      serviceId,
      quantity,
      addedAt: new Date(),
      lastUpdated: new Date()
    });
  }

  return this.save();
};

cartSchema.methods.updateItemQuantity = function(serviceId, quantity) {
  const item = this.items.find(item =>
    item.serviceId.toString() === serviceId.toString()
  );

  if (item) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      this.items = this.items.filter(item =>
        item.serviceId.toString() !== serviceId.toString()
      );
    } else {
      item.quantity = quantity;
      item.lastUpdated = new Date();
    }
  }

  return this.save();
};

cartSchema.methods.removeItem = function(serviceId) {
  this.items = this.items.filter(item =>
    item.serviceId.toString() !== serviceId.toString()
  );

  return this.save();
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

cartSchema.methods.validateStock = async function() {
  const Service = mongoose.model('Service');
  const issues = [];

  for (const item of this.items) {
    try {
      const service = await Service.findById(item.serviceId);

      if (!service) {
        issues.push(`Service ${item.serviceId} no longer exists`);
        continue;
      }

      if (!service.isAvailable) {
        issues.push(`${service.name} is no longer available`);
        continue;
      }

      // Check stock for equipment/supply items
      if ((service.serviceType === 'equipment' || service.serviceType === 'supply') &&
          service.quantity !== undefined) {
        if (service.quantity === 0) {
          issues.push(`${service.name} is out of stock`);
        } else if (service.quantity < item.quantity) {
          issues.push(`Only ${service.quantity} ${service.name} available (you have ${item.quantity} in cart)`);
        }
      }
    } catch (error) {
      issues.push(`Failed to validate ${item.serviceId}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

// Static methods
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ userId });

  if (!cart) {
    cart = new this({ userId, items: [] });
    await cart.save();
  }

  return cart;
};

cartSchema.statics.cleanupExpiredCarts = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });

  return result.deletedCount;
};

module.exports = mongoose.model('Cart', cartSchema);