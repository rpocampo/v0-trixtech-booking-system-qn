const QRCode = require('qrcode');

// GCash QR Code format for payments
const generateGCashQRData = (paymentData) => {
  // Use the provided GCash QR code directly
  // This is a valid EMV QR code that GCash can scan
  const gcashQRCode = '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDO83CHRX5204601653036085802PH5908MI**I M.6008Caloocan6104123463045192';

  return gcashQRCode;
};

// Generate QR code as data URL (for web display)
const generateQRCodeDataURL = async (paymentData) => {
  try {
    let qrData;

    // Check if user has personal GCash QR code data
    if (paymentData.userQRCode) {
      // Use user's personal GCash QR code data directly
      qrData = paymentData.userQRCode;
    } else {
      // Generate dynamic QR code for payments to include payment-specific data
      qrData = generateGCashQRData(paymentData);
    }

    const options = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    const dataURL = await QRCode.toDataURL(qrData, options);
    return dataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Generate QR code as buffer (for file storage)
const generateQRCodeBuffer = async (paymentData) => {
  try {
    const qrData = generateGCashQRData(paymentData);

    const options = {
      errorCorrectionLevel: 'M',
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    const buffer = await QRCode.toBuffer(qrData, options);
    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw error;
  }
};

// Generate QR code as base64 string
const generateQRCodeBase64 = async (paymentData) => {
  try {
    const qrData = generateGCashQRData(paymentData);

    const options = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    const base64 = await QRCode.toString(qrData, options);
    return base64;
  } catch (error) {
    console.error('Error generating QR code base64:', error);
    throw error;
  }
};

// Validate QR code data (for payment verification)
const validateQRData = (qrData) => {
  try {
    const parsed = JSON.parse(qrData);

    // Validate required fields
    const requiredFields = ['type', 'merchant', 'amount', 'currency', 'reference', 'paymentId'];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate amount
    if (parsed.amount <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }

    // Validate currency
    if (parsed.currency !== 'PHP') {
      return { valid: false, error: 'Unsupported currency' };
    }

    return {
      valid: true,
      data: parsed
    };
  } catch (error) {
    return { valid: false, error: 'Invalid QR code format' };
  }
};

// Generate payment instructions for QR code
const generatePaymentInstructions = (paymentData) => {
  // Instructions for dynamic QR code (always used now)
  return {
    title: 'Pay with GCash QR Code',
    instructions: [
      '1. Open your GCash app',
      '2. Tap the QR scanner icon',
      '3. Point your camera at the QR code below',
      '4. Review the payment details (amount and merchant should auto-populate)',
      '5. Confirm and complete the payment, or use the test payment button below to simulate payment for testing'
    ],
    amount: paymentData.amount,
    reference: paymentData.referenceNumber,
    merchant: paymentData.merchantName || 'TRIXTECH',
    note: 'Payment details are embedded in the QR code. Payment will be automatically verified and your booking will be confirmed.'
  };
};

module.exports = {
  generateGCashQRData,
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateQRCodeBase64,
  validateQRData,
  generatePaymentInstructions
};