'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSocket } from '../../components/SocketProvider';
import { useUser } from '../../components/UserContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { socket } = useSocket();
  const { logout } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);

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

  // Fetch active users count
  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health/active-users');
        const data = await response.json();
        setActiveUsers(data.count);
      } catch (error) {
        console.error('Failed to fetch active users:', error);
      }
    };

    if (!isLoading) {
      fetchActiveUsers();
      // Poll every 30 seconds
      const interval = setInterval(fetchActiveUsers, 30000);
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
    <div className="min-h-screen flex flex-col md:flex-row" data-theme="admin">
      {/* Mobile Header */}
      <div className="md:hidden bg-[var(--foreground)] text-white p-3 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="TRIXTECH"
            className="h-6 w-auto mr-2"
          />
          <span className="text-sm font-bold text-blue-600 mr-2">TRIXTECH</span>
          <span className="text-sm font-bold">Admin</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--primary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] border-t border-[var(--sidebar-border)]">
          <nav className="px-4 py-3 space-y-1">
            <Link
              href="/admin/dashboard"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/dashboard' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/admin/bookings"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/bookings' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Reservations
            </Link>
            <Link
              href="/admin/inventory"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/inventory' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Inventory
            </Link>
            <Link
              href="/admin/services"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/services' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Equipment
            </Link>
            <Link
              href="/admin/customers"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/customers' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Customers
            </Link>
            <Link
              href="/admin/notifications"
              className={`relative flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/notifications' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 012 21h13.78a3 3 0 002.553-1.658c.69-1.396.69-3.132 0-4.528A17.925 17.925 0 0112.078 5c-1.944 0-3.814.482-5.526 1.355-.86.43-1.538 1.236-1.73 2.151-.228.966.234 1.944 1.099 2.51z" />
              </svg>
              Notifications
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
            <Link
              href="/admin/payments"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/payments' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Payments
            </Link>
            <Link
              href="/admin/reports"
              className={`flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors ${pathname === '/admin/reports' ? 'bg-[var(--sidebar-active)] text-white' : 'text-[var(--sidebar-text-secondary)]'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports
            </Link>
            <div className="pt-2 border-t border-[var(--sidebar-border)]">
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-300 hover:bg-red-600 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden md:block bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] sticky top-0 h-screen overflow-y-auto transition-all duration-300 shadow-2xl border-r border-[var(--sidebar-border)] ${isSidebarCollapsed ? 'w-16' : 'w-80'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-12">
            {!isSidebarCollapsed && (
              <Link href="/" className="flex items-center group">
                <div className="relative">
                  <img
                    src="/logo.png"
                    alt="TRIXTECH"
                    className="h-10 w-auto transition-transform group-hover:scale-105"
                  />
                  <div className="absolute -inset-2 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                </div>
                <div className="ml-4">
                  <span className="text-3xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">TRIXTECH</span>
                  <div className="text-xs text-[var(--sidebar-text-secondary)] font-medium tracking-widest uppercase">Admin Control</div>
                </div>
              </Link>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-3 rounded-xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 hover:scale-105"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
              </svg>
            </button>
          </div>

          <nav className="space-y-3">
            {/* Main Dashboard Links */}
            <div className="space-y-2">
              <Link href="/admin/dashboard" className={`group flex items-center gap-4 px-5 py-5 rounded-2xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 hover:scale-[1.02] ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/dashboard' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-xl shadow-[var(--primary)]/25' : 'text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)]'}`}>
                <div className={`p-3 rounded-xl ${pathname === '/admin/dashboard' ? 'bg-white/20' : 'bg-[var(--sidebar-hover)] group-hover:bg-[var(--sidebar-active)]'} transition-all duration-200`}>
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span className="font-semibold tracking-wide text-lg">Analytics Dashboard</span>}
              </Link>
              <Link href="/admin/bookings" className={`group flex items-center gap-4 px-5 py-5 rounded-2xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 hover:scale-[1.02] ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/bookings' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-xl shadow-[var(--primary)]/25' : 'text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)]'}`}>
                <div className={`p-3 rounded-xl ${pathname === '/admin/bookings' ? 'bg-white/20' : 'bg-[var(--sidebar-hover)] group-hover:bg-[var(--sidebar-active)]'} transition-all duration-200`}>
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span className="font-semibold tracking-wide text-lg">Reservation Management</span>}
              </Link>
              <Link href="/admin/inventory" className={`group flex items-center gap-4 px-5 py-5 rounded-2xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 hover:scale-[1.02] ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/inventory' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-xl shadow-[var(--primary)]/25' : 'text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)]'}`}>
                <div className={`p-3 rounded-xl ${pathname === '/admin/inventory' ? 'bg-white/20' : 'bg-[var(--sidebar-hover)] group-hover:bg-[var(--sidebar-active)]'} transition-all duration-200`}>
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span className="font-semibold tracking-wide text-lg">Inventory Control</span>}
              </Link>
              <Link href="/admin/services" className={`group flex items-center gap-4 px-5 py-5 rounded-2xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 hover:scale-[1.02] ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/services' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-xl shadow-[var(--primary)]/25' : 'text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text)]'}`}>
                <div className={`p-3 rounded-xl ${pathname === '/admin/services' ? 'bg-white/20' : 'bg-[var(--sidebar-hover)] group-hover:bg-[var(--sidebar-active)]'} transition-all duration-200`}>
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span className="font-semibold tracking-wide text-lg">Equipment Settings</span>}
              </Link>
            </div>

            {/* Secondary Links */}
            {!isSidebarCollapsed && <div className="border-t border-[var(--sidebar-border)] pt-6 mt-6">
              <div className="text-xs font-semibold text-[var(--sidebar-text-secondary)] uppercase tracking-wider mb-4">Management</div>
            </div>}
            <div className="space-y-2">
              <Link href="/admin/customers" className={`flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/customers' ? 'bg-[var(--sidebar-active)] text-white border-r-4 border-[var(--primary)]' : 'text-[var(--sidebar-text-secondary)]'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                {!isSidebarCollapsed && <span className="font-medium">Customers</span>}
              </Link>
              <Link href="/admin/notifications" className={`relative flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/notifications' ? 'bg-[var(--sidebar-active)] text-white border-r-4 border-[var(--primary)]' : 'text-[var(--sidebar-text-secondary)]'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 012 21h13.78a3 3 0 002.553-1.658c.69-1.396.69-3.132 0-4.528A17.925 17.925 0 0112.078 5c-1.944 0-3.814.482-5.526 1.355-.86.43-1.538 1.236-1.73 2.151-.228.966.234 1.944 1.099 2.51z" />
                </svg>
                {!isSidebarCollapsed && <span className="font-medium">Notifications</span>}
                {unreadNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.5rem] h-6 flex items-center justify-center px-2 shadow-lg animate-pulse">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
              <Link href="/admin/payments" className={`flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/payments' ? 'bg-[var(--sidebar-active)] text-white border-r-4 border-[var(--primary)]' : 'text-[var(--sidebar-text-secondary)]'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {!isSidebarCollapsed && <span className="font-medium">Payments</span>}
              </Link>
              <Link href="/admin/reports" className={`flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-[var(--sidebar-hover)] transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${pathname === '/admin/reports' ? 'bg-[var(--sidebar-active)] text-white border-r-4 border-[var(--primary)]' : 'text-[var(--sidebar-text-secondary)]'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {!isSidebarCollapsed && <span className="font-medium">Reports</span>}
              </Link>
            </div>

            {/* Logout */}
            <div className="pt-6 border-t border-[var(--sidebar-border)] mt-6">
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-red-300 hover:bg-red-600 hover:text-white transition-all duration-200 ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {!isSidebarCollapsed && <span className="font-medium">Logout</span>}
              </button>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gradient-to-br from-[var(--background)] via-[var(--background-secondary)] to-[var(--surface-secondary)] min-h-screen">
        <div className="p-8 md:p-10 max-w-full">
          {/* Professional Dashboard Header */}
          <div className="mb-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-[var(--foreground)] mb-3 tracking-tight">Admin Control Center</h1>
                <p className="text-[var(--foreground-secondary)] text-xl leading-relaxed max-w-2xl">
                  Comprehensive analytics and management tools for your event equipment business operations
                </p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="bg-[var(--primary)]/10 text-[var(--primary)] px-4 py-2 rounded-full text-sm font-semibold border border-[var(--primary)]/20">
                    📊 Real-time Analytics
                  </div>
                  <div className="bg-[var(--accent)]/10 text-[var(--accent)] px-4 py-2 rounded-full text-sm font-semibold border border-[var(--accent)]/20">
                    ⚡ Smart Automation
                  </div>
                  <div className="bg-[var(--success)]/10 text-[var(--success)] px-4 py-2 rounded-full text-sm font-semibold border border-[var(--success)]/20">
                    🎯 Performance Insights
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-xl border border-[var(--border)] backdrop-blur-sm">
                  <div className="text-sm text-[var(--muted)] font-semibold uppercase tracking-wider mb-2">System Status</div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[var(--success)] rounded-full animate-pulse shadow-lg shadow-[var(--success)]/50"></div>
                    <span className="text-[var(--foreground)] font-bold text-lg">Operational</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-2">All systems running smoothly</div>
                </div>
                <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-xl border border-[var(--border)] backdrop-blur-sm">
                  <div className="text-sm text-[var(--muted)] font-semibold uppercase tracking-wider mb-2">Active Sessions</div>
                  <div className="text-2xl font-bold text-[var(--primary)]">{activeUsers}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">Users online now</div>
                </div>
              </div>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
