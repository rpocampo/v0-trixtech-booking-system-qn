'use client';

import { useEffect, useState } from 'react';
import NotificationPanel from './NotificationPanel';

interface NotificationBellProps {
  variant?: 'light' | 'dark';
  position?: 'default' | 'sidebar';
}

export default function NotificationBell({ variant = 'light', position = 'default' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:5000/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={togglePanel}
        className={`relative p-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-30 ${
          variant === 'dark'
            ? 'text-white hover:text-[var(--primary)] hover:bg-[var(--primary-20)] focus:ring-[var(--primary)]'
            : 'text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] focus:ring-[var(--primary)]'
        }`}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <svg
          className="w-7 h-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-5 5v-5zM15 17H9a6 6 0 01-6-6V9a6 6 0 0110.29-4.12L15 9v8z"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-pulse shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        position={position}
      />
    </div>
  );
}