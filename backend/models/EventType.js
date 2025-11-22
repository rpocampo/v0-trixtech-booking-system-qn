const mongoose = require('mongoose');

const eventTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
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
      enum: ['celebration', 'corporate', 'community', 'other'],
      default: 'celebration',
    },
    typicalGuestCount: {
      min: {
        type: Number,
        default: 1,
      },
      max: {
        type: Number,
        default: 100,
      },
      suggested: {
        type: Number,
        default: 50,
      }
    },
    typicalDuration: {
      type: Number, // in hours
      default: 4,
    },
    recommendedServices: [{
      category: {
        type: String,
        required: true,
      },
      priority: {
        type: Number,
        default: 1, // Higher number = higher priority
        min: 1,
        max: 5,
      },
      isRequired: {
        type: Boolean,
        default: false,
      },
      notes: String,
    }],
    recommendedPackages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
    }],
    image: {
      type: String,
    },
    icon: {
      type: String, // Icon name or emoji
      default: '🎉',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    tags: [{
      type: String,
    }],
    seasonalNotes: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
eventTypeSchema.index({ slug: 1 });
eventTypeSchema.index({ category: 1, isActive: 1 });
eventTypeSchema.index({ displayOrder: 1 });

// Virtual for getting recommended service categories
eventTypeSchema.virtual('recommendedCategories').get(function() {
  return this.recommendedServices
    .sort((a, b) => b.priority - a.priority)
    .map(service => service.category);
});

// Method to get service recommendations for this event type
eventTypeSchema.methods.getServiceRecommendations = function() {
  return this.recommendedServices
    .sort((a, b) => b.priority - a.priority)
    .map(service => ({
      category: service.category,
      priority: service.priority,
      isRequired: service.isRequired,
      notes: service.notes,
    }));
};

// Static method to get active event types
eventTypeSchema.statics.getActiveEventTypes = function() {
  return this.find({ isActive: true })
    .sort({ displayOrder: 1, name: 1 });
};

// Static method to get event type by slug
eventTypeSchema.statics.getBySlug = function(slug) {
  return this.findOne({ slug, isActive: true });
};

module.exports = mongoose.model('EventType', eventTypeSchema);