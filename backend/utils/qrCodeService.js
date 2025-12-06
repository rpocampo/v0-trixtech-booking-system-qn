const QRCode = require('qrcode');
const sharp = require('sharp');

// GCash QR Code format for payments
const generateGCashQRData = (paymentData) => {
  // Use the GCash QR code from environment variable
  // This is a valid EMV QR code that GCash can scan
  const gcashQRCode = process.env.GCASH_QR_CODE || '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWJXZR45204601653036085802PH5910G** A** P.6007NASUGBU610412346304CDAA';

  return gcashQRCode;
};

// Create QR code overlay with text and branding
const createQROverlay = async (qrBuffer) => {
  try {
    // Get QR code dimensions
    const qrImage = sharp(qrBuffer);
    const { width, height } = await qrImage.metadata();

    // Create a larger canvas with space for text above QR code
    // Target: 5cm total height, 6cm width
    // 5cm at 96 DPI = ~189 pixels, 6cm at 96 DPI = ~227 pixels
    // QR is 150px square, so total height should be ~189px, meaning text area = 189 - 150 = 39px
    const textHeight = 39;
    const totalHeight = height + textHeight;
    const totalWidth = Math.max(width, 227); // Ensure minimum 6cm width

    // Create SVG with highly visible text at the top
    const textSvg = `
      <svg width="${totalWidth}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background for text -->
        <rect x="0" y="0" width="${totalWidth}" height="${textHeight}" fill="white" />

        <!-- GCash logo text - highly visible -->
        <text x="${totalWidth/2}" y="22" font-family="Arial Black, Arial, sans-serif" font-size="20" font-weight="900" fill="#0066cc" text-anchor="middle" stroke="#004499" stroke-width="0.8">GCASH</text>

        <!-- Merchant name - prominent -->
        <text x="${totalWidth/2}" y="35" font-family="Arial Black, Arial, sans-serif" font-size="14" font-weight="900" fill="#333333" text-anchor="middle" stroke="#000000" stroke-width="0.5">G** A** P.</text>
      </svg>
    `;

    // Create the final composite image
    const overlayBuffer = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([
      {
        input: Buffer.from(textSvg),
        top: 0,
        left: 0
      },
      {
        input: qrBuffer,
        top: textHeight,
        left: Math.floor((totalWidth - width) / 2) // Center the QR code horizontally
      }
    ])
    .png()
    .toBuffer();

    return overlayBuffer;
  } catch (error) {
    console.error('Error creating QR overlay:', error);
    // Return original QR buffer if overlay fails
    return qrBuffer;
  }
};

// Generate GCash branding image (separate from QR code)
const generateGCashBrandingImage = async () => {
  try {
    // Create branding image with same dimensions as the text area in overlay
    const textHeight = 39;
    const totalWidth = 227; // 6cm width

    // Create SVG with highly visible text
    const textSvg = `
      <svg width="${totalWidth}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background for text -->
        <rect x="0" y="0" width="${totalWidth}" height="${textHeight}" fill="white" />

        <!-- GCash logo text - highly visible -->
        <text x="${totalWidth/2}" y="22" font-family="Arial Black, Arial, sans-serif" font-size="20" font-weight="900" fill="#0066cc" text-anchor="middle" stroke="#004499" stroke-width="0.8">GCASH</text>

        <!-- Merchant name - prominent -->
        <text x="${totalWidth/2}" y="35" font-family="Arial Black, Arial, sans-serif" font-size="14" font-weight="900" fill="#333333" text-anchor="middle" stroke="#000000" stroke-width="0.5">G** A** P.</text>
      </svg>
    `;

    // Create the branding image buffer
    const brandingBuffer = await sharp(Buffer.from(textSvg))
      .png()
      .toBuffer();

    // Convert to data URL
    const dataURL = `data:image/png;base64,${brandingBuffer.toString('base64')}`;
    return dataURL;
  } catch (error) {
    console.error('Error generating GCash branding image:', error);
    throw error;
  }
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
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    // Generate QR code buffer (without overlay)
    const qrBuffer = await QRCode.toBuffer(qrData, options);

    // Convert to data URL
    const dataURL = `data:image/png;base64,${qrBuffer.toString('base64')}`;
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
      width: 150
    };

    const qrBuffer = await QRCode.toBuffer(qrData, options);

    // Return plain QR buffer without overlay
    return qrBuffer;
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
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    const qrBuffer = await QRCode.toBuffer(qrData, options);

    // Convert to base64 (without overlay)
    const base64 = qrBuffer.toString('base64');
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
    note: 'Payment details are embedded in the QR code. Payment will be automatically verified and your reservation will be confirmed.'
  };
};

module.exports = {
  generateGCashQRData,
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateQRCodeBase64,
  generateGCashBrandingImage,
  validateQRData,
  generatePaymentInstructions
};