const express = require('express');
const { getAnalytics } = require('../utils/analyticsService');
const { authMiddleware: auth, adminMiddleware: isAdmin } = require('../middleware/auth');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

// Simple recommendation engine
const getRecommendations = async (serviceId, limit = 3) => {
  try {
    const service = await Service.findById(serviceId);
    if (!service) return [];

    // Get popular services in same category
    const categoryServices = await Service.find({
      category: service.category,
      _id: { $ne: serviceId },
      isAvailable: true
    }).limit(limit);

    // Get most booked services overall
    const popularServices = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: '$serviceId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
      { $unwind: '$service' },
      { $match: { 'service.isAvailable': true, 'service._id': { $ne: serviceId } } },
      { $project: { _id: '$service._id', name: '$service.name', description: '$service.description', price: '$service.basePrice', category: '$service.category', image: '$service.image', basePrice: '$service.basePrice' } }
    ]);

    // Combine and deduplicate
    const recommendations = [...categoryServices, ...popularServices.map(p => p._id ? p : null).filter(Boolean)];
    const unique = recommendations.filter((item, index, arr) =>
      arr.findIndex(i => i._id.toString() === item._id.toString()) === index
    );

    // Ensure price is properly set for all recommendations
    const recommendationsWithPrice = unique.slice(0, limit).map(rec => {
      const recObj = rec.toObject ? rec.toObject() : rec;
      recObj.price = rec.basePrice || rec.price || 0;
      return recObj;
    });

    return recommendationsWithPrice;
  } catch (error) {
    console.error('Recommendation error:', error);
    return [];
  }
};

const router = express.Router();

// Get analytics (admin only)
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const analytics = await getAnalytics(start, end);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get inventory reports (admin only)
router.get('/inventory', auth, isAdmin, async (req, res) => {
  try {
    const services = await Service.find({ category: 'equipment' });

    const inventoryReport = await Promise.all(
      services.map(async (service) => {
        const totalBooked = await Booking.aggregate([
          { $match: { serviceId: service._id, status: { $in: ['pending', 'confirmed'] } } },
          { $group: { _id: null, totalQuantity: { $sum: '$quantity' } } }
        ]);

        const bookedQuantity = totalBooked[0]?.totalQuantity || 0;
        const availableQuantity = Math.max(0, service.quantity - bookedQuantity);

        return {
          serviceId: service._id,
          name: service.name,
          totalStock: service.quantity,
          bookedQuantity,
          availableQuantity,
          utilizationRate: service.quantity > 0 ? ((bookedQuantity / service.quantity) * 100).toFixed(1) : 0,
        };
      })
    );

    res.json({ success: true, data: inventoryReport });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get service recommendations
router.get('/recommendations/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { limit } = req.query;

    const recommendations = await getRecommendations(serviceId, parseInt(limit) || 3);
    res.json({ success: true, recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
