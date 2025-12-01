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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]">
        {/* Navigation */}
        <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent hover:scale-105 transition-transform duration-200">
              TRIXTECH
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
            <Link
              href="/customer/dashboard"
              className={`px-6 py-3 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-lg transition-all duration-200 font-semibold text-base ${pathname === '/customer/dashboard' ? 'bg-blue-600 text-white shadow-lg border-b-2 border-blue-300' : ''}`}
            >
              🏠 Dashboard
            </Link>
            <Link
              href="/customer/bookings"
              className={`px-6 py-3 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-lg transition-all duration-200 font-semibold text-base ${pathname === '/customer/bookings' ? 'bg-blue-600 text-white shadow-lg border-b-2 border-blue-300' : ''}`}
            >
              📅 Bookings
            </Link>
            <Link
              href="/customer/services"
              className={`px-6 py-3 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-lg transition-all duration-200 font-semibold text-base ${pathname === '/customer/services' ? 'bg-blue-600 text-white shadow-lg border-b-2 border-blue-300' : ''}`}
            >
              🎪 Services
            </Link>
            <Link
              href="/customer/suggestions"
              className={`px-6 py-3 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-lg transition-all duration-200 font-semibold text-base ${pathname === '/customer/suggestions' ? 'bg-blue-600 text-white shadow-lg border-b-2 border-blue-300' : ''}`}
            >
              💡 Suggestions
            </Link>
            <Link
              href="/customer/notifications"
              className={`relative px-6 py-3 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-lg transition-all duration-200 font-semibold text-base ${pathname === '/customer/notifications' ? 'bg-blue-600 text-white shadow-lg border-b-2 border-blue-300' : ''}`}
            >
              🔔 Notifications
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-sm font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <svg className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[var(--border)] z-50 animate-slide-in">
                  <div className="p-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--foreground)] truncate">{user?.name}</p>
                        <p className="text-sm text-[var(--muted)] truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/customer/profile"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] transition-colors"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <span className="flex-shrink-0">👤</span>
                      <span className="truncate">Profile Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        router.push('/');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--danger)] hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      <span className="flex-shrink-0">🚪</span>
                      <span className="truncate">Logout</span>
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
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] transition-all duration-200"
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
                className={`flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200 ${pathname === '/customer/dashboard' ? 'bg-[var(--primary)] text-white' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">🏠</span>
                Dashboard
              </Link>
              <Link
                href="/customer/bookings"
                className={`flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200 ${pathname === '/customer/bookings' ? 'bg-[var(--primary)] text-white' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">📅</span>
                Bookings
              </Link>
              <Link
                href="/customer/services"
                className={`flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200 ${pathname === '/customer/services' ? 'bg-[var(--primary)] text-white' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">🎪</span>
                Services
              </Link>
              <Link
                href="/customer/suggestions"
                className={`flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200 ${pathname === '/customer/suggestions' ? 'bg-[var(--primary)] text-white' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Suggestions
              </Link>
              <Link
                href="/customer/notifications"
                className={`relative flex items-center gap-3 px-3 py-3 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary-50)] rounded-lg transition-all duration-200 ${pathname === '/customer/notifications' ? 'bg-[var(--primary)] text-white' : ''}`}
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
                  logout();
                  router.push('/');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 border border-[var(--border)] text-[var(--danger)] hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
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
      <footer className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
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
                <li><Link href="/customer/suggestions" className="hover:text-white transition-colors">Suggestions</Link></li>
                <li><Link href="/customer/bookings" className="hover:text-white transition-colors">My Bookings</Link></li>
                <li><Link href="/customer/profile" className="hover:text-white transition-colors">Profile</Link></li>
                <li><Link href="/customer/notifications" className="hover:text-white transition-colors">Notifications</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-300">
                <li>Contact Us: 09127607860</li>
                <li><button onClick={() => setShowPrivacyPolicy(true)} className="hover:text-white transition-colors">Privacy Policy</button></li>
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
