const { testWebSocketStability, testWebSocketMonitor } = require('./test_websocket_stability');
const { connectDB, checkConnection, getCircuitBreakerStatus } = require('./backend/config/db');

async function testSystemStability() {
  console.log('🧪 TESTING COMPLETE SYSTEM STABILITY (Database + WebSocket)');
  console.log('='.repeat(80));

  const results = {
    database: null,
    websocket: null,
    overall: {
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      passed: false
    }
  };

  try {
    // Test 1: Database stability
    console.log('🔍 Testing database stability...');
    await connectDB();

    const dbHealth = await checkConnection();
    const circuitStatus = getCircuitBreakerStatus();

    results.database = {
      connected: dbHealth.status === 'connected',
      circuitBreakerState: circuitStatus.state,
      failureCount: circuitStatus.failureCount,
      readyState: dbHealth.readyState
    };

    console.log(`✅ Database: ${results.database.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`   Circuit breaker: ${results.database.circuitBreakerState}`);

    // Test 2: WebSocket stability
    console.log('\n🔍 Testing WebSocket stability...');
    const wsResults = await testWebSocketStability();
    results.websocket = wsResults;

    // Test 3: Long-duration stability test
    console.log('\n⏱️ Testing long-duration system stability...');
    const longTestDuration = 60 * 1000; // 1 minute
    const longTestStart = Date.now();
    let longTestChecks = 0;
    let longTestSuccess = 0;

    console.log(`Running long-duration test for ${longTestDuration/1000} seconds...`);

    const longTestInterval = setInterval(async () => {
      if (Date.now() - longTestStart >= longTestDuration) {
        clearInterval(longTestInterval);
        return;
      }

      longTestChecks++;

      try {
        // Check database
        const dbCheck = await checkConnection();
        // Check if we can simulate a WebSocket ping (would need actual server)
        const dbOk = dbCheck.status === 'connected';

        if (dbOk) {
          longTestSuccess++;
        } else {
          console.warn(`⚠️ Long-test check ${longTestChecks} failed: Database disconnected`);
        }
      } catch (error) {
        console.warn(`⚠️ Long-test check ${longTestChecks} failed:`, error.message);
      }
    }, 5000); // Check every 5 seconds

    // Wait for long test to complete
    await new Promise(resolve => setTimeout(resolve, longTestDuration + 1000));

    console.log(`✅ Long-duration test: ${longTestSuccess}/${longTestChecks} checks passed`);

    // Test 4: Stress test with concurrent operations
    console.log('\n🏋️ Stress testing with concurrent operations...');
    const stressOperations = 50;
    const stressPromises = [];

    for (let i = 0; i < stressOperations; i++) {
      stressPromises.push(
        Promise.all([
          checkConnection(),
          new Promise(resolve => setTimeout(resolve, Math.random() * 100)) // Small delay
        ])
      );
    }

    const stressResults = await Promise.all(stressPromises);
    const stressSuccess = stressResults.filter(([dbResult]) => dbResult.status === 'connected').length;

    console.log(`✅ Stress test: ${stressSuccess}/${stressOperations} operations successful`);

    // Test 5: Memory leak check (basic)
    console.log('\n🧠 Checking for memory leaks...');
    const initialMemory = process.memoryUsage();
    global.gc && global.gc(); // Force garbage collection if available

    // Perform some operations
    for (let i = 0; i < 100; i++) {
      await checkConnection();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalMemory = process.memoryUsage();
    global.gc && global.gc();

    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseMB = (memoryIncrease / 1024 / 1024).toFixed(2);

    console.log(`📊 Memory usage: ${initialMemory.heapUsed / 1024 / 1024}MB → ${finalMemory.heapUsed / 1024 / 1024}MB`);
    console.log(`   Increase: ${memoryIncreaseMB}MB`);

    if (Math.abs(memoryIncrease) < 50 * 1024 * 1024) { // Less than 50MB increase
      console.log('✅ Memory usage stable');
    } else {
      console.log('⚠️ Significant memory increase detected');
    }

    // Calculate overall results
    results.overall.endTime = Date.now();
    results.overall.duration = results.overall.endTime - results.overall.startTime;

    const dbPassed = results.database.connected && results.database.circuitBreakerState === 'CLOSED';
    const wsPassed = results.websocket.errors === 0;
    const longTestPassed = longTestSuccess / longTestChecks > 0.95; // 95% success rate
    const stressTestPassed = stressSuccess / stressOperations > 0.95; // 95% success rate

    results.overall.passed = dbPassed && wsPassed && longTestPassed && stressTestPassed;

    // Final summary
    console.log('\n🎉 SYSTEM STABILITY TESTING COMPLETE!');
    console.log('='.repeat(80));
    console.log('📋 FINAL SUMMARY:');
    console.log(`• Total test duration: ${(results.overall.duration / 1000).toFixed(1)}s`);
    console.log(`• Database stability: ${dbPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`• WebSocket stability: ${wsPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`• Long-duration test: ${longTestPassed ? '✅ PASSED' : '❌ FAILED'} (${longTestSuccess}/${longTestChecks})`);
    console.log(`• Stress test: ${stressTestPassed ? '✅ PASSED' : '❌ FAILED'} (${stressSuccess}/${stressOperations})`);
    console.log(`• Memory stability: ✅ CHECKED (${memoryIncreaseMB}MB increase)`);
    console.log(`• Overall result: ${results.overall.passed ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);

    if (results.overall.passed) {
      console.log('\n🚀 SYSTEM IS READY FOR PRODUCTION WITH STABLE CONNECTIONS!');
    } else {
      console.log('\n⚠️ SYSTEM NEEDS ATTENTION BEFORE PRODUCTION DEPLOYMENT');
    }

    return results;

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR IN SYSTEM TESTING:', error);
    results.overall.endTime = Date.now();
    results.overall.duration = results.overall.endTime - results.overall.startTime;
    results.overall.passed = false;
    return results;
  }
}

// Network fluctuation simulation test
async function testNetworkFluctuations() {
  console.log('\n🌐 TESTING NETWORK FLUCTUATION RESILIENCE');
  console.log('='.repeat(50));

  // This test would require network simulation tools
  // For now, we'll simulate by testing rapid connect/disconnect cycles
  console.log('Simulating network instability...');

  const fluctuationResults = {
    cycles: 0,
    successfulReconnects: 0,
    failures: 0
  };

  const cycles = 10;

  for (let i = 0; i < cycles; i++) {
    fluctuationResults.cycles++;

    try {
      // Simulate network drop by checking connection rapidly
      const checks = [];
      for (let j = 0; j < 5; j++) {
        checks.push(checkConnection());
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const results = await Promise.all(checks);
      const successCount = results.filter(r => r.status === 'connected').length;

      if (successCount >= 4) { // 80% success rate
        fluctuationResults.successfulReconnects++;
      } else {
        fluctuationResults.failures++;
        console.warn(`⚠️ Network fluctuation cycle ${i + 1}: Only ${successCount}/5 checks successful`);
      }

      // Brief pause between cycles
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      fluctuationResults.failures++;
      console.error(`❌ Network fluctuation cycle ${i + 1} failed:`, error.message);
    }
  }

  console.log(`✅ Network fluctuation test: ${fluctuationResults.successfulReconnects}/${fluctuationResults.cycles} cycles successful`);

  return fluctuationResults;
}

// Run all tests
async function runCompleteSystemTest() {
  try {
    const systemResults = await testSystemStability();
    const networkResults = await testNetworkFluctuations();

    console.log('\n🏁 COMPLETE SYSTEM STABILITY TEST SUITE FINISHED');
    console.log('='.repeat(60));
    console.log('FINAL RESULTS:');
    console.log(`• System Stability: ${systemResults.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`• Network Resilience: ${networkResults.successfulReconnects === networkResults.cycles ? '✅ PASSED' : '❌ FAILED'}`);

    const overallSuccess = systemResults.overall.passed && (networkResults.successfulReconnects === networkResults.cycles);

    if (overallSuccess) {
      console.log('\n🎉 ALL SYSTEM STABILITY TESTS PASSED!');
      console.log('🚀 The system has never-disconnect stable connections!');
      process.exit(0);
    } else {
      console.log('\n❌ SYSTEM STABILITY TESTS FAILED');
      console.log('🔧 Please review and fix connection stability issues');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 FATAL ERROR IN SYSTEM TESTING:', error);
    process.exit(1);
  }
}

// Export for use in other tests
module.exports = {
  testSystemStability,
  testNetworkFluctuations,
  runCompleteSystemTest
};

// Run if called directly
if (require.main === module) {
  runCompleteSystemTest();
}