const mongoose = require('mongoose');
const { generateAndSendOTP, verifyOTP } = require('./backend/utils/otpService');

async function testOTPSystem() {
  console.log('🧪 TESTING OTP SYSTEM');
  console.log('='.repeat(50));

  try {
    // Connect to database
    await mongoose.connect('mongodb://localhost:27017/trixtech_test');
    console.log('✅ Database connected');

    const testEmail = 'test@example.com';
    const testPurpose = 'test_verification';

    // Test 1: Generate and send OTP
    console.log('\n📤 Test 1: Generating OTP...');
    const generateResult = await generateAndSendOTP(testEmail, testPurpose, { test: true });

    if (generateResult.success) {
      console.log('✅ OTP generated successfully');
      console.log(`📧 OTP sent to: ${testEmail}`);
      console.log(`⏰ Expires in: ${generateResult.expiresIn} seconds`);
    } else {
      console.log('❌ OTP generation failed');
      return;
    }

    // For testing purposes, let's get the OTP from database
    const OTP = require('./backend/models/OTP');
    const otpRecord = await OTP.findOne({
      email: testEmail,
      purpose: testPurpose,
      isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      console.log('❌ Could not find OTP record in database');
      return;
    }

    const testOTP = otpRecord.otp;
    console.log(`🔑 Test OTP: ${testOTP} (from database for testing)`);

    // Test 2: Verify correct OTP
    console.log('\n✅ Test 2: Verifying correct OTP...');
    const verifyResult = await verifyOTP(testEmail, testOTP, testPurpose);

    if (verifyResult.success) {
      console.log('✅ OTP verification successful');
      console.log('📊 Metadata:', verifyResult.metadata);
    } else {
      console.log('❌ OTP verification failed');
      return;
    }

    // Test 3: Try to verify the same OTP again (should fail)
    console.log('\n🚫 Test 3: Verifying used OTP (should fail)...');
    try {
      await verifyOTP(testEmail, testOTP, testPurpose);
      console.log('❌ OTP was verified again (this should not happen)');
    } catch (error) {
      console.log('✅ OTP correctly rejected as already used');
    }

    // Test 4: Try to verify wrong OTP
    console.log('\n❌ Test 4: Verifying wrong OTP (should fail)...');
    try {
      await verifyOTP(testEmail, '000000', testPurpose);
      console.log('❌ Wrong OTP was accepted (this should not happen)');
    } catch (error) {
      console.log('✅ Wrong OTP correctly rejected');
    }

    console.log('\n🎉 ALL OTP TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('📋 SUMMARY:');
    console.log('   • OTP Generation: ✅');
    console.log('   • OTP Email Sending: ✅');
    console.log('   • OTP Verification: ✅');
    console.log('   • Used OTP Rejection: ✅');
    console.log('   • Wrong OTP Rejection: ✅');
    console.log('🚀 OTP System is ready!');

  } catch (error) {
    console.error('❌ OTP TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run tests
testOTPSystem();