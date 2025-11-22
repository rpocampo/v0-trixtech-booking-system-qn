const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    estimatedDuration: {
      type: Number, // in minutes
      default: 60, // 1 hour default
    },
    actualStartTime: {
      type: Date,
    },
    actualEndTime: {
      type: Date,
    },
    deliveryAddress: {
      type: String,
      required: true,
    },
    deliveryNotes: {
      type: String,
    },
    contactPerson: {
      name: String,
      phone: String,
    },
    items: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
      },
      name: String,
      quantity: Number,
      category: String,
    }],
    totalWeight: {
      type: Number, // in kg
      default: 0,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
  },
  { timestamps: true }
);

// Index for efficient queries
deliverySchema.index({ scheduledDate: 1, status: 1 });
deliverySchema.index({ customerId: 1 });
deliverySchema.index({ status: 1 });

// Virtual for checking if delivery is currently active
deliverySchema.virtual('isActive').get(function() {
  return this.status === 'in_progress';
});

// Virtual for checking if delivery is upcoming
deliverySchema.virtual('isUpcoming').get(function() {
  return this.status === 'scheduled' && this.scheduledDate > new Date();
});

// Method to check if delivery conflicts with another time slot
deliverySchema.methods.conflictsWith = function(otherDate, bufferMinutes = 60) {
  if (this.status === 'cancelled' || this.status === 'completed') {
    return false;
  }

  const thisStart = new Date(this.scheduledDate);
  const thisEnd = new Date(thisStart.getTime() + (this.estimatedDuration * 60000));

  // Add buffer time
  const thisEndWithBuffer = new Date(thisEnd.getTime() + (bufferMinutes * 60000));

  const otherStart = new Date(otherDate);
  const otherEnd = new Date(otherStart.getTime() + (this.estimatedDuration * 60000));

  // Check for overlap
  return (otherStart < thisEndWithBuffer && otherEnd > thisStart);
};

// Static method to check truck availability
deliverySchema.statics.checkAvailability = async function(requestedDate, estimatedDuration = 60, bufferMinutes = 60) {
  const requestedStart = new Date(requestedDate);
  const requestedEnd = new Date(requestedStart.getTime() + (estimatedDuration * 60000));

  // Find all active deliveries that might conflict
  const conflictingDeliveries = await this.find({
    status: { $in: ['scheduled', 'in_progress'] },
    $or: [
      // Delivery starts during our requested time
      {
        scheduledDate: {
          $gte: requestedStart,
          $lt: requestedEnd
        }
      },
      // Our requested time starts during a delivery (with buffer)
      {
        scheduledDate: {
          $lt: requestedStart,
          $gte: new Date(requestedStart.getTime() - (bufferMinutes * 60000))
        }
      },
      // Delivery overlaps with our buffer time
      {
        scheduledDate: {
          $gte: new Date(requestedEnd.getTime() - (bufferMinutes * 60000)),
          $lt: requestedEnd
        }
      }
    ]
  }).populate('customerId', 'name');

  if (conflictingDeliveries.length > 0) {
    const nextAvailableTime = this.calculateNextAvailableTime(conflictingDeliveries, requestedDate, bufferMinutes);
    return {
      available: false,
      conflictingDeliveries: conflictingDeliveries.map(d => ({
        id: d._id,
        customerName: d.customerId?.name || 'Unknown Customer',
        scheduledDate: d.scheduledDate,
        status: d.status,
        estimatedDuration: d.estimatedDuration
      })),
      nextAvailableTime,
      waitTimeMinutes: Math.ceil((nextAvailableTime - requestedStart) / (1000 * 60))
    };
  }

  return { available: true };
};

// Static method to calculate next available time
deliverySchema.statics.calculateNextAvailableTime = function(deliveries, requestedDate, bufferMinutes = 60) {
  let latestEndTime = new Date(requestedDate);

  for (const delivery of deliveries) {
    const deliveryStart = new Date(delivery.scheduledDate);
    const deliveryEnd = new Date(deliveryStart.getTime() + (delivery.estimatedDuration * 60000));
    const deliveryEndWithBuffer = new Date(deliveryEnd.getTime() + (bufferMinutes * 60000));

    if (deliveryEndWithBuffer > latestEndTime) {
      latestEndTime = deliveryEndWithBuffer;
    }
  }

  return latestEndTime;
};

// Static method to get current delivery status
deliverySchema.statics.getCurrentStatus = async function() {
  const now = new Date();

  // Check for active delivery
  const activeDelivery = await this.findOne({
    status: 'in_progress'
  }).populate('customerId', 'name').populate('bookingId');

  if (activeDelivery) {
    return {
      status: 'busy',
      currentDelivery: {
        id: activeDelivery._id,
        customerName: activeDelivery.customerId?.name || 'Unknown Customer',
        scheduledDate: activeDelivery.scheduledDate,
        estimatedDuration: activeDelivery.estimatedDuration,
        actualStartTime: activeDelivery.actualStartTime
      },
      nextAvailableTime: new Date(activeDelivery.scheduledDate.getTime() + (activeDelivery.estimatedDuration * 60000) + (60 * 60000)) // +1 hour buffer
    };
  }

  // Check for next scheduled delivery
  const nextDelivery = await this.findOne({
    status: 'scheduled',
    scheduledDate: { $gte: now }
  }).sort({ scheduledDate: 1 }).populate('customerId', 'name');

  if (nextDelivery) {
    return {
      status: 'scheduled',
      nextDelivery: {
        id: nextDelivery._id,
        customerName: nextDelivery.customerId?.name || 'Unknown Customer',
        scheduledDate: nextDelivery.scheduledDate,
        estimatedDuration: nextDelivery.estimatedDuration
      }
    };
  }

  return { status: 'available' };
};

module.exports = mongoose.model('Delivery', deliverySchema);