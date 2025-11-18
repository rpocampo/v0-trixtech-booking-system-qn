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
    // Create socket connection
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);

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
          console.error('Error parsing token:', error);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
}