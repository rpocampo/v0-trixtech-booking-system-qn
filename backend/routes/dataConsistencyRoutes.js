const express = require('express');
const { adminMiddleware } = require('../middleware/auth');
const { dataConsistencyService } = require('../utils/dataConsistencyService');

const router = express.Router();

// Run data consistency checks (admin only)
router.post('/check', adminMiddleware, async (req, res, next) => {
  try {
    const { autoFix = false } = req.body;

    const result = await dataConsistencyService.runConsistencyChecks();

    res.json({
      success: true,
      message: `Data consistency check completed. Found ${result.issues.length} issues.`,
      result
    });
  } catch (error) {
    next(error);
  }
});

// Get data consistency report (admin only)
router.get('/report', adminMiddleware, async (req, res, next) => {
  try {
    const report = dataConsistencyService.getConsistencyReport();

    res.json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
});

// Get data consistency statistics (admin only)
router.get('/stats', adminMiddleware, async (req, res, next) => {
  try {
    const report = dataConsistencyService.getConsistencyReport();

    // Calculate additional statistics
    const stats = {
      lastCheck: report.timestamp,
      totalIssues: report.summary.totalIssues,
      totalFixes: report.summary.totalFixes,
      issuesBySeverity: report.summary.issuesBySeverity,
      issuesByType: report.summary.issuesByType,
      criticalIssues: report.issues.filter(i => i.severity === 'critical'),
      recentIssues: report.issues.slice(0, 10) // Last 10 issues
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
  }
});

// Fix specific data consistency issue (admin only)
router.post('/fix/:issueType', adminMiddleware, async (req, res, next) => {
  try {
    const { issueType } = req.params;
    const { issueId } = req.body;

    // This would implement specific fixes for different issue types
    // For now, we'll run a full consistency check which includes fixes
    const result = await dataConsistencyService.runConsistencyChecks();

    res.json({
      success: true,
      message: `Attempted to fix ${issueType} issues`,
      fixesApplied: result.fixes.length,
      result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;