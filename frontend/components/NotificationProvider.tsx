'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSocket } from './SocketProvider';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
}

interface NotificationContextType {
  notifications: NotificationData[];
  showNotification: (notification: NotificationData) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const showNotification = (notification: NotificationData) => {
    const id = notification.id || `notif_${Date.now()}`;
    const newNotification = { ...notification, id };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-dismiss after 5 seconds for non-urgent notifications
    if (notification.priority !== 'urgent') {
      setTimeout(() => {
        dismissNotification(id);
      }, 5000);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleBookingCreated = (data: any) => {
      showNotification({
        id: `booking_${Date.now()}`,
        title: 'Booking Confirmed! 🎉',
        message: `Your booking for ${data.serviceName} has been confirmed.`,
        type: 'booking',
        priority: 'medium',
      });
    };

    const handleBookingUpdated = (data: any) => {
      showNotification({
        id: `update_${Date.now()}`,
        title: 'Booking Updated',
        message: 'Your booking status has been updated.',
        type: 'booking',
        priority: 'medium',
      });
    };

    const handleNewBooking = (data: any) => {
      // Only show to admins
      const role = localStorage.getItem('role');
      if (role === 'admin') {
        showNotification({
          id: `admin_booking_${Date.now()}`,
          title: 'New Booking Received 📋',
          message: `New booking for ${data.serviceName} from customer.`,
          type: 'admin',
          priority: 'high',
        });
      }
    };

    const handleNewPendingBooking = (data: any) => {
      // Only show to admins
      const role = localStorage.getItem('role');
      if (role === 'admin') {
        showNotification({
          id: `admin_pending_booking_${Date.now()}`,
          title: 'New Pending Booking ⏳',
          message: `New booking for ${data.serviceName} is pending payment.`,
          type: 'admin',
          priority: 'medium',
        });
      }
    };

    socket.on('booking-created', handleBookingCreated);
    socket.on('booking-updated', handleBookingUpdated);
    socket.on('new-booking', handleNewBooking);
    socket.on('new-pending-booking', handleNewPendingBooking);

    return () => {
      socket.off('booking-created', handleBookingCreated);
      socket.off('booking-updated', handleBookingUpdated);
      socket.off('new-booking', handleNewBooking);
      socket.off('new-pending-booking', handleNewPendingBooking);
    };
  }, [socket]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      showNotification,
      dismissNotification,
      clearAll,
    }}>
      {children}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`max-w-sm p-4 rounded-lg shadow-lg border-l-4 ${
              notification.priority === 'urgent' ? 'bg-red-50 border-red-500' :
              notification.priority === 'high' ? 'bg-orange-50 border-orange-500' :
              notification.priority === 'medium' ? 'bg-blue-50 border-blue-500' :
              'bg-gray-50 border-gray-500'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{notification.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
              </div>
              <button
                onClick={() => dismissNotification(notification.id)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}