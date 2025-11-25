const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // Service category preferences
    categoryPreferences: [{
      category: {
        type: String,
        required: true,
        enum: ['equipment', 'party', 'corporate', 'wedding', 'birthday', 'funeral', 'service']
      },
      score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      interactionCount: {
        type: Number,
        default: 0
      },
      lastInteraction: {
        type: Date,
        default: Date.now
      }
    }],
    // Event type preferences
    eventTypePreferences: [{
      eventType: {
        type: String,
        required: true,
        enum: ['wedding', 'corporate', 'birthday', 'graduation', 'party', 'conference', 'other']
      },
      score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      bookingCount: {
        type: Number,
        default: 0
      },
      lastBooking: {
        type: Date
      }
    }],
    // Price range preferences
    pricePreferences: {
      preferredMinPrice: {
        type: Number,
        default: 0,
        min: 0
      },
      preferredMaxPrice: {
        type: Number,
        default: 10000,
        min: 0
      },
      averageSpent: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    // Booking patterns
    bookingPatterns: {
      preferredDays: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      preferredTimes: [{
        type: String,
        enum: ['morning', 'afternoon', 'evening']
      }],
      averageGroupSize: {
        type: Number,
        default: 1,
        min: 1
      },
      deliveryPreference: {
        type: Boolean,
        default: false
      }
    },
    // Recently viewed services
    recentlyViewed: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      },
      viewedAt: {
        type: Date,
        default: Date.now
      },
      category: String,
      price: Number
    }],
    // Favorite services
    favorites: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      category: String
    }],
    // Recommendation settings
    recommendationSettings: {
      enablePersonalized: {
        type: Boolean,
        default: true
      },
      enableCollaborative: {
        type: Boolean,
        default: true
      },
      maxRecommendations: {
        type: Number,
        default: 6,
        min: 1,
        max: 20
      }
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
userPreferencesSchema.index({ userId: 1 });
userPreferencesSchema.index({ 'categoryPreferences.category': 1 });
userPreferencesSchema.index({ 'eventTypePreferences.eventType': 1 });
userPreferencesSchema.index({ 'recentlyViewed.viewedAt': -1 });

// Instance methods
userPreferencesSchema.methods.updateCategoryPreference = function(category, interactionType = 'view') {
  let pref = this.categoryPreferences.find(p => p.category === category);

  if (!pref) {
    pref = {
      category,
      score: 0,
      interactionCount: 0,
      lastInteraction: new Date()
    };
    this.categoryPreferences.push(pref);
  }

  // Update based on interaction type
  const scoreIncrease = interactionType === 'booking' ? 20 :
                       interactionType === 'favorite' ? 15 :
                       interactionType === 'view' ? 5 : 1;

  pref.score = Math.min(100, pref.score + scoreIncrease);
  pref.interactionCount += 1;
  pref.lastInteraction = new Date();

  return this.save();
};

userPreferencesSchema.methods.updateEventTypePreference = function(eventType) {
  let pref = this.eventTypePreferences.find(p => p.eventType === eventType);

  if (!pref) {
    pref = {
      eventType,
      score: 0,
      bookingCount: 0,
      lastBooking: new Date()
    };
    this.eventTypePreferences.push(pref);
  }

  pref.score = Math.min(100, pref.score + 25);
  pref.bookingCount += 1;
  pref.lastBooking = new Date();

  return this.save();
};

userPreferencesSchema.methods.addRecentlyViewed = function(serviceId, category, price) {
  // Remove if already exists
  this.recentlyViewed = this.recentlyViewed.filter(item =>
    !item.serviceId.equals(serviceId)
  );

  // Add to beginning
  this.recentlyViewed.unshift({
    serviceId,
    category,
    price,
    viewedAt: new Date()
  });

  // Keep only last 20
  if (this.recentlyViewed.length > 20) {
    this.recentlyViewed = this.recentlyViewed.slice(0, 20);
  }

  return this.save();
};

userPreferencesSchema.methods.addToFavorites = function(serviceId, category) {
  // Check if already in favorites
  const existing = this.favorites.find(fav => fav.serviceId.equals(serviceId));
  if (existing) {
    return this; // Already in favorites
  }

  this.favorites.push({
    serviceId,
    category,
    addedAt: new Date()
  });

  // Update category preference
  this.updateCategoryPreference(category, 'favorite');

  return this.save();
};

userPreferencesSchema.methods.removeFromFavorites = function(serviceId) {
  this.favorites = this.favorites.filter(fav => !fav.serviceId.equals(serviceId));
  return this.save();
};

userPreferencesSchema.methods.updatePricePreferences = function(price) {
  // Update average spent using rolling average
  const totalBookings = this.eventTypePreferences.reduce((sum, pref) => sum + pref.bookingCount, 0);
  if (totalBookings > 0) {
    this.pricePreferences.averageSpent =
      (this.pricePreferences.averageSpent * (totalBookings - 1) + price) / totalBookings;
  } else {
    this.pricePreferences.averageSpent = price;
  }

  // Adjust preferred price range based on spending pattern
  const avg = this.pricePreferences.averageSpent;
  this.pricePreferences.preferredMinPrice = Math.max(0, avg * 0.5);
  this.pricePreferences.preferredMaxPrice = avg * 1.5;

  return this.save();
};

userPreferencesSchema.methods.getPersonalizedRecommendations = async function(limit = 6) {
  const Service = mongoose.model('Service');
  const Package = mongoose.model('Package');

  // Get user's top categories
  const topCategories = this.categoryPreferences
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(p => p.category);

  // Get user's price range
  const { preferredMinPrice, preferredMaxPrice } = this.pricePreferences;

  // Get recently viewed service IDs to exclude
  const recentlyViewedIds = this.recentlyViewed.slice(0, 10).map(item => item.serviceId);

  // Get favorite service IDs
  const favoriteIds = this.favorites.map(fav => fav.serviceId);

  // Build recommendation query
  let recommendations = [];

  // 1. Services from preferred categories
  if (topCategories.length > 0) {
    const categoryServices = await Service.find({
      category: { $in: topCategories },
      isAvailable: true,
      _id: { $nin: recentlyViewedIds },
      basePrice: { $gte: preferredMinPrice, $lte: preferredMaxPrice }
    }).limit(limit * 2);

    recommendations.push(...categoryServices.map(service => ({
      item: service,
      type: 'service',
      score: 80 + Math.random() * 20, // Base score for category match
      reason: `Based on your interest in ${service.category} services`
    })));
  }

  // 2. Services similar to favorites
  if (favoriteIds.length > 0) {
    const favoriteServices = await Service.find({ _id: { $in: favoriteIds } });
    const favoriteCategories = [...new Set(favoriteServices.map(s => s.category))];

    const similarServices = await Service.find({
      category: { $in: favoriteCategories },
      isAvailable: true,
      _id: { $nin: [...recentlyViewedIds, ...favoriteIds] },
      basePrice: { $gte: preferredMinPrice, $lte: preferredMaxPrice }
    }).limit(limit);

    recommendations.push(...similarServices.map(service => ({
      item: service,
      type: 'service',
      score: 70 + Math.random() * 20,
      reason: 'Similar to services you\'ve favorited'
    })));
  }

  // 3. Popular packages in preferred categories
  if (topCategories.length > 0) {
    const packages = await Package.find({
      category: { $in: topCategories.map(cat => `${cat}-package`) },
      isActive: true,
      totalPrice: { $gte: preferredMinPrice, $lte: preferredMaxPrice }
    }).limit(limit);

    recommendations.push(...packages.map(pkg => ({
      item: pkg,
      type: 'package',
      score: 75 + Math.random() * 20,
      reason: `Popular ${pkg.category} package`
    })));
  }

  // Remove duplicates and sort by score
  const seen = new Set();
  recommendations = recommendations
    .filter(rec => {
      const id = rec.item._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Get collaborative recommendations from similar users
  const collaborativeRecommendations = await this.getCollaborativeRecommendations(limit);

  // Combine and deduplicate recommendations
  const allRecommendations = [...recommendations, ...collaborativeRecommendations];

  // Remove duplicates and limit
  const seenIds = new Set();
  const uniqueRecommendations = allRecommendations
    .filter(rec => {
      const id = rec.item._id.toString();
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return uniqueRecommendations;
};

// Get collaborative recommendations from similar users
userPreferencesSchema.methods.getCollaborativeRecommendations = async function(limit = 6) {
  const UserPreferences = mongoose.model('UserPreferences');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');

  // Find similar users
  const similarUsers = await UserPreferences.findSimilarUsers(this.userId, 5);

  if (similarUsers.length === 0) return [];

  const similarUserIds = similarUsers.map(u => u.userId);

  // Get services booked by similar users that this user hasn't booked
  const userBookings = await Booking.find({
    customerId: this.userId,
    status: 'confirmed'
  }).distinct('serviceId');

  const similarUsersBookings = await Booking.find({
    customerId: { $in: similarUserIds },
    status: 'confirmed',
    serviceId: { $nin: userBookings }
  })
  .populate('serviceId')
  .sort({ createdAt: -1 })
  .limit(20);

  // Group by service and calculate recommendation score
  const serviceScores = new Map();

  similarUsersBookings.forEach(booking => {
    const service = booking.serviceId;
    if (!service) return;

    const serviceId = service._id.toString();
    const similarUser = similarUsers.find(u => u.userId.toString() === booking.customerId.toString());

    if (similarUser) {
      const currentScore = serviceScores.get(serviceId) || {
        service,
        score: 0,
        bookingCount: 0,
        similarityBonus: similarUser.similarityScore
      };

      currentScore.score += similarUser.similarityScore;
      currentScore.bookingCount += 1;
      serviceScores.set(serviceId, currentScore);
    }
  });

  // Convert to recommendations array
  const collaborativeRecs = Array.from(serviceScores.values())
    .filter(item => item.service.isAvailable)
    .map(item => ({
      item: item.service,
      type: 'service',
      score: Math.min(95, item.score + item.similarityBonus * 0.1),
      reason: `Popular among customers with similar preferences (${item.bookingCount} bookings)`
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.floor(limit / 2)); // Use half the limit for collaborative

  return collaborativeRecs;
};

// Static methods
userPreferencesSchema.statics.getOrCreatePreferences = async function(userId) {
  let preferences = await this.findOne({ userId });

  if (!preferences) {
    preferences = new this({ userId });
    await preferences.save();
  }

  return preferences;
};

// Collaborative filtering method - find similar users
userPreferencesSchema.statics.findSimilarUsers = async function(userId, limit = 10) {
  const userPrefs = await this.findOne({ userId });
  if (!userPrefs) return [];

  // Get user's top categories and event types
  const userTopCategories = userPrefs.categoryPreferences
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(p => p.category);

  const userTopEventTypes = userPrefs.eventTypePreferences
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(p => p.eventType);

  // Find users with similar preferences
  const similarUsers = await this.find({
    userId: { $ne: userId },
    $or: [
      { 'categoryPreferences.category': { $in: userTopCategories } },
      { 'eventTypePreferences.eventType': { $in: userTopEventTypes } }
    ]
  }).limit(limit * 2);

  // Calculate similarity scores
  const scoredUsers = similarUsers.map(otherUser => {
    let similarityScore = 0;

    // Category similarity
    const commonCategories = userTopCategories.filter(cat =>
      otherUser.categoryPreferences.some(p => p.category === cat)
    );
    similarityScore += commonCategories.length * 20;

    // Event type similarity
    const commonEventTypes = userTopEventTypes.filter(eventType =>
      otherUser.eventTypePreferences.some(p => p.eventType === eventType)
    );
    similarityScore += commonEventTypes.length * 30;

    // Price range similarity
    const userPrice = userPrefs.pricePreferences.averageSpent;
    const otherPrice = otherUser.pricePreferences.averageSpent;
    if (userPrice > 0 && otherPrice > 0) {
      const priceDiff = Math.abs(userPrice - otherPrice) / Math.max(userPrice, otherPrice);
      similarityScore += (1 - priceDiff) * 25;
    }

    return {
      userId: otherUser.userId,
      similarityScore,
      commonCategories: commonCategories.length,
      commonEventTypes: commonEventTypes.length
    };
  });

  return scoredUsers
    .filter(u => u.similarityScore > 20) // Minimum similarity threshold
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
};

userPreferencesSchema.statics.trackServiceView = async function(userId, serviceId, category, price) {
  const preferences = await this.getOrCreatePreferences(userId);
  await preferences.updateCategoryPreference(category, 'view');
  await preferences.addRecentlyViewed(serviceId, category, price);
  return preferences;
};

userPreferencesSchema.statics.trackServiceBooking = async function(userId, serviceId, category, price, eventType) {
  const preferences = await this.getOrCreatePreferences(userId);
  await preferences.updateCategoryPreference(category, 'booking');
  if (eventType) {
    await preferences.updateEventTypePreference(eventType);
  }
  await preferences.updatePricePreferences(price);
  return preferences;
};

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);