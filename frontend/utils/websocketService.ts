import { io, Socket } from 'socket.io-client';

interface WebSocketConfig {
  url: string;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
  pingInterval: number;
  pingTimeout: number;
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
}

class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private userId: string | null = null;
  private isAdmin: boolean = false;

  constructor(config?: Partial<WebSocketConfig>) {
    this.config = {
      url: process.env.NODE_ENV === 'production'
        ? (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://yourdomain.com')
        : 'http://localhost:5000',
      reconnectionAttempts: parseInt(process.env.NEXT_PUBLIC_WS_RECONNECTION_ATTEMPTS || '10'),
      reconnectionDelay: parseInt(process.env.NEXT_PUBLIC_WS_RECONNECTION_DELAY || '1000'),
      reconnectionDelayMax: parseInt(process.env.NEXT_PUBLIC_WS_RECONNECTION_DELAY_MAX || '5000'),
      timeout: parseInt(process.env.NEXT_PUBLIC_WS_TIMEOUT || '20000'),
      pingInterval: parseInt(process.env.NEXT_PUBLIC_WS_PING_INTERVAL || '25000'),
      pingTimeout: parseInt(process.env.NEXT_PUBLIC_WS_PING_TIMEOUT || '60000'),
      ...config
    };

    this.connectionState = {
      connected: false,
      connecting: false,
      reconnecting: false,
      reconnectAttempts: 0,
      lastConnected: null,
      lastDisconnected: null
    };

    this.initializeEventListeners();
  }

  // Initialize default event listeners
  private initializeEventListeners() {
    this.on('connected', (data: any) => {
      console.log('🔗 WebSocket connected:', data);
      this.connectionState.connected = true;
      this.connectionState.connecting = false;
      this.connectionState.reconnecting = false;
      this.connectionState.lastConnected = new Date();
      this.connectionState.reconnectAttempts = 0;

      // Join user room if userId is set
      if (this.userId) {
        this.joinUserRoom(this.userId);
      }

      // Join admin room if admin
      if (this.isAdmin) {
        this.joinAdminRoom();
      }
    });

    this.on('disconnect', (reason: string) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.connectionState.connected = false;
      this.connectionState.lastDisconnected = new Date();

      if (reason === 'io server disconnect') {
        console.log('🔄 Server initiated disconnect, attempting reconnection...');
        this.attemptReconnection();
      }
    });

    this.on('connect_error', (error: Error) => {
      console.error('❌ WebSocket connection error:', error.message);
      this.connectionState.connecting = false;
      this.attemptReconnection();
    });

    this.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      this.connectionState.reconnecting = true;
      this.connectionState.reconnectAttempts = attemptNumber;
    });

    this.on('reconnect', (attemptNumber: number) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      this.connectionState.connected = true;
      this.connectionState.reconnecting = false;
      this.connectionState.reconnectAttempts = 0;
      this.connectionState.lastConnected = new Date();
    });

    this.on('reconnect_error', (error: Error) => {
      console.error('❌ Reconnection failed:', error.message);
    });

    this.on('reconnect_failed', () => {
      console.error('🚨 Reconnection failed after all attempts');
      this.connectionState.reconnecting = false;
      // Schedule next reconnection attempt with exponential backoff
      this.scheduleReconnection();
    });

    this.on('ping', (data: any) => {
      // Respond to server ping
      this.socket?.emit('pong', { timestamp: Date.now(), ...data });
    });

    this.on('force-reconnect', (data: any) => {
      console.log('🔄 Server requested reconnection:', data.reason);
      this.disconnect();
      setTimeout(() => this.connect(), 1000);
    });
  }

  // Connect to WebSocket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.connectionState.connecting = true;

      this.socket = io(this.config.url, {
        transports: ['websocket', 'polling'],
        timeout: this.config.timeout,
        reconnection: false, // We'll handle reconnection manually for better control
        autoConnect: true,
        forceNew: false,
        multiplex: true,
        auth: {
          token: this.getAuthToken()
        }
      });

      // Set up event forwarding
      this.socket.onAny((event, ...args) => {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
          listeners.forEach(listener => {
            try {
              listener(...args);
            } catch (error) {
              console.error(`Error in event listener for ${event}:`, error);
            }
          });
        }
      });

      // Handle initial connection
      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        reject(error);
      });

      // Start health monitoring
      this.startHealthMonitoring();
    });
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
    this.connectionState.reconnecting = false;
    this.stopHealthMonitoring();
  }

  // Attempt reconnection with backoff
  private attemptReconnection() {
    if (this.connectionState.reconnectAttempts >= this.config.reconnectionAttempts) {
      console.error('🚨 Max reconnection attempts reached');
      this.scheduleReconnection();
      return;
    }

    const delay = Math.min(
      this.config.reconnectionDelay * Math.pow(2, this.connectionState.reconnectAttempts),
      this.config.reconnectionDelayMax
    );

    console.log(`⏳ Scheduling reconnection in ${delay}ms (attempt ${this.connectionState.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.connectionState.reconnectAttempts++;
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        this.attemptReconnection();
      });
    }, delay);
  }

  // Schedule next reconnection attempt
  private scheduleReconnection() {
    const delay = Math.min(
      this.config.reconnectionDelayMax * 2,
      30000 // Max 30 seconds
    );

    console.log(`⏳ Scheduling next reconnection attempt in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connectionState.reconnectAttempts = 0;
      this.attemptReconnection();
    }, delay);
  }

  // Start health monitoring
  private startHealthMonitoring() {
    this.stopHealthMonitoring(); // Clear any existing timer

    this.healthCheckTimer = setInterval(() => {
      if (this.socket?.connected) {
        // Send health check ping
        this.socket.emit('ping', { timestamp: Date.now(), healthCheck: true });
      }
    }, 30000); // Every 30 seconds
  }

  // Stop health monitoring
  private stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // Set user ID for room joining
  setUserId(userId: string) {
    this.userId = userId;
    if (this.socket?.connected) {
      this.joinUserRoom(userId);
    }
  }

  // Set admin status
  setAdmin(isAdmin: boolean) {
    this.isAdmin = isAdmin;
    if (this.socket?.connected && isAdmin) {
      this.joinAdminRoom();
    }
  }

  // Join user-specific room
  private joinUserRoom(userId: string) {
    this.socket?.emit('join', userId);
  }

  // Join admin room
  private joinAdminRoom() {
    this.socket?.emit('join-admin');
  }

  // Add event listener
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  // Remove event listener
  off(event: string, callback?: Function) {
    if (!callback) {
      this.eventListeners.delete(event);
    } else {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  }

  // Emit event to server
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot emit event: WebSocket not connected');
    }
  }

  // Get connection state
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  // Get auth token (implement based on your auth system)
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  // Cleanup
  cleanup() {
    this.disconnect();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;