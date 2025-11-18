'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    bookingId?: string;
    serviceId?: string;
    actionUrl?: string;
  };
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
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

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-12 w-96 max-h-96 bg-white border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface-secondary)]">
        <h3 className="font-semibold text-[var(--foreground)]">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="bg-[var(--primary)] text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
          <button
            onClick={markAllAsRead}
            className="text-sm text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors"
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[var(--muted)]">
            <div className="animate-pulse">Loading...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            <div className="text-4xl mb-2">🔔</div>
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              className={`p-4 border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer ${
                !notification.isRead ? getPriorityColor(notification.priority) : ''
              }`}
              onClick={() => !notification.isRead && markAsRead(notification._id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium text-sm ${!notification.isRead ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                      {notification.title}
                    </h4>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-[var(--primary)] rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted)] mb-2 line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-light)]">
                      {formatTime(notification.createdAt)}
                    </span>
                    {notification.metadata?.actionUrl && (
                      <Link
                        href={notification.metadata.actionUrl}
                        className="text-xs text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]">
          <Link
            href="/customer/notifications"
            className="text-sm text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium block text-center"
            onClick={onClose}
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}