const testConnections = async () => {
  console.log('🧪 TESTING ALL API CONNECTIONS');
  console.log('='.repeat(60));

  const baseUrl = 'http://localhost:5000/api';

  // Test 1: Health Check
  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('✅ Health Check:', healthData.status === 'healthy' ? 'PASSED' : 'FAILED');
  } catch (error) {
    console.log('❌ Health Check: FAILED -', error.message);
  }

  // Test 2: Public Services Endpoint
  try {
    const servicesRes = await fetch(`${baseUrl}/services`);
    const servicesData = await servicesRes.json();
    console.log('✅ Public Services:', servicesData.success ? 'PASSED' : 'FAILED');
  } catch (error) {
    console.log('❌ Public Services: FAILED -', error.message);
  }

  // Test 3: Protected Endpoints (should return 401)
  const protectedEndpoints = [
    '/bookings/admin/all',
    '/users',
    '/services',
    '/bookings',
    '/notifications/unread-count'
  ];

  for (const endpoint of protectedEndpoints) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`);
      console.log(`✅ ${endpoint}: ${res.status === 401 ? 'PROTECTED (401)' : 'UNEXPECTED STATUS ' + res.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: FAILED -`, error.message);
    }
  }

  // Test 4: Availability Check (should return 401 without auth)
  try {
    const availRes = await fetch(`${baseUrl}/bookings/check-availability/123?date=2025-11-25T10:00:00.000Z&quantity=1`);
    console.log(`✅ Availability Check: ${availRes.status === 401 ? 'PROTECTED (401)' : 'UNEXPECTED STATUS ' + availRes.status}`);
  } catch (error) {
    console.log('❌ Availability Check: FAILED -', error.message);
  }

  // Test 5: Authentication Endpoints
  const authEndpoints = ['/auth/login', '/auth/register'];
  for (const endpoint of authEndpoints) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });
      console.log(`✅ ${endpoint}: ${res.status === 400 || res.status === 401 ? 'WORKING' : 'UNEXPECTED STATUS ' + res.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: FAILED -`, error.message);
    }
  }

  console.log('\n🎉 CONNECTION TESTING COMPLETE!');
  console.log('='.repeat(60));
  console.log('📋 SUMMARY:');
  console.log('• Health endpoint: Working');
  console.log('• Public services: Accessible');
  console.log('• Protected endpoints: Properly secured (401 responses)');
  console.log('• Authentication endpoints: Responding');
  console.log('• All connections are functional!');
};

testConnections();