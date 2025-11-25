const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  createQRPayment,
  verifyQRPayment,
  getPaymentStatus,
  cancelPayment,
} = require('../utils/paymentService');
const logger = require('../utils/logger');
const { auditService } = require('../utils/auditService');

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

// GCash webhook endpoint for automatic payment notifications
router.post('/webhook/gcash', async (req, res) => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-gcash-signature'] || req.headers['x-signature'];

    logger.info('GCash webhook received', {
      body: webhookData,
      signature: signature ? 'present' : 'missing',
      headers: req.headers
    });

    // Verify webhook signature (in production, implement proper signature verification)
    // For now, we'll accept webhooks without signature verification for testing

    if (!webhookData || !webhookData.referenceNumber) {
      logger.warn('Invalid webhook data - missing reference number');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook data'
      });
    }

    // Process the payment notification
    const result = await verifyQRPayment(webhookData.referenceNumber, {
      webhook: true,
      gcashData: webhookData,
      amount: webhookData.amount,
      status: webhookData.status,
      transactionId: webhookData.transactionId,
      timestamp: webhookData.timestamp || new Date()
    });

    if (result.success) {
      logger.info('Payment automatically processed via webhook', {
        referenceNumber: webhookData.referenceNumber,
        amount: webhookData.amount,
        status: 'completed'
      });

      // Log audit event for payment completion
      await auditService.logAuditEvent(
        'system_action',
        result.payment.userId,
        'payment_completed_webhook',
        {
          paymentId: result.payment._id,
          bookingId: result.booking?._id,
          referenceNumber: webhookData.referenceNumber,
          amount: result.payment.amount,
          paymentMethod: 'gcash_qr',
          processedBy: 'webhook'
        },
        {
          webhookData,
          transactionId: webhookData.transactionId,
          timestamp: webhookData.timestamp
        }
      );

      // Emit real-time update to connected clients
      const io = global.io;
      if (io) {
        io.to(`user_${result.payment.userId}`).emit('payment-completed', {
          paymentId: result.payment._id,
          referenceNumber: webhookData.referenceNumber,
          amount: result.payment.amount,
          bookingId: result.booking?._id
        });

        // Notify admin
        io.to('admin').emit('payment-received', {
          paymentId: result.payment._id,
          referenceNumber: webhookData.referenceNumber,
          amount: result.payment.amount,
          userId: result.payment.userId
        });
      }

      res.json({
        success: true,
        message: 'Payment processed successfully',
        referenceNumber: webhookData.referenceNumber
      });
    } else {
      logger.error('Webhook payment processing failed', {
        referenceNumber: webhookData.referenceNumber,
        error: result.error
      });
      res.status(400).json({
        success: false,
        message: result.error || 'Payment processing failed'
      });
    }
  } catch (error) {
    logger.error('Webhook processing error', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enhanced payment status checking with automatic processing
router.get('/status-enhanced/:referenceNumber', authMiddleware, async (req, res) => {
  try {
    const { referenceNumber } = req.params;

    // Try to find payment by reference number
    const Payment = require('../models/Payment');
    let payment = await Payment.findOne({ referenceNumber })
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment is still pending and within timeout window (15 minutes)
    const paymentAge = Date.now() - payment.createdAt.getTime();
    const timeoutMs = 15 * 60 * 1000; // 15 minutes

    if (payment.status === 'pending' && paymentAge > timeoutMs) {
      // Auto-cancel expired payments
      payment.status = 'failed';
      payment.failureReason = 'Payment timeout - no payment received within 15 minutes';
      await payment.save();

      logger.info('Payment auto-cancelled due to timeout', {
        referenceNumber,
        paymentId: payment._id
      });

      return res.json({
        success: true,
        payment: {
          id: payment._id,
          referenceNumber: payment.referenceNumber,
          status: 'failed',
          amount: payment.amount,
          timeout: true,
          message: 'Payment timed out. Please try again.'
        }
      });
    }

    // NOTE: In production, payments are only confirmed when GCash sends webhooks
    // after successful QR code scanning and payment processing.
    // No automatic processing should occur without actual payment confirmation.

    res.json({
      success: true,
      payment: {
        id: payment._id,
        referenceNumber: payment.referenceNumber,
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
        timeoutRemaining: payment.status === 'pending' ?
          Math.max(0, timeoutMs - paymentAge) : 0
      }
    });
  } catch (error) {
    logger.error('Error in enhanced payment status check', error);
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