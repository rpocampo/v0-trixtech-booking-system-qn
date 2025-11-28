require('dotenv').config();
const { generateQRCodeDataURL, generateGCashQRData } = require('./utils/qrCodeService');

async function testQR() {
  try {
    console.log('GCASH_QR_CODE env var:', process.env.GCASH_QR_CODE ? 'SET' : 'NOT SET');
    console.log('Testing QR code generation...');
    const paymentData = {
      amount: 100,
      referenceNumber: 'TEST123',
      merchantName: 'TRIXTECH'
    };

    // Show the raw QR data first
    const rawQRData = generateGCashQRData(paymentData);
    console.log('Raw QR data:', rawQRData);

    const qrCode = await generateQRCodeDataURL(paymentData);
    console.log('QR code generated successfully!');
    console.log('QR code starts with:', qrCode.substring(0, 50));
  } catch (error) {
    console.error('QR generation failed:', error);
  }
}

testQR();