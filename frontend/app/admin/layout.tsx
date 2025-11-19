'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSocket } from '../../components/SocketProvider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { socket } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'admin') {
      router.push('/login');
      return;
    }

    setIsLoading(false);
  }, [router]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('http://localhost:5000/api/notifications/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          // Token expired, don't log as error
          return;
        }

        const data = await response.json();
        if (data.success) {
          setUnreadNotifications(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    if (!isLoading) {
      fetchUnreadCount();

      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Real-time notification updates
  useEffect(() => {
    if (socket && !isLoading) {
      const handleNewNotification = (notification: any) => {
        console.log('New admin notification received:', notification);
        setUnreadNotifications(prev => prev + 1);
      };

      const handleAdminNotification = (notification: any) => {
        console.log('New admin-specific notification received:', notification);
        setUnreadNotifications(prev => prev + 1);
      };

      const handleNewBooking = (data: any) => {
        console.log('New booking notification for admin:', data);
        setUnreadNotifications(prev => prev + 1);
      };

      socket.on('notification', handleNewNotification);
      socket.on('admin-notification', handleAdminNotification);
      socket.on('new-booking', handleNewBooking);

      return () => {
        socket.off('notification', handleNewNotification);
        socket.off('admin-notification', handleAdminNotification);
        socket.off('new-booking', handleNewBooking);
      };
    }
  }, [socket, isLoading]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-[var(--foreground)] text-white p-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          TRIXTECH Admin
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md hover:bg-[var(--primary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[var(--foreground)] text-white border-t border-gray-700">
          <nav className="px-4 py-2 space-y-2">
            <Link
              href="/admin/dashboard"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/services"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href="/admin/bookings"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Bookings
            </Link>
            <Link
              href="/admin/customers"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Customers
            </Link>
            <Link
              href="/admin/reports"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Reports
            </Link>
            <Link
              href="/admin/notifications"
              className="relative block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Notifications
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-pulse shadow-lg">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/');
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden md:block bg-[var(--foreground)] text-white sticky top-0 h-screen overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && (
              <Link href="/" className="text-2xl font-bold">
                TRIXTECH Admin
              </Link>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 rounded hover:bg-[var(--primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
                </svg>
              </button>
            </div>
          </div>

          <nav className="space-y-4">
            <Link href="/admin/dashboard" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '🏠' : 'Dashboard'}
            </Link>
            <Link href="/admin/services" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '⚙️' : 'Services'}
            </Link>
            <Link href="/admin/bookings" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '📅' : 'Bookings'}
            </Link>
            <Link href="/admin/customers" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '👥' : 'Customers'}
            </Link>
            <Link href="/admin/reports" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '📊' : 'Reports'}
            </Link>
            <Link href="/admin/notifications" className={`relative block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '🔔' : 'Notifications'}
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-pulse shadow-lg">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/');
              }}
              className={`w-full text-left px-4 py-2 rounded hover:bg-red-600 transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}
            >
              {isSidebarCollapsed ? '🚪' : 'Logout'}
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
