import { useEffect, useRef, useState, useCallback } from 'react';
import websocketService from '../utils/websocketService';

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
}

interface UseWebSocketOptions {
  userId?: string;
  isAdmin?: boolean;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    userId,
    isAdmin = false,
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    websocketService.getConnectionState()
  );
  const eventListenersRef = useRef<Map<string, Function>>(new Map());

  // Update connection state
  const updateConnectionState = useCallback(() => {
    setConnectionState(websocketService.getConnectionState());
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await websocketService.connect();
      updateConnectionState();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      if (onError) onError(error as Error);
    }
  }, [updateConnectionState, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    updateConnectionState();
  }, [updateConnectionState]);

  // Send event to server
  const emit = useCallback((event: string, data?: any) => {
    websocketService.emit(event, data);
  }, []);

  // Listen to events from server
  const on = useCallback((event: string, callback: Function) => {
    const wrappedCallback = (...args: any[]) => {
      callback(...args);
    };

    eventListenersRef.current.set(event, wrappedCallback);
    websocketService.on(event, wrappedCallback);
  }, []);

  // Remove event listener
  const off = useCallback((event: string) => {
    const listener = eventListenersRef.current.get(event);
    if (listener) {
      websocketService.off(event, listener);
      eventListenersRef.current.delete(event);
    }
  }, []);

  // Set up event listeners for connection state changes
  useEffect(() => {
    const handleConnect = () => {
      updateConnectionState();
      if (onConnect) onConnect();
    };

    const handleDisconnect = (reason: string) => {
      updateConnectionState();
      if (onDisconnect) onDisconnect(reason);
    };

    const handleConnectError = (error: Error) => {
      updateConnectionState();
      if (onError) onError(error);
    };

    websocketService.on('connect', handleConnect);
    websocketService.on('disconnect', handleDisconnect);
    websocketService.on('connect_error', handleConnectError);

    return () => {
      websocketService.off('connect', handleConnect);
      websocketService.off('disconnect', handleDisconnect);
      websocketService.off('connect_error', handleConnectError);
    };
  }, [updateConnectionState, onConnect, onDisconnect, onError]);

  // Set user ID and admin status
  useEffect(() => {
    if (userId) {
      websocketService.setUserId(userId);
    }
    if (isAdmin) {
      websocketService.setAdmin(isAdmin);
    }
  }, [userId, isAdmin]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // Clean up event listeners on unmount
      eventListenersRef.current.forEach((listener, event) => {
        websocketService.off(event, listener);
      });
      eventListenersRef.current.clear();
    };
  }, [autoConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Note: We don't disconnect here as the service might be used by other components
      // The service will handle its own cleanup when the app unmounts
    };
  }, []);

  return {
    connectionState,
    connect,
    disconnect,
    emit,
    on,
    off,
    isConnected: connectionState.connected,
    isConnecting: connectionState.connecting,
    isReconnecting: connectionState.reconnecting
  };
};

export default useWebSocket;