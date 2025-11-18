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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[var(--foreground)]">Welcome back, {user?.name}!</h1>
        <p className="text-[var(--muted)] mt-2">Here's your booking overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">📊</span>
            Total Bookings
          </div>
          <div className="stat-value text-[var(--primary)]">{stats.totalBookings}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">⏰</span>
            Upcoming
          </div>
          <div className="stat-value text-[var(--accent)]">{stats.upcomingBookings}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">✅</span>
            Completed
          </div>
          <div className="stat-value text-[var(--success)]">{stats.completedBookings}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">💰</span>
            Total Spent
          </div>
          <div className="stat-value text-[var(--primary)]">₱{stats.totalSpent.toFixed(2)}</div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-title mb-0">Recent Bookings</h2>
          <Link href="/customer/bookings" className="btn-ghost">
            View All
          </Link>
        </div>
        {recentBookings.length > 0 ? (
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between p-4 border border-[var(--border)] rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <p className="font-semibold text-[var(--foreground)]">{booking.serviceName}</p>
                  <p className="text-sm text-[var(--muted)]">{new Date(booking.date).toLocaleDateString()} at {booking.time}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' : booking.status === 'completed' ? 'badge-primary' : 'badge-warning'}`}>
                    {booking.status}
                  </span>
                  <p className="font-semibold text-[var(--primary)]">₱{booking.totalPrice}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--muted)] text-center py-8">No bookings yet</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/customer/services" className="card-hover p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-[var(--primary)]">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📅</div>
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">Browse Services</h3>
          <p className="text-[var(--muted)]">Discover and book available services</p>
        </Link>
        <Link href="/customer/bookings" className="card-hover p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-[var(--accent)]">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📋</div>
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">My Bookings</h3>
          <p className="text-[var(--muted)]">Manage and track your reservations</p>
        </Link>
        <Link href="/customer/profile" className="card-hover p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">👤</div>
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] group-hover:text-blue-600 transition-colors">Profile</h3>
          <p className="text-[var(--muted)]">Update your account information</p>
        </Link>
      </div>
    </div>
  );
}
