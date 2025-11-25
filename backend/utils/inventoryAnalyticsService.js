const Service = require('../models/Service');
const Booking = require('../models/Booking');
const ReservationQueue = require('../models/ReservationQueue');

// Analyze inventory usage patterns
const analyzeInventoryPatterns = async (serviceId, days = 30) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  // Get all bookings for the service in the time period
  const bookings = await Booking.find({
    serviceId,
    status: 'confirmed',
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: 1 });

  if (bookings.length === 0) {
    return {
      serviceId,
      averageDailyBookings: 0,
      peakDays: [],
      seasonalTrends: [],
      forecast: {
        nextWeek: 0,
        nextMonth: 0,
        confidence: 0
      }
    };
  }

  // Calculate daily booking patterns
  const dailyBookings = {};
  bookings.forEach(booking => {
    const date = booking.createdAt.toISOString().split('T')[0];
    dailyBookings[date] = (dailyBookings[date] || 0) + booking.quantity;
  });

  // Calculate average daily bookings
  const totalBookings = bookings.reduce((sum, booking) => sum + booking.quantity, 0);
  const averageDailyBookings = totalBookings / days;

  // Find peak days (days with above-average bookings)
  const peakDays = Object.entries(dailyBookings)
    .filter(([date, count]) => count > averageDailyBookings * 1.5)
    .map(([date, count]) => ({ date, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings);

  // Analyze seasonal trends (by day of week)
  const dayOfWeekBookings = {};
  bookings.forEach(booking => {
    const dayOfWeek = booking.createdAt.getDay(); // 0 = Sunday, 6 = Saturday
    dayOfWeekBookings[dayOfWeek] = (dayOfWeekBookings[dayOfWeek] || 0) + booking.quantity;
  });

  const seasonalTrends = Object.entries(dayOfWeekBookings)
    .map(([day, bookings]) => ({
      day: parseInt(day),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)],
      averageBookings: bookings / Math.ceil(days / 7)
    }))
    .sort((a, b) => b.averageBookings - a.averageBookings);

  // Simple forecasting based on recent trends
  const recentBookings = bookings.slice(-7); // Last 7 bookings
  const recentAverage = recentBookings.length > 0
    ? recentBookings.reduce((sum, b) => sum + b.quantity, 0) / recentBookings.length
    : averageDailyBookings;

  // Calculate trend (simple linear regression on last 14 days)
  const trendData = Object.entries(dailyBookings).slice(-14);
  let trend = 0;
  if (trendData.length >= 7) {
    const x = trendData.map((_, i) => i);
    const y = trendData.map(([_, count]) => count);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    trend = slope;
  }

  // Forecast for next week and month
  const nextWeekForecast = Math.max(0, recentAverage + trend * 7);
  const nextMonthForecast = Math.max(0, averageDailyBookings * 30 + trend * 30);

  // Confidence based on data availability and consistency
  const dataPoints = Object.keys(dailyBookings).length;
  const consistency = dataPoints / days; // How many days had bookings
  const confidence = Math.min(95, Math.max(10, consistency * 100));

  return {
    serviceId,
    period: { startDate, endDate, days },
    statistics: {
      totalBookings,
      averageDailyBookings: Math.round(averageDailyBookings * 100) / 100,
      peakDays: peakDays.slice(0, 5),
      seasonalTrends,
      dataCompleteness: Math.round(consistency * 100)
    },
    forecast: {
      nextWeek: Math.round(nextWeekForecast),
      nextMonth: Math.round(nextMonthForecast),
      trend: Math.round(trend * 100) / 100,
      confidence: Math.round(confidence)
    }
  };
};

// Get inventory health report
const getInventoryHealthReport = async () => {
  const services = await Service.find({
    serviceType: { $in: ['equipment', 'supply'] },
    isAvailable: true
  });

  const report = {
    summary: {
      totalServices: services.length,
      healthyServices: 0,
      atRiskServices: 0,
      criticalServices: 0,
      outOfStockServices: 0
    },
    services: [],
    recommendations: []
  };

  for (const service of services) {
    const analysis = await analyzeInventoryPatterns(service._id, 30);
    const currentStock = service.quantity;
    const avgDailyUsage = analysis.statistics.averageDailyBookings;

    // Calculate days of supply remaining
    const daysRemaining = avgDailyUsage > 0 ? currentStock / avgDailyUsage : 999;

    let healthStatus = 'healthy';
    let riskLevel = 'low';

    if (currentStock === 0) {
      healthStatus = 'out_of_stock';
      riskLevel = 'critical';
      report.summary.outOfStockServices++;
    } else if (daysRemaining <= 3) {
      healthStatus = 'critical';
      riskLevel = 'critical';
      report.summary.criticalServices++;
    } else if (daysRemaining <= 7) {
      healthStatus = 'at_risk';
      riskLevel = 'high';
      report.summary.atRiskServices++;
    } else {
      healthStatus = 'healthy';
      riskLevel = 'low';
      report.summary.healthyServices++;
    }

    // Generate recommendations
    const recommendations = [];
    if (healthStatus === 'out_of_stock') {
      recommendations.push(`URGENT: Restock ${service.name} immediately`);
    } else if (healthStatus === 'critical') {
      recommendations.push(`Restock ${service.name} within ${Math.ceil(daysRemaining)} days`);
    } else if (healthStatus === 'at_risk') {
      recommendations.push(`Consider restocking ${service.name} soon (${Math.ceil(daysRemaining)} days remaining)`);
    }

    // Check for seasonal patterns
    if (analysis.statistics.seasonalTrends.length > 0) {
      const topDay = analysis.statistics.seasonalTrends[0];
      if (topDay.averageBookings > avgDailyUsage * 1.5) {
        recommendations.push(`Stock up for busy ${topDay.dayName}s (${Math.round(topDay.averageBookings)} avg bookings)`);
      }
    }

    report.services.push({
      serviceId: service._id,
      name: service.name,
      category: service.category,
      currentStock,
      averageDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      daysRemaining: Math.ceil(daysRemaining),
      healthStatus,
      riskLevel,
      analysis,
      recommendations
    });

    report.recommendations.push(...recommendations);
  }

  return report;
};

