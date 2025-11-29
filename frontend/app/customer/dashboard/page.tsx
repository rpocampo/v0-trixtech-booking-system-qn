'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PersonalizedRecommendations from '../../../components/PersonalizedRecommendations';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Booking {
  id: string;
  serviceId: {
    name: string;
  };
  bookingDate: string;
  status: string;
  totalPrice: number;
}

interface DeliverySchedule {
  id: string;
  serviceName: string;
  serviceCategory: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  quantity: number;
  totalPrice: number;
  notes?: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [deliverySchedules, setDeliverySchedules] = useState<DeliverySchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  });
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
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
          fetch('http://localhost:5000/api/bookings', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (userRes.status === 401 || bookingsRes.status === 401) {
          // Token expired or invalid, redirect to login
          localStorage.clear();
          router.push('/login');
          return;
        }

        const userData = await userRes.json();
        const bookingsData = await bookingsRes.json();

        if (userData.success) {
          setUser(userData.user);
        }

        if (bookingsData.success && bookingsData.bookings) {
          const bookings = bookingsData.bookings;
          const upcoming = bookings.filter((b: any) => b.status === 'confirmed');
          const completed = bookings.filter((b: any) => b.status === 'completed');

          setStats({
            totalBookings: bookings.length,
            upcomingBookings: upcoming.length,
            completedBookings: completed.length,
          });

          // Transform bookings to match the expected interface
          const transformedBookings = bookings.slice(0, 5).map((booking: any) => ({
            id: booking._id,
            serviceId: booking.serviceId,
            bookingDate: booking.bookingDate,
            status: booking.status,
            totalPrice: booking.totalPrice,
          }));

          setRecentBookings(transformedBookings);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const fetchDeliverySchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:5000/api/bookings/delivery-schedules?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setDeliverySchedules(data.schedules);
      }
    } catch (error) {
      console.error('Failed to fetch delivery schedules:', error);
    }
  };

  useEffect(() => {
    fetchDeliverySchedules();
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-12">
      {/* Hero Header */}
      <div className="card-gradient p-10 mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold text-[var(--foreground)] mb-4">
              Welcome back, <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">{user?.name}</span>! 👋
            </h1>
            <p className="text-[var(--muted)] text-xl leading-relaxed">Here's your personalized booking dashboard</p>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <div className="text-sm text-[var(--muted)]">Member since</div>
              <div className="font-semibold text-[var(--foreground)] text-lg">
                {user ? new Date().getFullYear() : '2024'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        <div className="card-elevated p-8 hover:shadow-xl transition-all duration-300 animate-fade-in min-h-[160px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold text-[var(--primary)] mb-2">{stats.totalBookings}</div>
              <div className="text-base text-[var(--muted)] font-medium">Total Bookings</div>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
          <div className="mt-6 flex items-center text-sm">
            <span className="text-[var(--success)] font-medium">↗️ Active</span>
          </div>
        </div>

        <div className="card-elevated p-8 hover:shadow-xl transition-all duration-300 animate-fade-in min-h-[160px] flex flex-col justify-between" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold text-[var(--accent)] mb-2">{stats.upcomingBookings}</div>
              <div className="text-base text-[var(--muted)] font-medium">Upcoming</div>
            </div>
            <div className="text-5xl opacity-20">⏰</div>
          </div>
          <div className="mt-6 flex items-center text-sm">
            <span className="text-[var(--warning)] font-medium">📅 Scheduled</span>
          </div>
        </div>

        <div className="card-elevated p-8 hover:shadow-xl transition-all duration-300 animate-fade-in min-h-[160px] flex flex-col justify-between" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold text-[var(--success)] mb-2">{stats.completedBookings}</div>
              <div className="text-base text-[var(--muted)] font-medium">Completed</div>
            </div>
            <div className="text-5xl opacity-20">✅</div>
          </div>
          <div className="mt-6 flex items-center text-sm">
            <span className="text-[var(--success)] font-medium">✓ Done</span>
          </div>
        </div>

      </div>

      {/* Quick Actions - Browse Services First */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in" style={{ animationDelay: '400ms' }}>
        <Link href="/customer/services" className="card-interactive group p-8 border-l-4 border-l-[var(--primary)] min-h-[160px] flex flex-col justify-between relative bg-gradient-to-br from-[var(--primary-50)] to-white shadow-lg ring-2 ring-[var(--primary)]/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="text-5xl group-hover:scale-110 transition-transform duration-300">🎪</div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                Browse Services
              </h3>
              <p className="text-[var(--muted)] text-base leading-relaxed">Discover amazing event services</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-base text-[var(--primary)] font-bold">Explore now →</span>
          </div>
        </Link>

        <Link href="/customer/profile" className="card-interactive group p-8 border-l-4 border-l-blue-500 min-h-[160px] flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-6">
            <div className="text-5xl group-hover:scale-110 transition-transform duration-300">👤</div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--foreground)] group-hover:text-blue-600 transition-colors">
                Profile Settings
              </h3>
              <p className="text-[var(--muted)] text-base leading-relaxed">Update your information</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-base text-blue-600 font-medium">Edit profile →</span>
          </div>
        </Link>

        <Link href="/customer/bookings" className="card-interactive group p-8 border-l-4 border-l-[var(--accent)] sm:col-span-2 lg:col-span-1 min-h-[160px] flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-6">
            <div className="text-5xl group-hover:scale-110 transition-transform duration-300">📋</div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                My Bookings
              </h3>
              <p className="text-[var(--muted)] text-base leading-relaxed">Manage your reservations</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-base text-[var(--accent)] font-medium">View bookings →</span>
          </div>
        </Link>
      </div>

      {/* Recent Bookings */}
      <div className="card-elevated p-8 animate-fade-in" style={{ animationDelay: '600ms' }}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
            <span className="text-3xl">📅</span>
            Recent Bookings
          </h2>
          <Link href="/customer/bookings" className="btn-outline text-base px-6 py-3">
            View All →
          </Link>
        </div>

        {recentBookings.length > 0 ? (
          <div className="space-y-6">
            {recentBookings.map((booking, index) => (
              <div
                key={booking.id}
                className={`flex items-center justify-between p-6 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:shadow-lg transition-all duration-300 animate-fade-in ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
                style={{ animationDelay: `${700 + index * 100}ms` }}
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-2xl font-bold">
                    {booking.serviceId?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-[var(--foreground)] text-lg">{booking.serviceId?.name || 'Unknown Service'}</p>
                    <p className="text-base text-[var(--muted)] mt-1">
                      {new Date(booking.bookingDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })} at {new Date(booking.bookingDate).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {booking.status}
                  </span>
                  <div className="text-right">
                    <p className="font-bold text-[var(--primary)] text-xl">₱{booking.totalPrice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-7xl mb-6 opacity-50">📅</div>
            <h3 className="text-2xl font-semibold text-[var(--foreground)] mb-4">No bookings yet</h3>
            <p className="text-[var(--muted)] mb-8 text-lg">Start your journey by booking your first service!</p>
            <Link href="/customer/services" className="btn-primary px-8 py-4 text-lg">
              Browse Services
            </Link>
          </div>
        )}
      </div>

      {/* Delivery Schedules */}
      <div className="card p-6 mt-8 animate-fade-in" style={{ animationDelay: '700ms' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-title">📅 Delivery Schedules</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Date:</label>
            <input
              className="input-field"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
        {deliverySchedules.length > 0 ? (
          <div className="space-y-4">
            {deliverySchedules.map((schedule, index) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 bg-white"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-lg font-bold">
                    🚚
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-base">{schedule.serviceName}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(schedule.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })} - {new Date(schedule.endTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })} ({schedule.duration} min)
                    </p>
                    <p className="text-xs text-gray-500">Quantity: {schedule.quantity}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    schedule.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    schedule.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {schedule.status}
                  </span>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="font-semibold text-blue-600">₱{schedule.totalPrice}</p>
                    <button
                      onClick={() => router.push(`/customer/booking/${schedule.id}`)}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--muted)] text-center py-8">No delivery schedules for selected date</p>
        )}
      </div>

      {/* Personalized Recommendations */}
      <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '900ms' }}>
        <PersonalizedRecommendations limit={6} />
      </div>
    </div>
  );
}
