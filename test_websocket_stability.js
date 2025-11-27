const io = require('socket.io-client');
const { WebSocketMonitor } = require('./backend/utils/websocketMonitor');

async function testWebSocketStability() {
  console.log('🧪 TESTING WEBSOCKET CONNECTION STABILITY');
  console.log('='.repeat(60));

  const serverUrl = process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || "https://yourdomain.com"
    : "http://localhost:5000";

  const testResults = {
    connections: 0,
    disconnections: 0,
    reconnections: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    startTime: Date.now(),
    endTime: null
  };

  // Test 1: Basic connection test
  console.log('Test 1: Basic WebSocket connection');
  try {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('✅ Basic connection successful');
        testResults.connections++;
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ Basic connection failed:', error.message);
    testResults.errors++;
  }

  // Test 2: Multiple concurrent connections
  console.log('\nTest 2: Multiple concurrent connections (stress test)');
  const concurrentSockets = [];
  const numConcurrent = 10;

  for (let i = 0; i < numConcurrent; i++) {
    try {
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          testResults.connections++;
          concurrentSockets.push(socket);
          resolve();
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`❌ Concurrent connection ${i + 1} failed:`, error.message);
      testResults.errors++;
    }
  }

  console.log(`✅ ${concurrentSockets.length}/${numConcurrent} concurrent connections successful`);

  // Test 3: Message exchange test
  console.log('\nTest 3: Message exchange test');
  if (concurrentSockets.length > 0) {
    const testSocket = concurrentSockets[0];

    testSocket.on('connected', (data) => {
      console.log('✅ Connection confirmation received');
      testResults.messagesReceived++;
    });

    // Test ping/pong
    testSocket.on('pong', (data) => {
      console.log('🏓 Pong received');
      testResults.messagesReceived++;
    });

    // Send test ping
    testSocket.emit('ping', { test: true, timestamp: Date.now() });
    testResults.messagesSent++;

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test 4: Connection stability over time
  console.log('\nTest 4: Connection stability over time');
  const stabilityTestDuration = 30 * 1000; // 30 seconds
  const stabilityStartTime = Date.now();
  let stabilityChecks = 0;
  let stabilitySuccess = 0;

  const stabilityInterval = setInterval(() => {
    if (Date.now() - stabilityStartTime >= stabilityTestDuration) {
      clearInterval(stabilityInterval);
      return;
    }

    stabilityChecks++;
    const connectedCount = concurrentSockets.filter(socket => socket.connected).length;
    stabilitySuccess += connectedCount;

    if (connectedCount < concurrentSockets.length) {
      console.warn(`⚠️ Connection drop detected: ${connectedCount}/${concurrentSockets.length} connected`);
    }
  }, 1000);

  await new Promise(resolve => setTimeout(resolve, stabilityTestDuration));

  console.log(`✅ Stability test: ${stabilitySuccess}/${stabilityChecks * concurrentSockets.length} connection checks passed`);

  // Test 5: Reconnection test
  console.log('\nTest 5: Reconnection test');
  if (concurrentSockets.length > 0) {
    const reconnectSocket = concurrentSockets[0];

    // Force disconnect
    reconnectSocket.disconnect();

    await new Promise(resolve => {
      reconnectSocket.on('connect', () => {
        console.log('✅ Reconnection successful');
        testResults.reconnections++;
        resolve();
      });
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test 6: Network fluctuation simulation
  console.log('\nTest 6: Network fluctuation simulation');
  const fluctuationTestDuration = 20 * 1000; // 20 seconds
  const fluctuationStartTime = Date.now();

  // Simulate network issues by rapidly connecting/disconnecting
  const fluctuationPromises = [];

  for (let i = 0; i < 5; i++) {
    const promise = new Promise(async (resolve) => {
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      socket.on('connect', () => {
        testResults.connections++;
        // Disconnect after short time
        setTimeout(() => {
          socket.disconnect();
          testResults.disconnections++;
          resolve();
        }, Math.random() * 2000 + 500); // 0.5-2.5 seconds
      });

      socket.on('connect_error', () => {
        testResults.errors++;
        resolve();
      });
    });

    fluctuationPromises.push(promise);

    // Stagger connections
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await Promise.all(fluctuationPromises);
  console.log('✅ Network fluctuation simulation completed');

  // Cleanup
  concurrentSockets.forEach(socket => {
    socket.disconnect();
    testResults.disconnections++;
  });

  testResults.endTime = Date.now();
  const totalDuration = testResults.endTime - testResults.startTime;

  // Results summary
  console.log('\n🎉 WEBSOCKET STABILITY TESTING COMPLETE!');
  console.log('='.repeat(70));
  console.log('📋 SUMMARY:');
  console.log(`• Total duration: ${totalDuration/1000}s`);
  console.log(`• Connections established: ${testResults.connections}`);
  console.log(`• Disconnections: ${testResults.disconnections}`);
  console.log(`• Reconnections: ${testResults.reconnections}`);
  console.log(`• Messages sent: ${testResults.messagesSent}`);
  console.log(`• Messages received: ${testResults.messagesReceived}`);
  console.log(`• Errors encountered: ${testResults.errors}`);
  console.log(`• Connection success rate: ${((testResults.connections - testResults.errors) / testResults.connections * 100).toFixed(1)}%`);

  if (testResults.errors === 0) {
    console.log('• ✅ All WebSocket stability tests passed!');
  } else {
    console.log('• ⚠️ Some tests had errors - check server configuration');
  }

  return testResults;
}

// Test WebSocket monitor functionality
async function testWebSocketMonitor() {
  console.log('\n🔍 Testing WebSocket Monitor functionality');

  // This would require a running server instance
  // For now, just test the class instantiation
  try {
    const mockIo = {
      emit: () => {},
      to: () => ({ emit: () => {} })
    };

    const monitor = new WebSocketMonitor(mockIo);
    console.log('✅ WebSocketMonitor class instantiated successfully');

    const stats = monitor.getStats();
    console.log('✅ Monitor stats retrieved:', stats);

    return true;
  } catch (error) {
    console.error('❌ WebSocketMonitor test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  try {
    const wsResults = await testWebSocketStability();
    const monitorResult = await testWebSocketMonitor();

    console.log('\n🏁 ALL WEBSOCKET TESTS COMPLETED');
    console.log('WebSocket Stability:', wsResults.errors === 0 ? '✅ PASSED' : '❌ FAILED');
    console.log('WebSocket Monitor:', monitorResult ? '✅ PASSED' : '❌ FAILED');

    if (wsResults.errors === 0 && monitorResult) {
      console.log('\n🎉 ALL WEBSOCKET STABILITY TESTS PASSED!');
      process.exit(0);
    } else {
      console.log('\n❌ SOME WEBSOCKET TESTS FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR IN WEBSOCKET TESTING:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testWebSocketStability,
  testWebSocketMonitor,
  runAllTests
};