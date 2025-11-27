const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  createQRPayment,
  verifyQRPayment,
  getPaymentStatus,
  cancelPayment,
} = require('../utils/paymentService');

const router = express.Router();

// Create QR code payment for booking
router.post('/create-qr', authMiddleware, async (req, res) => {
  try {
    const { bookingId, amount, paymentType } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and amount are required'
      });
    }

    const result = await createQRPayment(bookingId, amount, req.user.id, paymentType || 'full');

    if (result.success) {
      res.json({
        success: true,
        paymentId: result.paymentId,
        transactionId: result.transactionId,
        referenceNumber: result.referenceNumber,
        qrCode: result.qrCode,
        instructions: result.instructions,
        status: result.status,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to create QR payment'
      });
    }
  } catch (error) {
    console.error('Error creating QR payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify QR code payment (called by GCash or manual verification)
router.post('/verify-qr/:referenceNumber', async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const paymentData = req.body;

    const result = await verifyQRPayment(referenceNumber, paymentData);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        payment: {
          id: result.payment._id,
          transactionId: result.payment.transactionId,
          amount: result.payment.amount,
          status: result.payment.status,
        },
        booking: result.booking ? {
          id: result.booking._id,
          status: result.booking.status,
        } : null
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error verifying QR payment:', error);
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

// Test endpoint for QR generation (no auth required)
router.post('/test-qr', async (req, res) => {
  try {
    const { amount, referenceNumber } = req.body;

    if (!amount || !referenceNumber) {
      return res.status(400).json({
        success: false,
        message: 'Amount and reference number are required'
      });
    }

    const { generateQRCodeDataURL } = require('../utils/qrCodeService');

    const paymentData = {
      amount,
      referenceNumber,
      merchantName: 'TRIXTECH',
      merchantId: 'TEST001'
    };

    const qrCode = await generateQRCodeDataURL(paymentData);

    res.json({
      success: true,
      qrCode,
      amount,
      referenceNumber
    });
  } catch (error) {
    console.error('Error in test QR generation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

module.exports = router;