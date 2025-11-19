const QRCode = require('qrcode');

// GCash QR Code format for payments (EMV QR Code Specification)
const generateGCashQRData = (paymentData) => {
  const {
    amount,
    referenceNumber,
    merchantName = 'TRIXTECH',
    merchantId = 'TRIXTECH001',
    description = 'Booking Payment'
  } = paymentData;

  // Format amount to 2 decimal places without decimal point
  const formattedAmount = Math.round(amount * 100).toString().padStart(2, '0');

  // EMV QR Code format for GCash Philippines
  // Based on EMVCo QR Code specification
  const qrParts = [
    '000201', // Payload Format Indicator
    '010211', // Point of Initiation Method (static QR)
    '2636', // Merchant Account Information (GCash specific)
    '0012PH0101000210', // Country Code + Merchant Category Code
    merchantId.padEnd(10, ' ').substring(0, 10), // Merchant ID (truncated/padded)
    '0303***', // Reserved for future use
    '5802PH', // Country Code
    '59' + merchantName.length.toString().padStart(2, '0') + merchantName, // Merchant Name
    '6012PHILIPPINES', // Merchant City
    '6207', // Additional Data Field
    '05' + referenceNumber.length.toString().padStart(2, '0') + referenceNumber, // Reference Number
    '540' + formattedAmount.length.toString().padStart(2, '0') + formattedAmount, // Transaction Amount
    '5303566', // Transaction Currency (PHP = 608)
    '6304' // CRC (placeholder, will be calculated)
  ];

  // Join all parts
  const qrString = qrParts.join('');

  // Calculate CRC (simplified - in production, use proper CRC calculation)
  const crc = '1234'; // Placeholder CRC
  const finalQR = qrString.replace('6304', '6304' + crc);

  return finalQR;
};

// Generate QR code as data URL (for web display)
const generateQRCodeDataURL = async (paymentData) => {
  try {
    // Check if static QR code is configured
    const staticQRCode = process.env.GCASH_QR_CODE;
    let qrData;

    if (staticQRCode) {
      // Use static QR code
      qrData = staticQRCode;
      console.log('Using static GCash QR code for payment, length:', qrData.length);
    } else {
      // Generate dynamic QR code
      qrData = generateGCashQRData(paymentData);
      console.log('Generated dynamic QR code for payment');
    }

    console.log('QR data to encode:', qrData.substring(0, 50) + '...');

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
    console.log('QR code generated successfully, dataURL length:', dataURL.length);
    return dataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    console.error('Error details:', error.message);
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
  const staticQRCode = process.env.GCASH_QR_CODE;

  if (staticQRCode) {
    // Instructions for static QR code
    return {
      title: 'Pay with GCash QR Code',
      instructions: [
        '1. Open your GCash app',
        '2. Tap the QR scanner icon or Pay QR',
        '3. Scan the QR code below',
        '4. Enter the exact amount: ₱' + paymentData.amount,
        '5. Enter reference number: ' + paymentData.referenceNumber,
        '6. Complete the payment'
      ],
      amount: paymentData.amount,
      reference: paymentData.referenceNumber,
      merchant: paymentData.merchantName || 'TRIXTECH',
      note: 'Important: Enter the exact amount and reference number shown above. Payment will be verified automatically.'
    };
  } else {
    // Instructions for dynamic QR code
    return {
      title: 'Pay with GCash QR Code',
      instructions: [
        '1. Open your GCash app',
        '2. Tap the QR scanner icon',
        '3. Point your camera at the QR code below',
        '4. Review the payment details',
        '5. Confirm and complete the payment'
      ],
      amount: paymentData.amount,
      reference: paymentData.referenceNumber,
      merchant: paymentData.merchantName || 'TRIXTECH',
      note: 'Payment will be automatically verified and your booking will be confirmed.'
    };
  }
};

module.exports = {
  generateGCashQRData,
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateQRCodeBase64,
  validateQRData,
  generatePaymentInstructions
};