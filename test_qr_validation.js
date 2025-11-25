const { generateQRCodeDataURL, STATIC_GCASH_QR_PAYLOAD } = require('./backend/utils/qrCodeService');

async function testQRCode() {
  console.log('🧪 TESTING QR CODE GENERATION');
  console.log('='.repeat(50));

  try {
    console.log('Static GCash QR Payload:');
    console.log(STATIC_GCASH_QR_PAYLOAD);
    console.log('');

    // Test generating QR code
    const paymentData = {
      amount: 1500.00,
      referenceNumber: 'TEST_QR_123',
      merchantName: 'TRIXTECH'
    };

    console.log('Generating QR code for payment data:', paymentData);
    const qrCodeDataURL = await generateQRCodeDataURL(paymentData);

    console.log('✅ QR Code generated successfully');
    console.log('QR Code Data URL length:', qrCodeDataURL.length);
    console.log('QR Code starts with:', qrCodeDataURL.substring(0, 50) + '...');

    // Extract the base64 data to see the actual QR content
    const base64Data = qrCodeDataURL.split(',')[1];
    const qrContent = Buffer.from(base64Data, 'base64').toString();

    console.log('QR Code contains GCash payload:', qrContent.includes(STATIC_GCASH_QR_PAYLOAD));

  } catch (error) {
    console.error('❌ QR Code generation failed:', error.message);
  }
}

testQRCode();