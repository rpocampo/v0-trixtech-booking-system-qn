const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  createPaymentIntent,
  processPaymentCallback,
  getPaymentStatus,
  cancelPayment,
} = require('../utils/paymentService');

const router = express.Router();

// Create payment intent for booking
router.post('/create-intent', authMiddleware, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and amount are required'
      });
    }

    const result = await createPaymentIntent(bookingId, amount, req.user.id);

    if (result.success) {
      res.json({
        success: true,
        paymentId: result.paymentId,
        transactionId: result.transactionId,
        paymentUrl: result.paymentUrl,
        status: result.status,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to create payment intent'
      });
    }
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get payment status
router.get('/status/:paymentId', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const result = await getPaymentStatus(paymentId);

    if (result.success) {
      res.json({ success: true, payment: result.payment });
    } else {
      res.status(404).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Payment callback/webhook (for production GCash integration)
router.post('/callback', async (req, res) => {
  try {
    const { transactionId, status, ...paymentData } = req.body;

    console.log('Payment callback received:', { transactionId, status, paymentData });

    const result = await processPaymentCallback(transactionId, status, paymentData);

    if (result.success) {
      res.json({ success: true, message: 'Payment processed successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Failed to process payment' });
    }
  } catch (error) {
    console.error('Error processing payment callback:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Cancel payment
router.post('/cancel/:paymentId', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    const result = await cancelPayment(paymentId, reason);

    if (result.success) {
      res.json({
        success: true,
        message: 'Payment cancelled successfully',
        payment: result.payment
      });
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Test endpoint for simulating payment completion (sandbox only)
router.post('/test-complete/:transactionId', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { success = true, referenceNumber } = req.body;

    // Only allow in development/sandbox
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Test endpoint not available in production'
      });
    }

    const status = success ? 'completed' : 'failed';
    const paymentData = success
      ? { referenceNumber: referenceNumber || `TEST_${Date.now()}` }
      : { failureReason: 'Test payment failed' };

    const result = await processPaymentCallback(transactionId, status, paymentData);

    if (result.success) {
      res.json({
        success: true,
        message: `Test payment ${status}`,
        payment: result.payment,
        booking: result.booking
      });
    } else {
      res.status(400).json({ success: false, message: 'Failed to process test payment' });
    }
  } catch (error) {
    console.error('Error processing test payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;