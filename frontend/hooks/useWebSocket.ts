import { useEffect, useRef } from 'react';
import { websocketService, WebSocketMessage } from '../utils/websocketService';

export const useWebSocket = (url?: string) => {
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (url && !isConnectedRef.current) {
      websocketService.connect(url);
      isConnectedRef.current = true;
    }

    return () => {
      // Cleanup if needed
    };
  }, [url]);

  const sendMessage = (message: WebSocketMessage) => {
    websocketService.send(message);
  };

  const subscribe = (event: string, callback: (data: any) => void) => {
    websocketService.on(event, callback);

    // Return unsubscribe function
    return () => {
      websocketService.off(event, callback);
    };
  };

  return {
    sendMessage,
    subscribe,
    disconnect: () => websocketService.disconnect(),
  };
};