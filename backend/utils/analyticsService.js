const Analytics = require('../models/Analytics');

const logAnalytics = async (type, data) => {
  try {
    const analytics = new Analytics({
      type,
      bookingId: data.bookingId,
      userId: data.userId,
      amount: data.amount,
      details: data.details,
    });
    await analytics.save();
  } catch (error) {
    console.error('Analytics logging error:', error);
  }
};

const getAnalytics = async (startDate, endDate) => {
  try {
    const analytics = await Analytics.find({
      date: { $gte: startDate, $lte: endDate },
    });

    // Calculate summary
    const summary = {
      totalBookings: analytics.filter(a => a.type === 'booking_created').length,
      totalCancellations: analytics.filter(a => a.type === 'booking_cancelled').length,
      totalRevenue: analytics
        .filter(a => a.type === 'payment_received')
        .reduce((sum, a) => sum + (a.amount || 0), 0),
      newUsers: analytics.filter(a => a.type === 'user_signup').length,
    };

    return summary;
  } catch (error) {
    console.error('Analytics retrieval error:', error);
    return null;
  }
};

module.exports = {
  logAnalytics,
  getAnalytics,
};