// Get demand forecasting for all services
const getDemandForecast = async (daysAhead = 30) => {
  const services = await Service.find({
    serviceType: { $in: ['equipment', 'supply'] },
    isAvailable: true
  });

  const forecast = {
    period: daysAhead,
    services: [],
    summary: {
      totalPredictedDemand: 0,
      highDemandServices: 0,
      stableDemandServices: 0,
      decliningDemandServices: 0
    }
  };

  for (const service of services) {
    const analysis = await analyzeInventoryPatterns(service._id, 60); // Use 60 days for better forecasting

    const predictedDemand = analysis.forecast.nextMonth;
    const currentTrend = analysis.forecast.trend;
    const confidence = analysis.forecast.confidence;

    let trendDirection = 'stable';
    if (currentTrend > 0.5) trendDirection = 'increasing';
    else if (currentTrend < -0.5) trendDirection = 'declining';

    forecast.services.push({
      serviceId: service._id,
      name: service.name,
      category: service.category,
      predictedDemand,
      trendDirection,
      trendValue: currentTrend,
      confidence,
      currentStock: service.quantity,
      recommendedStock: Math.max(service.quantity, Math.ceil(predictedDemand * 1.2)) // 20% buffer
    });

    forecast.summary.totalPredictedDemand += predictedDemand;

    if (trendDirection === 'increasing' && predictedDemand > analysis.statistics.averageDailyBookings * daysAhead * 1.5) {
      forecast.summary.highDemandServices++;
    } else if (trendDirection === 'stable') {
      forecast.summary.stableDemandServices++;
    } else {
      forecast.summary.decliningDemandServices++;
    }
  }

  // Sort by predicted demand
  forecast.services.sort((a, b) => b.predictedDemand - a.predictedDemand);

  return forecast;
};

// Get optimal reorder quantities
const getOptimalReorderQuantities = async () => {
  const forecast = await getDemandForecast(30);
  const healthReport = await getInventoryHealthReport();

  const reorderRecommendations = [];

  for (const service of forecast.services) {
    const healthData = healthReport.services.find(h => h.serviceId.toString() === service.serviceId.toString());

    if (!healthData) continue;

    const currentStock = service.currentStock;
    const predictedDemand = service.predictedDemand;
    const avgDailyUsage = healthData.averageDailyUsage;

    // Calculate optimal reorder quantity (enough for 30 days + buffer)
    const baseQuantity = Math.ceil(avgDailyUsage * 30);
    const buffer = Math.ceil(baseQuantity * 0.2); // 20% buffer
    const optimalQuantity = baseQuantity + buffer;

    // Determine reorder urgency
    let urgency = 'normal';
    let reorderPoint = Math.ceil(avgDailyUsage * 7); // Reorder when 7 days left

    if (healthData.healthStatus === 'critical') {
      urgency = 'urgent';
      reorderPoint = Math.ceil(avgDailyUsage * 3);
    } else if (healthData.healthStatus === 'at_risk') {
      urgency = 'high';
      reorderPoint = Math.ceil(avgDailyUsage * 5);
    }

    const shouldReorder = currentStock <= reorderPoint;

    reorderRecommendations.push({
      serviceId: service.serviceId,
      name: service.name,
      category: service.category,
      currentStock,
      reorderPoint,
      optimalReorderQuantity: optimalQuantity,
      predictedDemand,
      urgency,
      shouldReorder,
      estimatedCost: optimalQuantity * (service.trendValue || 0), // Would need actual cost data
      reason: shouldReorder
        ? `Current stock (${currentStock}) is below reorder point (${reorderPoint})`
        : `Stock level healthy (${currentStock} units available)`
    });
  }

  return {
    recommendations: reorderRecommendations.filter(r => r.shouldReorder),
    healthyServices: reorderRecommendations.filter(r => !r.shouldReorder),
    summary: {
      servicesNeedingReorder: reorderRecommendations.filter(r => r.shouldReorder).length,
      urgentRestocks: reorderRecommendations.filter(r => r.urgency === 'urgent').length,
      totalOptimalQuantity: reorderRecommendations.reduce((sum, r) => sum + r.optimalReorderQuantity, 0)
    }
  };
};

module.exports = {
  analyzeInventoryPatterns,
  getInventoryHealthReport,
  getDemandForecast,
  getOptimalReorderQuantities
};