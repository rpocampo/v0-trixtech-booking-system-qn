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
    category: {
      type: String,
      enum: ['party', 'wedding', 'corporate', 'cleaning', 'equipment', 'other'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    image: {
      type: String,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
