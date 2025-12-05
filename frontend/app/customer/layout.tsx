'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSocket } from '../../components/SocketProvider';
import { useUser } from '../../components/UserContext';
import CartIcon from '../../components/CartIcon';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { socket } = useSocket();
  const { user, setUser, isLoading: userLoading, logout } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'customer') {
      router.push('/login');
      return;
    }

    // Fetch user data if not already cached
    if (!user) {
      const fetchUser = async () => {
        try {
          const response = await fetch('http://localhost:5000/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.status === 401) {
            // Token expired or invalid, redirect to login
            logout();
            router.push('/login');
            return;
          }

          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            console.warn('User fetch returned success but no user data');
            setUser(null);
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      };

      fetchUser();
    }
  }, [router, user, setUser, logout]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) return;

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

    if (user) {
      fetchUnreadCount();

      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Real-time notification updates
  useEffect(() => {
    if (socket && user) {
      const handleNewNotification = (notification: any) => {
        console.log('New notification received:', notification);
        setUnreadNotifications(prev => prev + 1);
      };

      socket.on('notification', handleNewNotification);

      return () => {
        socket.off('notification', handleNewNotification);
      };
    }
  }, [socket, user]);

  if (userLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-theme="customer">
        {/* Navigation */}
        <nav className="bg-gradient-to-r from-[var(--nav-bg)] via-[var(--surface)] to-[var(--nav-bg)] border-b border-[var(--nav-border)] sticky top-0 z-50 shadow-xl backdrop-blur-md">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center">
            <Link href="/" className="flex items-center group hover:scale-105 transition-all duration-300">
              <div className="relative">
                <img
                  src="/logo.png"
                  alt="TRIXTECH"
                  className="h-8 sm:h-10 w-auto transition-transform group-hover:scale-110"
                />
                <div className="absolute -inset-2 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </div>
              <div className="ml-2 sm:ml-3">
                <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">TRIXTECH</span>
                <div className="text-xs text-[var(--nav-text-secondary)] font-medium -mt-1 hidden sm:block">Event Equipment Rental</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex flex-1 justify-center items-center gap-3">
              <Link
                href="/customer/dashboard"
                className={`group px-5 py-3 rounded-xl text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] transition-all duration-300 font-semibold hover:scale-105 ${pathname === '/customer/dashboard' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                  </svg>
                  My Dashboard
                </span>
              </Link>
              <Link
                href="/customer/services"
                className={`group px-5 py-3 rounded-xl text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] transition-all duration-300 font-semibold hover:scale-105 ${pathname === '/customer/services' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Browse Equipment
                </span>
              </Link>
              <Link
                href="/customer/suggestions"
                className={`group px-5 py-3 rounded-xl text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] transition-all duration-300 font-semibold hover:scale-105 ${pathname === '/customer/suggestions' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Smart Suggestions
                </span>
              </Link>
              <Link
                href="/customer/notifications"
                className={`group relative px-5 py-3 rounded-xl text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] transition-all duration-300 font-semibold hover:scale-105 ${pathname === '/customer/notifications' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-lg' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 012 21h13.78a3 3 0 002.553-1.658c.69-1.396.69-3.132 0-4.528A17.925 17.925 0 0112.078 5c-1.944 0-3.814.482-5.526 1.355-.86.43-1.538 1.236-1.73 2.151-.228.966.234 1.944 1.099 2.51z" />
                  </svg>
                  Notifications
                </span>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-[var(--accent)] to-red-500 text-white text-xs font-bold rounded-full min-w-[1.5rem] h-6 flex items-center justify-center px-2 shadow-lg animate-pulse">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
            </div>

            {/* Right side items */}
            <div className="flex items-center gap-3">
              <CartIcon />

              {/* User Menu Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl border border-[var(--nav-border)] text-[var(--nav-text)] hover:bg-[var(--nav-hover)] transition-all duration-200 hover:shadow-md"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="text-sm font-semibold text-[var(--nav-text)]">{user?.name?.split(' ')[0] || 'User'}</div>
                    <div className="text-xs text-[var(--nav-text-secondary)]">Customer</div>
                  </div>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-3 w-72 bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] z-50 backdrop-blur-md">
                    <div className="p-5 border-b border-[var(--border)]">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-lg">
                          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[var(--foreground)] truncate text-lg">{user?.name}</p>
                          <p className="text-sm text-[var(--muted)] truncate">{user?.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-2 h-2 bg-[var(--success)] rounded-full"></div>
                            <span className="text-xs text-[var(--success)] font-medium">Active Customer</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="py-3">
                      <Link
                        href="/customer/profile"
                        className="flex items-center gap-4 px-5 py-4 text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] transition-all duration-200 rounded-lg mx-2"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">Profile Settings</span>
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          router.push('/');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-4 px-5 py-4 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 rounded-lg mx-2"
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-medium">Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-3">
            <CartIcon />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-3 rounded-xl border border-[var(--nav-border)] text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] transition-all duration-200 shadow-sm"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-[var(--nav-bg)] border-t border-[var(--nav-border)] shadow-2xl">
            <div className="px-6 py-6 space-y-2">
              {/* User Info */}
              {user && (
                <div className="flex items-center gap-4 p-4 mb-6 bg-gradient-to-r from-[var(--primary)]/5 to-[var(--accent)]/5 rounded-2xl border border-[var(--border)]">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-semibold shadow-lg">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--nav-text)] text-base">{user?.name}</p>
                    <p className="text-sm text-[var(--nav-text-secondary)]">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-[var(--success)] rounded-full"></div>
                      <span className="text-xs text-[var(--success)] font-medium">Active Customer</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <Link
                href="/customer/dashboard"
                className={`flex items-center gap-4 px-4 py-4 text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] rounded-xl transition-all duration-200 font-medium ${pathname === '/customer/dashboard' ? 'bg-[var(--nav-active)] text-[var(--primary)] border-l-4 border-[var(--primary)]' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                </svg>
                My Dashboard
              </Link>
              <Link
                href="/customer/services"
                className={`flex items-center gap-4 px-4 py-4 text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] rounded-xl transition-all duration-200 font-medium ${pathname === '/customer/services' ? 'bg-[var(--nav-active)] text-[var(--primary)] border-l-4 border-[var(--primary)]' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Browse Equipment
              </Link>
              <Link
                href="/customer/suggestions"
                className={`flex items-center gap-4 px-4 py-4 text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] rounded-xl transition-all duration-200 font-medium ${pathname === '/customer/suggestions' ? 'bg-[var(--nav-active)] text-[var(--primary)] border-l-4 border-[var(--primary)]' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Smart Suggestions
              </Link>
              <Link
                href="/customer/notifications"
                className={`relative flex items-center gap-4 px-4 py-4 text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] rounded-xl transition-all duration-200 font-medium ${pathname === '/customer/notifications' ? 'bg-[var(--nav-active)] text-[var(--primary)] border-l-4 border-[var(--primary)]' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 012 21h13.78a3 3 0 002.553-1.658c.69-1.396.69-3.132 0-4.528A17.925 17.925 0 0112.078 5c-1.944 0-3.814.482-5.526 1.355-.86.43-1.538 1.236-1.73 2.151-.228.966.234 1.944 1.099 2.51z" />
                </svg>
                Notifications
                {unreadNotifications > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-[var(--accent)] to-red-500 text-white text-xs font-bold rounded-full min-w-[1.5rem] h-6 flex items-center justify-center px-2 shadow-lg animate-pulse">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>

              <div className="border-t border-[var(--nav-border)] my-4"></div>

              <Link
                href="/customer/profile"
                className="flex items-center gap-4 px-4 py-4 text-[var(--nav-text)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] rounded-xl transition-all duration-200 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile Settings
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 px-4 py-4 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full bg-gradient-to-br from-[var(--background)] via-[var(--surface-secondary)] to-[var(--background)] min-h-screen">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-12 mt-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/5 to-[var(--accent)]/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="lg:col-span-2">
              <div className="flex items-center mb-4">
                <img
                  src="/logo.png"
                  alt="TRIXTECH"
                  className="h-8 w-auto mr-3"
                />
                <h3 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
                  TRIXTECH
                </h3>
              </div>
              <p className="text-slate-300 mb-6 max-w-md leading-relaxed">
                ✨ Your trusted partner for exceptional event experiences. We provide high-quality equipment
                rental services for all your special occasions with love and care.
              </p>
              <div className="flex gap-4">
                <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full p-3 hover:scale-110 transition-transform cursor-pointer">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </div>
                <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] rounded-full p-3 hover:scale-110 transition-transform cursor-pointer">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.749.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.747-1.378 0 0-.599 2.282-.744 2.84-.282 1.084-1.064 2.456-1.549 3.235C9.584 23.815 10.77 24.001 12.017 24.001c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001.012.017z"/>
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-white text-lg">Explore</h4>
              <ul className="space-y-3 text-slate-300">
                <li><Link href="/customer/services" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2">🎪 Browse Equipment</Link></li>
                <li><Link href="/customer/suggestions" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2">💡 Smart Suggestions</Link></li>
                <li><Link href="/customer/profile" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2">👤 My Profile</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-white text-lg">Get Help</h4>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  09127607860
                </li>
                <li><button onClick={() => setShowPrivacyPolicy(true)} className="hover:text-[var(--accent)] transition-colors flex items-center gap-2">🔒 Privacy Policy</button></li>
                <li className="text-sm opacity-75">Available 24/7 for your events! 🎉</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-8 text-center">
            <p className="text-slate-400 text-sm mb-2">
              Made with ❤️ for unforgettable moments
            </p>
            <p className="text-slate-500 text-xs">
              &copy; 2025 TRIXTECH. All rights reserved. | Bringing joy to every celebration ✨
            </p>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
                <button
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="text-sm text-gray-700 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h3>
                  <p className="mb-4">TrixTech collects information necessary for booking, managing reservations, and improving user experience.</p>

                  <h4 className="font-semibold text-gray-900 mb-2">1.1 Personal Information</h4>
                  <p className="mb-2">When creating an account or making a reservation, we may collect:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Full Name</li>
                    <li>Email Address</li>
                    <li>Contact Number</li>
                    <li>Event Details (date, time, location)</li>
                    <li>Payment Information</li>
                  </ul>

                  <h4 className="font-semibold text-gray-900 mb-2">1.2 Booking & Transaction Data</h4>
                  <p className="mb-2">To support inventory and scheduling management, we collect:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Selected event packages or supplies</li>
                    <li>Quantity & availability requests</li>
                    <li>Booking history & status</li>
                    <li>Customer preferences for event themes or setups</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h3>
                  <p className="mb-4">TrixTech uses your information for the following purposes:</p>

                  <h4 className="font-semibold text-gray-900 mb-2">2.1 Booking & Reservation Management</h4>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Processing and confirming reservations</li>
                    <li>Checking availability of supplies and event packages</li>
                    <li>Preventing booking conflicts and overbooking</li>
                  </ul>

                  <h4 className="font-semibold text-gray-900 mb-2">2.2 Communication</h4>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Sending booking confirmations and reminders</li>
                    <li>Contacting you for event details or schedule changes</li>
                    <li>Responding to inquiries and customer support concerns</li>
                  </ul>

                  <h4 className="font-semibold text-gray-900 mb-2">2.3 System Features & Improvements</h4>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Enhancing system performance and functionality</li>
                    <li>Generating reports for administrative use</li>
                    <li>Supporting the event recommender feature based on past bookings and preferences</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3. How We Protect Your Information</h3>
                  <p className="mb-4">We implement safeguards to ensure your information remains secure:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Password-protected accounts</li>
                    <li>Restricted access to administrative data</li>
                    <li>Regular security checks and backups</li>
                  </ul>
                  <p>Despite these measures, no system is 100% secure. We advise users to protect their login credentials.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Data Sharing & Disclosure</h3>
                  <p className="mb-4">TrixTech does not sell, rent, or trade your personal information.</p>
                  <p className="mb-2">We may share information only under these conditions:</p>

                  <h4 className="font-semibold text-gray-900 mb-2">4.1 Service Operations</h4>
                  <p className="mb-2">With authorized personnel responsible for:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Booking management</li>
                    <li>Inventory handling</li>
                    <li>Customer communication</li>
                  </ul>

                  <h4 className="font-semibold text-gray-900 mb-2">4.2 Legal Requirements</h4>
                  <p className="mb-2">We may disclose information when required to:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Comply with law enforcement</li>
                    <li>Protect the rights, property, or safety of the system or its users</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">5. Data Retention</h3>
                  <p className="mb-4">TrixTech stores your personal data only for as long as necessary to:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Complete your bookings</li>
                    <li>Maintain accurate records</li>
                    <li>Improve services</li>
                  </ul>
                  <p>You may request deletion of your data at any time (see Section 7).</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">6. Cookies & Tracking Technologies</h3>
                  <p className="mb-4">TrixTech may use cookies to:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>Maintain sessions</li>
                    <li>Improve navigation</li>
                    <li>Analyze system usage</li>
                  </ul>
                  <p>You may disable cookies through your browser settings, but some features may not work properly.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">7. Children's Privacy</h3>
                  <p className="mb-4">TrixTech is not intended for users under 18 years old.</p>
                  <p>We do not knowingly collect personal information from minors.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to This Privacy Policy</h3>
                  <p className="mb-4">TrixTech may update this Privacy Policy as needed.</p>
                  <p className="mb-2">We will notify users of major changes through:</p>
                  <ul className="list-disc list-inside mb-4 ml-4">
                    <li>System announcements, or</li>
                    <li>Updated "Last Updated" date</li>
                  </ul>
                  <p>Continued use of the system means acceptance of the updated policy.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">9. Contact Information</h3>
                  <p>For questions or concerns about this Privacy Policy, contact us at:</p>
                  <p className="font-semibold">(+63)912-760-7860</p>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
