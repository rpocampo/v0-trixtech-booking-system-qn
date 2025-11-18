'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Booking {
  id: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  totalPrice: number;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [userRes, bookingsRes] = await Promise.all([
          fetch('http://localhost:5000/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:5000/api/bookings/my-bookings', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const userData = await userRes.json();
        const bookingsData = await bookingsRes.json();

        if (userData.success) {
          setUser(userData.user);
        }

        if (bookingsData.success && bookingsData.bookings) {
          const bookings = bookingsData.bookings;
          const upcoming = bookings.filter((b: any) => b.status === 'confirmed');
          const completed = bookings.filter((b: any) => b.status === 'completed');
          const totalSpent = bookings.reduce((sum: number, b: any) => sum + b.totalPrice, 0);

          setStats({
            totalBookings: bookings.length,
            upcomingBookings: upcoming.length,
            completedBookings: completed.length,
            totalSpent,
          });

          setRecentBookings(bookings.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero Header */}
      <div className="card-gradient p-8 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">
              Welcome back, <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">{user?.name}</span>! 👋
            </h1>
            <p className="text-[var(--muted)] text-lg">Here's your personalized booking dashboard</p>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <div className="text-sm text-[var(--muted)]">Member since</div>
              <div className="font-semibold text-[var(--foreground)]">
                {user ? new Date().getFullYear() : '2024'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card-elevated p-6 hover:shadow-xl transition-all duration-300 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-[var(--primary)] mb-1">{stats.totalBookings}</div>
              <div className="text-sm text-[var(--muted)] font-medium">Total Bookings</div>
            </div>
            <div className="text-4xl opacity-20">📊</div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-[var(--success)] font-medium">↗️ Active</span>
          </div>
        </div>

        <div className="card-elevated p-6 hover:shadow-xl transition-all duration-300 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-[var(--accent)] mb-1">{stats.upcomingBookings}</div>
              <div className="text-sm text-[var(--muted)] font-medium">Upcoming</div>
            </div>
            <div className="text-4xl opacity-20">⏰</div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-[var(--warning)] font-medium">📅 Scheduled</span>
          </div>
        </div>

        <div className="card-elevated p-6 hover:shadow-xl transition-all duration-300 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-[var(--success)] mb-1">{stats.completedBookings}</div>
              <div className="text-sm text-[var(--muted)] font-medium">Completed</div>
            </div>
            <div className="text-4xl opacity-20">✅</div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-[var(--success)] font-medium">✓ Done</span>
          </div>
        </div>

        <div className="card-elevated p-6 hover:shadow-xl transition-all duration-300 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-[var(--primary)] mb-1">₱{stats.totalSpent.toFixed(0)}</div>
              <div className="text-sm text-[var(--muted)] font-medium">Total Spent</div>
            </div>
            <div className="text-4xl opacity-20">💰</div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-[var(--primary)] font-medium">💎 Premium</span>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-2xl">📅</span>
            Recent Bookings
          </h2>
          <Link href="/customer/bookings" className="btn-outline text-sm">
            View All →
          </Link>
        </div>

        {recentBookings.length > 0 ? (
          <div className="space-y-4">
            {recentBookings.map((booking, index) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${500 + index * 100}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-xl">
                    {booking.serviceName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{booking.serviceName}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {new Date(booking.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })} at {booking.time}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {booking.status}
                  </span>
                  <div className="text-right">
                    <p className="font-bold text-[var(--primary)] text-lg">₱{booking.totalPrice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">📅</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No bookings yet</h3>
            <p className="text-[var(--muted)] mb-6">Start your journey by booking your first service!</p>
            <Link href="/customer/services" className="btn-primary">
              Browse Services
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '600ms' }}>
        <Link href="/customer/services" className="card-interactive group p-6 border-l-4 border-l-[var(--primary)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">🎪</div>
            <div>
              <h3 className="text-xl font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                Browse Services
              </h3>
              <p className="text-[var(--muted)] text-sm">Discover amazing event services</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--primary)] font-medium">Explore now →</span>
          </div>
        </Link>

        <Link href="/customer/bookings" className="card-interactive group p-6 border-l-4 border-l-[var(--accent)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">📋</div>
            <div>
              <h3 className="text-xl font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                My Bookings
              </h3>
              <p className="text-[var(--muted)] text-sm">Manage your reservations</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--accent)] font-medium">View bookings →</span>
          </div>
        </Link>

        <Link href="/customer/profile" className="card-interactive group p-6 border-l-4 border-l-blue-500 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl group-hover:scale-110 transition-transform duration-300">👤</div>
            <div>
              <h3 className="text-xl font-bold text-[var(--foreground)] group-hover:text-blue-600 transition-colors">
                Profile Settings
              </h3>
              <p className="text-[var(--muted)] text-sm">Update your information</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-600 font-medium">Edit profile →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
