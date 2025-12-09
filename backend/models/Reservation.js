const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipment',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    reservationDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    basePrice: {
      type: Number,
      required: true,
    },
    appliedMultiplier: {
      type: Number,
      default: 1.0,
    },
    daysBeforeCheckout: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paymentType: {
      type: String,
      enum: ['full'],
      default: 'full',
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    downPaymentPercentage: {
      type: Number,
      default: 30, // Default 30% down payment
    },
    notes: {
      type: String,
    },
    duration: {
      type: Number, // Duration in days
      default: 1,
      min: 1,
    },
    dailyRate: {
      type: Number, // Daily rate for the reservation
      default: 0,
    },
    // Delivery truck availability fields
    requiresDelivery: {
      type: Boolean,
      default: false,
    },
    deliveryStartTime: {
      type: Date,
    },
    deliveryEndTime: {
      type: Date,
    },
    deliveryDuration: {
      type: Number, // in minutes
      default: 60, // 1 hour default
    },
    itemQuantities: {
      type: Map,
      of: Number,
      default: {},
    },
    // Payment and invoice related fields
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    invoiceNumber: {
      type: String,
    },
    invoiceData: {
      type: mongoose.Schema.Types.Mixed, // Store complete invoice data
    },
    // Location fields for event and distance tracking
    eventLocation: {
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
    },
    // Distance tracking
    distanceTracking: {
      equipmentToEvent: {
        type: Number, // Distance in kilometers from equipment location to event location
        min: 0,
      },
      userToEvent: {
        type: Number, // Distance in kilometers from user location to event location
        min: 0,
      },
      equipmentToUser: {
        type: Number, // Distance in kilometers from equipment location to user location
        min: 0,
      },
      maxAllowedDistance: {
        type: Number, // Maximum allowed distance for this reservation (from system config)
        min: 0,
      },
      distanceValidated: {
        type: Boolean,
        default: false, // Whether distance validation passed
      },
      distanceValidationMessage: {
        type: String, // Message explaining validation result
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
