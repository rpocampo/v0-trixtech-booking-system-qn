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
  metadata?: any;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
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
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const filteredNotifications = (notifications || []).filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true;
  });

  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Notifications</h1>
          <p className="text-[var(--muted)]">Manage system notifications and alerts</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn-primary"
          >
            Mark All as Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'All', count: (notifications || []).length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'read', label: 'Read', count: (notifications || []).filter(n => n.isRead).length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === key
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <div
              key={notification._id}
              className={`card-elevated p-6 border-l-4 transition-all duration-200 ${
                !notification.isRead
                  ? 'border-l-[var(--primary)] bg-[var(--primary-50)]'
                  : 'border-l-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={`text-lg font-semibold ${
                      !notification.isRead ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'
                    }`}>
                      {notification.title}
                    </h3>
                    {!notification.isRead && (
                      <span className="bg-[var(--primary)] text-white text-xs px-2 py-1 rounded-full font-medium">
                        New
                      </span>
                    )}
                  </div>

                  <p className="text-[var(--muted)] mb-3">{notification.message}</p>

                  <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      notification.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      notification.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {notification.priority.toUpperCase()}
                    </span>

                    <span>{notification.type}</span>

                    <span>{new Date(notification.createdAt).toLocaleString()}</span>

                    {notification.metadata && (
                      <div className="flex gap-2">
                        {notification.metadata.bookingId && (
                          <Link
                            href={`/admin/bookings`}
                            className="text-[var(--primary)] hover:underline"
                          >
                            View Booking
                          </Link>
                        )}
                        {notification.metadata.serviceId && (
                          <Link
                            href={`/admin/services`}
                            className="text-[var(--primary)] hover:underline"
                          >
                            View Service
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!notification.isRead && (
                  <button
                    onClick={() => markAsRead(notification._id)}
                    className="btn-secondary text-sm"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">🔔</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              {filter === 'unread' ? 'No unread notifications' :
               filter === 'read' ? 'No read notifications' :
               'No notifications yet'}
            </h3>
            <p className="text-[var(--muted)] mb-6">
              {filter === 'unread' ? 'All caught up! 🎉' :
               filter === 'read' ? 'Read notifications will appear here' :
               'System notifications will appear here when available'}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="btn-primary"
              >
                View All Notifications
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}