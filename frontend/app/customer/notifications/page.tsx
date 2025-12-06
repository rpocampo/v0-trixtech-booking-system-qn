'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '../../../components/SocketProvider';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  metadata?: {
    bookingId?: string;
    serviceId?: string;
    actionUrl?: string;
  };
}

export default function NotificationsPage() {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [filter, currentPage]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notificationData: any) => {
      console.log('New notification received:', notificationData);

      // Create a notification object from the socket data
      const newNotification: Notification = {
        _id: `temp_${Date.now()}`, // Temporary ID for real-time notifications
        title: notificationData.title || 'New Notification',
        message: notificationData.message || 'You have a new notification',
        type: notificationData.type || 'system',
        priority: notificationData.priority || 'medium',
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: notificationData.metadata || {},
      };

      setNotifications(prev => [newNotification, ...prev]);

      // Refresh the notifications from server to get persisted ones
      setTimeout(() => {
        fetchNotifications();
      }, 1000);
    };

    // Listen for booking-related events that should trigger notifications
    socket.on('booking-created', (data) => {
      handleNewNotification({
        title: 'Booking Confirmed',
        message: `Your booking for ${data.serviceName} has been confirmed.`,
        type: 'booking',
        priority: 'medium',
        metadata: {
          bookingId: data.id,
          serviceId: data.serviceId,
        },
      });
    });

    socket.on('booking-updated', (data) => {
      handleNewNotification({
        title: 'Booking Updated',
        message: `Your booking status has been updated.`,
        type: 'booking',
        priority: 'medium',
        metadata: {
          bookingId: data.id,
        },
      });
    });

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('booking-created', handleNewNotification);
      socket.off('booking-updated', handleNewNotification);
      socket.off('notification', handleNewNotification);
    };
  }, [socket]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        limit: '20',
        offset: ((currentPage - 1) * 20).toString(),
        ...(filter === 'unread' && { unreadOnly: 'true' }),
      });

      const response = await fetch(`http://localhost:5000/api/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        // Token expired or invalid, don't log as error
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        if (currentPage === 1) {
          setNotifications(data.notifications);
        } else {
          setNotifications(prev => [...prev, ...data.notifications]);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
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
          notif._id === notificationId ? { ...notif, isRead: true, readAt: new Date().toISOString() } : notif
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

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
      );
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'booking': return '📅';
      case 'inventory': return '📦';
      case 'admin': return '⚙️';
      case 'system': return '🔔';
      default: return '📢';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredNotifications = (notifications || []).filter(notif => {
    if (filter === 'unread') return !notif.isRead;
    if (filter === 'read') return notif.isRead;
    return true;
  });

  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Notifications</h1>
          <p className="text-[var(--muted)] mt-2">Stay updated with your reservations and account activity</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn-secondary"
          >
            Mark All as Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--surface-secondary)] rounded-xl">
        {[
          { key: 'all', label: 'All', count: (notifications || []).length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'read', label: 'Read', count: (notifications || []).filter(n => n.isRead).length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key as any);
              setCurrentPage(1);
              setNotifications([]);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              filter === key
                ? 'bg-white text-[var(--primary)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/50'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {loading && currentPage === 1 ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-[var(--muted)]">Loading notifications...</div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-[var(--muted)]">
              {filter === 'unread'
                ? 'You\'re all caught up!'
                : 'Notifications about your bookings and account will appear here.'
              }
            </p>
          </div>
        ) : (
          <>
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`notification-card p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  !notification.isRead ? 'ring-2 ring-[var(--primary)] ring-opacity-20' : ''
                }`}
                onClick={() => !notification.isRead && markAsRead(notification._id)}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl flex-shrink-0">
                    {getTypeIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className={`font-semibold text-lg mb-2 ${
                          !notification.isRead ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                        }`}>
                          {notification.title}
                        </h3>
                        <p className="text-[var(--muted)] mb-3 leading-relaxed">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-[var(--muted-light)]">
                          <span>{formatDate(notification.createdAt)}</span>
                          {notification.readAt && (
                            <span>Read {formatDate(notification.readAt)}</span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            notification.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {notification.priority}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                          <div className="w-3 h-3 bg-[var(--primary)] rounded-full animate-pulse"></div>
                        )}

                        {notification.metadata?.actionUrl && (
                          <Link
                            href={notification.metadata.actionUrl}
                            className="btn-outline text-sm px-3 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-6">
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="btn-secondary"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Stats */}
      {(notifications || []).length > 0 && (
        <div className="mt-12 p-6 bg-gradient-to-r from-[var(--primary-50)] to-[var(--accent)]/10 rounded-xl">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">Notification Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--primary)]">{(notifications || []).length}</div>
              <div className="text-sm text-[var(--muted)]">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--success)]">{unreadCount}</div>
              <div className="text-sm text-[var(--muted)]">Unread</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--warning)]">
                {(notifications || []).filter(n => n.type === 'booking').length}
              </div>
              <div className="text-sm text-[var(--muted)]">Bookings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">
                {(notifications || []).filter(n => n.type === 'system').length}
              </div>
              <div className="text-sm text-[var(--muted)]">System</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}