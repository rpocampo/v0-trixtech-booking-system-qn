const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  createQRPayment,
  verifyQRPayment,
  getPaymentStatus,
  cancelPayment,
} = require('../utils/paymentService');
const { verifyReceipt, cleanupFile, validateImageFile } = require('../utils/receiptVerificationService');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = path.join(__dirname, '../uploads/receipts');
      // Create directory if it doesn't exist
      require('fs').mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, 'receipt-' + uniqueSuffix + ext);
    } catch (error) {
      cb(error, null);
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedMimes.join(', ')} are allowed.`), false);
    }
  }
});

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

// Verify receipt via OCR
router.post('/verify-receipt/:referenceNumber', authMiddleware, (req, res, next) => {
  // Handle multer errors
  upload.single('receipt')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + err.message
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid file upload'
      });
    }
    // Everything went fine, proceed to the next middleware
    next();
  });
}, async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const { expectedAmount } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Receipt image is required'
      });
    }

    if (!expectedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Expected amount is required'
      });
    }

    // Find the payment by reference number
    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({ referenceNumber })
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!payment) {
      cleanupFile(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify the payment belongs to the authenticated user
    if (payment.userId._id.toString() !== req.user.id) {
      cleanupFile(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if payment is already completed
    if (payment.status === 'completed') {
      cleanupFile(req.file.path);
      return res.json({
        success: true,
        message: 'Payment already verified',
        payment: {
          id: payment._id,
          status: payment.status,
          amount: payment.amount
        }
      });
    }

    // Check if payment is already being reviewed
    if (payment.status === 'pending_review') {
      cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Payment is already under review. Please wait for admin approval.',
        flaggedForReview: true
      });
    }

    // Log receipt verification attempt
    console.log(`Receipt verification attempt for payment ${payment._id}, reference: ${referenceNumber}, user: ${req.user.id}`);

    // Perform OCR verification
    const verificationResult = await verifyReceipt(
      req.file.path,
      parseFloat(expectedAmount),
      referenceNumber
    );

    console.log(`OCR verification result for payment ${payment._id}: ${verificationResult.success ? 'Success' : 'Failed'}`);

    if (!verificationResult.success) {
      // Clean up the uploaded file for failed OCR
      cleanupFile(req.file.path);
      // Flag for manual review - keep the image for admin review
      const imageUrl = `/uploads/receipts/${path.basename(req.file.path)}`;

      payment.status = 'pending_review';
      payment.paymentData.receiptVerification = {
        attemptedAt: new Date(),
        error: verificationResult.error,
        flaggedForReview: true,
        uploadedImage: imageUrl, // Store image path for admin review
        extractedData: verificationResult.extractedData
      };
      await payment.save();

      // Don't clean up the file - keep it for admin review
      console.log(`Receipt image saved for manual review: ${imageUrl}`);

      return res.status(400).json({
        success: false,
        message: 'Receipt verification failed. Your payment has been flagged for manual review.',
        error: verificationResult.error,
        flaggedForReview: true
      });
    }

    const { validation } = verificationResult;

    // Strict OCR validation - only accept perfectly valid receipts
    if (validation.isValid && validation.amountMatch) {
      // Store the uploaded image path for admin viewing even after successful verification
      const imageUrl = `/uploads/receipts/${path.basename(req.file.path)}`;

      // First update payment with receipt verification data including image path
      const Payment = require('../models/Payment');
      let payment = await Payment.findOne({ referenceNumber });
      if (payment) {
        payment.paymentData.receiptVerification = {
          attemptedAt: new Date(),
          validation,
          extractedData: verificationResult.extractedData,
          uploadedImage: imageUrl, // Store image path for admin viewing
          autoVerified: true,
          verificationNotes: validation.issues.length > 0 ? validation.issues.join('; ') : 'All validations passed'
        };
        await payment.save();

        console.log(`Payment updated with receipt verification data and uploadedImage: ${imageUrl}`);
      }

      // Receipt passed all validations - complete payment
      const verifyResult = await verifyQRPayment(referenceNumber, {
        receiptVerified: true,
        autoConfirmed: true,
        extractedAmount: validation.extractedAmount,
        extractedReference: validation.extractedReference,
        validationNotes: validation.issues.length > 0 ? validation.issues.join('; ') : 'All validations passed',
        // Preserve the uploaded image that was just set
        receiptVerification: {
          ...payment.paymentData.receiptVerification,
          uploadedImage: imageUrl
        }
      });

      if (verifyResult.success) {
        // Debug: Verify the payment still has the uploadedImage after verifyQRPayment
        const finalPayment = await Payment.findOne({ referenceNumber });
        console.log(`Final payment uploadedImage after verifyQRPayment: ${finalPayment?.paymentData?.receiptVerification?.uploadedImage}`);

        // Don't clean up the file - keep it for admin viewing
        console.log(`Receipt image saved for successful verification: ${imageUrl}`);

        return res.json({
          success: true,
          message: 'Payment verified successfully! Transaction completed.',
          payment: verifyResult.payment,
          booking: verifyResult.booking,
          verification: {
            autoConfirmed: true,
            amountVerified: validation.amountMatch,
            referenceVerified: validation.referenceMatch,
            extractedAmount: validation.extractedAmount,
            extractedReference: validation.extractedReference,
            confidence: verificationResult.extractedData.confidence,
            validationNotes: validation.issues
          }
        });
      } else {
        // Payment completion failed despite valid receipt
        console.error('Payment completion failed for valid receipt');
        return res.status(500).json({
          success: false,
          message: 'Receipt is valid but payment processing failed. Please contact support.',
          validation,
          flaggedForReview: false
        });
      }
    } else {
      // Receipt validation failed - flag for manual review instead of rejecting
      console.log('Receipt validation failed, flagging for manual review:', validation.issues);

      const imageUrl = `/uploads/receipts/${path.basename(req.file.path)}`;

      // Flag for manual review
      payment.status = 'pending_review';
      payment.paymentData.receiptVerification = {
        attemptedAt: new Date(),
        validation,
        extractedData: verificationResult.extractedData,
        flaggedForReview: true,
        uploadedImage: imageUrl, // Store image path for admin review
        issues: validation.issues
      };
      await payment.save();

      // Don't clean up the file - keep it for admin review
      console.log(`Receipt image saved for manual review due to validation failure: ${imageUrl}`);

      return res.status(400).json({
        success: false,
        message: 'Receipt validation failed. Your payment has been flagged for manual review by our team.',
        validation,
        issues: validation.issues,
        extractedData: {
          amount: validation.extractedAmount,
          reference: validation.extractedReference,
          confidence: verificationResult.extractedData.confidence
        },
        flaggedForReview: true
      });
    }

  } catch (error) {
    console.error('Error verifying receipt:', error);

    // Clean up file if it exists
    if (req.file && req.file.path) {
      cleanupFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during receipt verification'
    });
  }
});

// Get all payments for admin review (admin only)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const Payment = require('../models/Payment');
    const allPayments = await Payment.find({})
    .populate('bookingId')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

    // Debug: Log payment data to see what's being returned
    console.log('Payments being returned to admin:');
    allPayments.forEach(payment => {
      console.log(`Payment ${payment._id} (${payment.referenceNumber}): hasReceiptVerification=${!!payment.paymentData?.receiptVerification}, uploadedImage=${payment.paymentData?.receiptVerification?.uploadedImage}`);
    });

    res.json({
      success: true,
      payments: allPayments
    });
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get payments flagged for manual review (admin only)
router.get('/flagged', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const Payment = require('../models/Payment');
    const flaggedPayments = await Payment.find({
      status: 'pending_review',
      'paymentData.receiptVerification.flaggedForReview': true
    })
    .populate('bookingId')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments: flaggedPayments
    });
  } catch (error) {
    console.error('Error fetching flagged payments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Approve or reject flagged payment (admin only)
router.post('/:paymentId/review', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { paymentId } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject".'
      });
    }

    const Payment = require('../models/Payment');
    const payment = await Payment.findById(paymentId)
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'pending_review') {
      return res.status(400).json({
        success: false,
        message: 'Payment is not flagged for review'
      });
    }

    if (action === 'approve') {
      // Approve the payment - complete it
      const verifyResult = await require('../utils/paymentService').verifyQRPayment(payment.referenceNumber, {
        manualApproval: true,
        adminNotes: notes,
        // Preserve the uploaded image if it exists
        receiptVerification: payment.paymentData.receiptVerification
      });

      if (verifyResult.success) {
        // Update payment with admin review info
        payment.paymentData.receiptVerification.manualReview = {
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          action: 'approved',
          notes: notes
        };
        await payment.save();

        res.json({
          success: true,
          message: 'Payment approved and completed',
          payment: verifyResult.payment,
          booking: verifyResult.booking
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to complete approved payment'
        });
      }
    } else {
      // Reject the payment
      payment.status = 'rejected';
      payment.failureReason = 'Rejected by admin during manual review';
      payment.paymentData.receiptVerification.manualReview = {
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        action: 'rejected',
        notes: notes
      };
      await payment.save();

      // Send notification to user
      try {
        await require('../utils/notificationService').sendTemplateNotification(
          payment.userId._id,
          'PAYMENT_FAILED',
          {
            message: `Your payment has been reviewed and unfortunately could not be approved. ${notes || 'Please contact support for assistance.'}`,
            metadata: {
              bookingId: payment.bookingId?._id,
              amount: payment.amount,
              reason: 'Rejected during manual review',
              adminNotes: notes
            }
          }
        );
      } catch (notificationError) {
        console.error('Error sending rejection notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Payment rejected',
        payment
      });
    }
  } catch (error) {
    console.error('Error reviewing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;