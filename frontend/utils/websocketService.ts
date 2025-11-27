// WebSocket service utilities for frontend
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp?: number;
}

export class WebSocketService {
  private socket: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    // Initialize WebSocket service
  }

  connect(url: string): void {
    // WebSocket connection logic would go here
    console.log('WebSocket service connecting to:', url);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.socket) {
      this.socket.emit(message.type, message.payload);
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }
}

export const websocketService = new WebSocketService();