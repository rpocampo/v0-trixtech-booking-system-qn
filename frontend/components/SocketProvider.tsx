'use client';

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export default function SocketProvider({ children }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create socket connection with enhanced options
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected successfully');
      // Join user room if logged in
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');

      if (token && role) {
        // Extract user ID from token (simplified - in production use proper JWT decoding)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userId = payload.id;

          socket.emit('join', userId);

          if (role === 'admin') {
            socket.emit('join-admin');
          }
        } catch (error) {
          console.error('Token parsing failed:', error);
          // Token parsing failed, continue without joining room
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection failed:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed permanently');
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
}