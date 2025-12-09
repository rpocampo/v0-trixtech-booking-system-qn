const mongoose = require('mongoose');

const bookingAnalyticsSchema = new mongoose.Schema(
  {
    mainServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    additionalServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    // How many times this combination has been booked together
    frequency: {
      type: Number,
      default: 1,
    },
    // Confidence score (0-1) based on frequency and recency
    confidence: {
      type: Number,
      default: 0.1,
      min: 0,
      max: 1,
    },
    // Last time this combination was observed
    lastObserved: {
      type: Date,
      default: Date.now,
    },
    // Category of the main service (for faster queries)
    mainCategory: {
      type: String,
      required: true,
    },
    // Category of the additional service
    additionalCategory: {
      type: String,
      required: true,
    },
    // Average quantity of additional item when added
    averageQuantity: {
      type: Number,
      default: 1,
    },
    // Total bookings where this combination was observed
    totalBookings: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
bookingAnalyticsSchema.index({ mainServiceId: 1, additionalServiceId: 1 }, { unique: true });
bookingAnalyticsSchema.index({ mainCategory: 1, confidence: -1 });
bookingAnalyticsSchema.index({ lastObserved: -1 });

// Method to update analytics when a new booking pattern is observed
bookingAnalyticsSchema.statics.recordBookingPattern = async function(
  mainServiceId,
  additionalServiceId,
  mainCategory,
  additionalCategory,
  quantity = 1
) {
  try {
    const existing = await this.findOne({
      mainServiceId,
      additionalServiceId,
    });

    if (existing) {
      // Update existing pattern
      const newFrequency = existing.frequency + 1;
      const newTotalBookings = existing.totalBookings + 1;
      const newAverageQuantity = ((existing.averageQuantity * existing.totalBookings) + quantity) / newTotalBookings;

      // Calculate confidence based on frequency and recency
      const daysSinceLastObserved = (Date.now() - existing.lastObserved.getTime()) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.max(0.1, Math.exp(-daysSinceLastObserved / 30)); // Decay over 30 days
      const newConfidence = Math.min(1, (newFrequency / 10) * recencyFactor); // Max confidence at 10+ bookings

      await this.updateOne(
        { mainServiceId, additionalServiceId },
        {
          frequency: newFrequency,
          confidence: newConfidence,
          lastObserved: new Date(),
          averageQuantity: newAverageQuantity,
          totalBookings: newTotalBookings,
        }
      );

      return existing;
    } else {
      // Create new pattern
      const newPattern = new this({
        mainServiceId,
        additionalServiceId,
        mainCategory,
        additionalCategory,
        frequency: 1,
        confidence: 0.1,
        averageQuantity: quantity,
        totalBookings: 1,
        lastObserved: new Date(),
      });

      await newPattern.save();
      return newPattern;
    }
  } catch (error) {
    console.error('Error recording booking pattern:', error);
    return null;
  }
};

// Method to get suggestions for a main service
bookingAnalyticsSchema.statics.getSuggestionsForService = async function(mainServiceId, limit = 5) {
  try {
    const suggestions = await this.find({
      mainServiceId,
      confidence: { $gte: 0.2 }, // Only suggestions with reasonable confidence
    })
    .populate('additionalServiceId', 'name description category basePrice image isAvailable quantity')
    .sort({ confidence: -1, frequency: -1 })
    .limit(limit);

    return suggestions.map(suggestion => ({
      service: suggestion.additionalServiceId,
      confidence: suggestion.confidence,
      frequency: suggestion.frequency,
      averageQuantity: suggestion.averageQuantity,
      reason: `Added by ${suggestion.frequency} customer${suggestion.frequency > 1 ? 's' : ''} who booked similar services`,
    }));
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return [];
  }
};

// Method to get suggestions by category
bookingAnalyticsSchema.statics.getSuggestionsByCategory = async function(category, limit = 10) {
  try {
    const suggestions = await this.find({
      mainCategory: category,
      confidence: { $gte: 0.15 },
    })
    .populate('additionalServiceId', 'name description category basePrice image isAvailable quantity')
    .populate('mainServiceId', 'name category')
    .sort({ confidence: -1, frequency: -1 })
    .limit(limit);

    // Group by additional service and aggregate confidence
    const serviceMap = new Map();

    suggestions.forEach(suggestion => {
      const serviceId = suggestion.additionalServiceId._id.toString();

      if (serviceMap.has(serviceId)) {
        const existing = serviceMap.get(serviceId);
        existing.confidence = Math.max(existing.confidence, suggestion.confidence);
        existing.frequency += suggestion.frequency;
        existing.reasons.push(`Popular with ${suggestion.mainServiceId.name}`);
      } else {
        serviceMap.set(serviceId, {
          service: suggestion.additionalServiceId,
          confidence: suggestion.confidence,
          frequency: suggestion.frequency,
          averageQuantity: suggestion.averageQuantity,
          reasons: [`Popular with ${suggestion.mainServiceId.name}`],
        });
      }
    });

    return Array.from(serviceMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting category suggestions:', error);
    return [];
  }
};

module.exports = mongoose.model('BookingAnalytics', bookingAnalyticsSchema);