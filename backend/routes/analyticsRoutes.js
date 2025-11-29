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

// Get equipment recommendations based on services in cart
const getEquipmentRecommendations = async (serviceIds, limit = 12) => {
  try {
    if (!serviceIds || serviceIds.length === 0) return [];

    // Validate service IDs are valid ObjectIds
    const validServiceIds = serviceIds.filter(id => {
      return /^[0-9a-fA-F]{24}$/.test(id); // Check if it's a valid MongoDB ObjectId
    });

    if (validServiceIds.length === 0) return [];

    // Get the services in cart
    const cartServices = await Service.find({
      _id: { $in: validServiceIds },
      isAvailable: true
    });

    if (cartServices.length === 0) return [];

    // Get categories of services in cart
    const cartCategories = [...new Set(cartServices.map(s => s.category))];

    // Find equipment that complements these services
    // Equipment that is often booked with these service categories
    const equipmentRecommendations = await Booking.aggregate([
      // Match bookings that include services from cart categories
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      // Lookup service details
      { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
      { $unwind: '$service' },
      // Filter for equipment services that are in cart categories or related
      { $match: {
        'service.category': 'equipment',
        'service.isAvailable': true,
        'service.serviceType': 'equipment'
      } },
      // Group by equipment service and count frequency
      { $group: { _id: '$serviceId', count: { $sum: 1 }, service: { $first: '$service' } } },
      { $sort: { count: -1 } },
      { $limit: limit * 3 }, // Get more to filter
      { $project: {
        _id: '$service._id',
        name: '$service.name',
        description: '$service.description',
        price: '$service.basePrice',
        category: '$service.category',
        serviceType: '$service.serviceType',
        image: '$service.image',
        quantity: '$service.quantity',
        basePrice: '$service.basePrice',
        count: 1
      }}
    ]);

    // If we don't have enough recommendations from booking history,
    // get equipment that would logically complement the services
    let additionalRecommendations = [];
    if (equipmentRecommendations.length < limit) {
      // Get equipment based on service type and common combinations
      const serviceTypes = [...new Set(cartServices.map(s => s.serviceType))];

      // Define equipment recommendations based on service categories
      const categoryBasedRecommendations = {
        'birthday': ['chairs', 'tables', 'tablecloths', 'tents'],
        'wedding': ['chairs', 'tables', 'tablecloths', 'tents'],
        'corporate': ['chairs', 'tables', 'tablecloths', 'tents'],
        'funeral': ['chairs', 'tents']
      };

      const recommendedEquipmentTypes = [];
      cartCategories.forEach(category => {
        if (categoryBasedRecommendations[category]) {
          recommendedEquipmentTypes.push(...categoryBasedRecommendations[category]);
        }
      });

      if (recommendedEquipmentTypes.length > 0) {
        // Get equipment that matches the recommended types
        additionalRecommendations = await Service.find({
          category: 'equipment',
          serviceType: 'equipment',
          isAvailable: true,
          name: { $regex: new RegExp(recommendedEquipmentTypes.join('|'), 'i') },
          _id: { $nin: [...equipmentRecommendations.map(e => e._id), ...validServiceIds] }
        }).limit(limit * 2);
      }
    }

    // Get some general popular equipment if still not enough
    let popularEquipment = [];
    const currentCount = equipmentRecommendations.length + additionalRecommendations.length;
    if (currentCount < limit) {
      popularEquipment = await Service.find({
        category: 'equipment',
        serviceType: 'equipment',
        isAvailable: true,
        _id: {
          $nin: [
            ...equipmentRecommendations.map(e => e._id),
            ...additionalRecommendations.map(e => e._id),
            ...validServiceIds
          ]
        }
      })
      .sort({ quantity: -1 }) // Sort by availability (higher stock first)
      .limit(limit - currentCount + 2);
    }

    // Combine and deduplicate
    const allEquipment = [...equipmentRecommendations, ...additionalRecommendations, ...popularEquipment];
    const uniqueEquipment = allEquipment.filter((item, index, arr) =>
      arr.findIndex(i => i._id.toString() === item._id.toString()) === index
    );

    // Ensure price is properly set and filter out items already in cart
    const recommendationsWithPrice = uniqueEquipment
      .filter(eq => !validServiceIds.includes(eq._id.toString()))
      .slice(0, limit)
      .map(rec => {
        const recObj = rec.toObject ? rec.toObject() : rec;
        recObj.price = rec.basePrice || rec.price || 0;
        return recObj;
      });

    return recommendationsWithPrice;
  } catch (error) {
    console.error('Equipment recommendation error:', error);
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
          { $match: { serviceId: service._id, status: 'confirmed', paymentStatus: { $in: ['partial', 'paid'] } } },
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

// Get equipment recommendations based on services in cart
router.get('/equipment-recommendations', async (req, res) => {
  try {
    const { serviceIds } = req.query;

    if (!serviceIds) {
      return res.json({ success: true, recommendations: [] });
    }

    const serviceIdArray = Array.isArray(serviceIds) ? serviceIds : serviceIds.split(',');

    // Get equipment that complements the services in cart
    const equipmentRecommendations = await getEquipmentRecommendations(serviceIdArray);

    res.json({ success: true, recommendations: equipmentRecommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
