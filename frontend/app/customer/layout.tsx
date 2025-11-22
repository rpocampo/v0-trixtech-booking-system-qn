'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSocket } from '../../components/SocketProvider';
import CartIcon from '../../components/CartIcon';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { socket } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'customer') {
      router.push('/login');
      return;
    }

    // Fetch user data
    const fetchUser = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          // Token expired or invalid, redirect to login
          localStorage.clear();
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]">
        {/* Navigation */}
        <nav className="bg-white/80 backdrop-blur-lg border-b border-[var(--border)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent hover:scale-105 transition-transform duration-200">
              TRIXTECH
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
            <Link
              href="/customer/dashboard"
              className="px-4 py-2 rounded-lg text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200 font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/customer/services"
              className="px-4 py-2 rounded-lg text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200 font-medium"
            >
              Services
            </Link>
            <Link
              href="/customer/bookings"
              className="px-4 py-2 rounded-lg text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200 font-medium"
            >
              Bookings
            </Link>
            <Link
              href="/customer/notifications"
              className="relative px-4 py-2 rounded-lg text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200 font-medium"
            >
              Notifications
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-pulse shadow-lg">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>

            <CartIcon />

            {/* User Menu Dropdown */}
            <div className="relative ml-2">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-sm font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <svg className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-[var(--border)] z-50 animate-slide-in">
                  <div className="p-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-semibold">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{user?.name}</p>
                        <p className="text-sm text-[var(--muted)]">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/customer/profile"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] transition-colors"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span>👤</span>
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        router.push('/');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--danger)] hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      <span>🚪</span>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <CartIcon />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200"
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
          <div className="md:hidden bg-white/95 backdrop-blur-lg border-t border-[var(--border)] animate-slide-in">
            <div className="px-4 py-4 space-y-1">
              {/* User Info */}
              {user && (
                <div className="flex items-center gap-3 p-3 mb-4 bg-gradient-to-r from-[var(--primary-50)] to-[var(--accent)]/10 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)] text-sm">{user?.name}</p>
                    <p className="text-xs text-[var(--muted)]">{user?.email}</p>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <Link
                href="/customer/dashboard"
                className="flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">🏠</span>
                Dashboard
              </Link>
              <Link
                href="/customer/services"
                className="flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">🎪</span>
                Services
              </Link>
              <Link
                href="/customer/bookings"
                className="flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">📅</span>
                Bookings
              </Link>
              <Link
                href="/customer/notifications"
                className="relative flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">🔔</span>
                Notifications
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-pulse shadow-lg">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>

              <div className="border-t border-[var(--border)] my-3"></div>

              <Link
                href="/customer/profile"
                className="flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">👤</span>
                Profile
              </Link>
              <button
                onClick={() => {
                  localStorage.clear();
                  router.push('/');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-[var(--danger)] hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                <span className="text-lg">🚪</span>
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[var(--foreground)] to-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent mb-4">
                TRIXTECH
              </h3>
              <p className="text-gray-300 mb-4 max-w-md">
                Your trusted partner for exceptional event experiences. From weddings to corporate gatherings,
                we make every moment unforgettable.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <span className="text-xl">📘</span>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <span className="text-xl">📷</span>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <span className="text-xl">🐦</span>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/customer/services" className="hover:text-white transition-colors">Services</Link></li>
                <li><Link href="/customer/bookings" className="hover:text-white transition-colors">My Bookings</Link></li>
                <li><Link href="/customer/profile" className="hover:text-white transition-colors">Profile</Link></li>
                <li><Link href="/customer/notifications" className="hover:text-white transition-colors">Notifications</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-gray-400">
              &copy; 2025 TRIXTECH. All rights reserved. Made with ❤️ for exceptional events.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
