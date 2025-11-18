const express = require('express');
const { getAnalytics } = require('../utils/analyticsService');
const { authMiddleware: auth, adminMiddleware: isAdmin } = require('../middleware/auth');

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

module.exports = router;
