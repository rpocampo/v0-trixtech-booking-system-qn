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
  console.log('=== ANALYTICS INVENTORY ROUTE CALLED ===');
  console.log('Query params:', req.query);
  console.log('Full URL:', req.url);

  try {
    const { startDate, endDate } = req.query;

    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        console.log('Invalid date range: start > end');
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be after end date'
        });
      }
    }

    const services = await Service.find({ category: 'equipment' });
    console.log(`Found ${services.length} equipment services`);

    // Check total bookings in database
    const totalBookings = await Booking.countDocuments();
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed', paymentStatus: { $in: ['partial', 'paid'] } });
    console.log(`Database check: ${totalBookings} total bookings, ${confirmedBookings} confirmed/paid bookings`);

    const inventoryReport = await Promise.all(
      services.map(async (service) => {
        // Get all confirmed bookings with payment
        let allBookings = await Booking.find({
          status: 'confirmed',
          paymentStatus: { $in: ['partial', 'paid'] }
        });

        console.log(`Service ${service.name}: Found ${allBookings.length} total confirmed/paid bookings`);

        // If date range is provided, filter bookings that are active within the range
        if (startDate && endDate) {
          const rangeStart = new Date(startDate);
          rangeStart.setHours(0, 0, 0, 0);
          const rangeEnd = new Date(endDate);
          rangeEnd.setHours(23, 59, 59, 999);

          const originalCount = allBookings.length;
          allBookings = allBookings.filter(booking => {
            const bookingStart = new Date(booking.bookingDate);
            const duration = booking.duration || 1; // Default to 1 day if not set
            const bookingEnd = new Date(bookingStart);
            bookingEnd.setDate(bookingEnd.getDate() + duration - 1); // -1 because the booking includes the start date
            bookingEnd.setHours(23, 59, 59, 999);

            // Check if the booking period overlaps with the date range
            return bookingStart <= rangeEnd && bookingEnd >= rangeStart;
          });

          console.log(`Service ${service.name}: After date filtering (${startDate} to ${endDate}): ${allBookings.length} bookings (was ${originalCount})`);
        }

        // For inventory reports, we show current inventory status, not historical bookings
        // The "booked" quantity should be the current reserved amount
        const reserved = service.reserved || 0;
        const availableQuantity = service.getAvailable();
        const utilizationRate = service.quantity > 0 ? ((reserved / service.quantity) * 100).toFixed(1) : '0';

        // If date range is provided, also calculate historical bookings for that period
        let historicalBookedQuantity = 0;
        if (startDate && endDate) {
          // Get direct bookings of this equipment within the date range
          const directBookings = allBookings.filter(booking =>
            booking.serviceId.toString() === service._id.toString()
          );
          const directBookedQuantity = directBookings.reduce((sum, booking) => sum + (booking.quantity || 0), 0);

          // Get bookings from packages that include this equipment
          const packageBookings = allBookings.filter(booking => {
            const itemQuantities = booking.itemQuantities || {};
            return itemQuantities[service._id.toString()] !== undefined;
          });

          let packageBookedQuantity = 0;
          packageBookings.forEach(booking => {
            const itemQuantities = booking.itemQuantities || {};
            const equipmentId = service._id.toString();
            if (itemQuantities[equipmentId]) {
              packageBookedQuantity += itemQuantities[equipmentId] || 0;
            }
          });

          // Get bookings of event services that include this equipment
          const eventServiceBookings = allBookings.filter(booking => {
            // Check if this booking is for an event service that includes this equipment
            if (booking.serviceId && booking.serviceId.includedEquipment) {
              return booking.serviceId.includedEquipment.some(eq => eq.equipmentId.toString() === service._id.toString());
            }
            return false;
          });

          let eventServiceBookedQuantity = 0;
          eventServiceBookings.forEach(booking => {
            if (booking.serviceId && booking.serviceId.includedEquipment) {
              const equipmentItem = booking.serviceId.includedEquipment.find(eq => eq.equipmentId.toString() === service._id.toString());
              if (equipmentItem) {
                eventServiceBookedQuantity += (equipmentItem.quantity || 0) * (booking.quantity || 1);
              }
            }
          });

          historicalBookedQuantity = directBookedQuantity + packageBookedQuantity + eventServiceBookedQuantity;
          console.log(`Service ${service.name}: Historical booked quantity (${startDate} to ${endDate}): ${historicalBookedQuantity}`);
        }

        return {
          serviceId: service._id,
          name: service.name,
          totalStock: service.quantity,
          reserved, // Current reserved quantity
          bookedQuantity: reserved, // For display, show current reserved as "booked"
          availableQuantity,
          utilizationRate,
          historicalBookedQuantity: historicalBookedQuantity || 0, // Historical bookings in date range
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
