const { checkConnection } = require('../config/db');

// WebSocket connection monitoring and watchdog
class WebSocketMonitor {
  constructor(io) {
    this.io = io;
    this.connectedSockets = new Map();
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      disconnections: 0,
      reconnections: 0,
      failedReconnections: 0,
      lastHealthCheck: null
    };
    this.watchdogInterval = null;
    this.healthCheckInterval = null;
    this.maxIdleTime = parseInt(process.env.WS_MAX_IDLE_TIME) || 300000; // 5 minutes
    this.watchdogCheckInterval = parseInt(process.env.WS_WATCHDOG_INTERVAL) || 60000; // 1 minute
  }

  // Register a socket connection
  registerSocket(socket) {
    this.connectedSockets.set(socket.id, {
      socket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      userId: null,
      rooms: new Set(),
      reconnectAttempts: 0
    });
    this.connectionStats.totalConnections++;
    this.connectionStats.activeConnections++;
    console.log(`📊 Socket registered: ${socket.id} (Total: ${this.connectionStats.activeConnections})`);
  }

  // Update socket activity
  updateActivity(socketId) {
    const socketData = this.connectedSockets.get(socketId);
    if (socketData) {
      socketData.lastActivity = Date.now();
    }
  }

  // Set user ID for socket
  setUserId(socketId, userId) {
    const socketData = this.connectedSockets.get(socketId);
    if (socketData) {
      socketData.userId = userId;
    }
  }

  // Add room to socket
  addRoom(socketId, room) {
    const socketData = this.connectedSockets.get(socketId);
    if (socketData) {
      socketData.rooms.add(room);
    }
  }

  // Record reconnection attempt
  recordReconnectionAttempt(socketId) {
    const socketData = this.connectedSockets.get(socketId);
    if (socketData) {
      socketData.reconnectAttempts++;
      console.log(`🔄 Socket ${socketId} reconnection attempt ${socketData.reconnectAttempts}`);
    }
  }

  // Record successful reconnection
  recordSuccessfulReconnection(socketId) {
    this.connectionStats.reconnections++;
    console.log(`✅ Socket ${socketId} successfully reconnected (Total: ${this.connectionStats.reconnections})`);
  }

  // Unregister a socket (on disconnect)
  unregisterSocket(socketId) {
    const socketData = this.connectedSockets.get(socketId);
    if (socketData) {
      this.connectedSockets.delete(socketId);
      this.connectionStats.activeConnections--;
      this.connectionStats.disconnections++;
      console.log(`📊 Socket unregistered: ${socketId} (Active: ${this.connectionStats.activeConnections})`);
    }
  }

  // Start watchdog monitoring
  startWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }

    this.watchdogInterval = setInterval(() => {
      this.performWatchdogCheck();
    }, this.watchdogCheckInterval);

    console.log('🐕 WebSocket watchdog started');
  }

  // Stop watchdog monitoring
  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
      console.log('🐕 WebSocket watchdog stopped');
    }
  }

  // Perform watchdog check
  async performWatchdogCheck() {
    const now = Date.now();
    let idleSockets = 0;
    let staleSockets = 0;

    for (const [socketId, socketData] of this.connectedSockets) {
      const timeSinceActivity = now - socketData.lastActivity;

      // Check for idle sockets
      if (timeSinceActivity > this.maxIdleTime) {
        idleSockets++;
        console.warn(`⚠️ Idle socket detected: ${socketId} (${timeSinceActivity/1000}s inactive)`);

        // Send ping to check if socket is still alive
        try {
          socketData.socket.emit('ping', { timestamp: now, watchdog: true });
        } catch (error) {
          console.error(`❌ Failed to ping idle socket ${socketId}:`, error.message);
          staleSockets++;
          // Force disconnect stale socket
          try {
            socketData.socket.disconnect(true);
          } catch (disconnectError) {
            console.error(`❌ Failed to disconnect stale socket ${socketId}:`, disconnectError.message);
          }
        }
      }
    }

    // Log watchdog stats
    if (idleSockets > 0) {
      console.log(`🐕 Watchdog check: ${idleSockets} idle sockets, ${staleSockets} stale sockets cleaned up`);
    }

    // Update connection stats
    this.connectionStats.lastHealthCheck = now;
  }

  // Start health monitoring
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 300000); // Every 5 minutes

    console.log('🏥 WebSocket health monitoring started');
  }

  // Stop health monitoring
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🏥 WebSocket health monitoring stopped');
    }
  }

  // Perform comprehensive health check
  async performHealthCheck() {
    try {
      const dbHealth = await checkConnection();
      const wsStats = this.getStats();

      console.log('🏥 WebSocket Health Check:');
      console.log(`   Database: ${dbHealth.status}`);
      console.log(`   Active sockets: ${wsStats.activeConnections}`);
      console.log(`   Total connections: ${wsStats.totalConnections}`);
      console.log(`   Disconnections: ${wsStats.disconnections}`);
      console.log(`   Reconnect success rate: ${wsStats.reconnections}/${wsStats.reconnections + wsStats.failedReconnections}`);

      // Emit health status to admin room
      this.io.to('admin').emit('system-health', {
        timestamp: Date.now(),
        database: dbHealth,
        websockets: wsStats
      });

    } catch (error) {
      console.error('❌ WebSocket health check failed:', error.message);
    }
  }

  // Get connection statistics
  getStats() {
    return {
      ...this.connectionStats,
      connectedSockets: this.connectedSockets.size,
      timestamp: Date.now()
    };
  }

  // Broadcast to all connected sockets
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Send to specific user
  sendToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Send to admin room
  sendToAdmins(event, data) {
    this.io.to('admin').emit(event, data);
  }

  // Force reconnection for all sockets (useful for server maintenance)
  forceReconnectAll(reason = 'Server maintenance') {
    console.log(`🔄 Forcing reconnection for all sockets: ${reason}`);
    for (const [socketId, socketData] of this.connectedSockets) {
      try {
        socketData.socket.emit('force-reconnect', { reason, timestamp: Date.now() });
        // Give clients time to reconnect before disconnecting
        setTimeout(() => {
          if (this.connectedSockets.has(socketId)) {
            socketData.socket.disconnect(true);
          }
        }, 5000);
      } catch (error) {
        console.error(`❌ Failed to force reconnect socket ${socketId}:`, error.message);
      }
    }
  }

  // Cleanup on shutdown
  cleanup() {
    this.stopWatchdog();
    this.stopHealthMonitoring();
    console.log('🧹 WebSocket monitor cleanup completed');
  }
}

module.exports = WebSocketMonitor;