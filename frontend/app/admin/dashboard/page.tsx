'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    availableServices: 0,
    availableEquipment: 0,
    totalBookings: 0,
    totalCustomers: 0,
    revenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchStats = async () => {
      try {
        const [servicesRes, bookingsRes, customersRes] = await Promise.all([
          fetch('http://localhost:5000/api/services', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:5000/api/bookings/admin/all', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:5000/api/users', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const servicesData = await servicesRes.json();
        const bookingsData = await bookingsRes.json();
        const customersData = await customersRes.json();

        let revenue = 0;
        const bookings = bookingsData.bookings || [];
        revenue = bookings.reduce((sum: number, booking: any) => sum + booking.totalPrice, 0);

        setStats({
          availableServices: servicesData.services?.filter((s: any) => s.isAvailable).length || 0,
          availableEquipment: servicesData.services?.filter((s: any) => s.category === 'equipment' && s.isAvailable).length || 0,
          totalBookings: bookings.length,
          totalCustomers: customersData.users?.filter((u: any) => u.role === 'customer').length || 0,
          revenue,
        });

        setRecentBookings(bookings.slice(0, 8));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
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
        <h1 className="text-4xl font-bold text-[var(--foreground)]">Admin Dashboard</h1>
        <p className="text-[var(--muted)] mt-2">Overview of your business performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">✅</span>
            Available Services
          </div>
          <div className="stat-value text-green-600">{stats.availableServices}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">🎒</span>
            Available Equipment
          </div>
          <div className="stat-value text-purple-600">{stats.availableEquipment}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">📅</span>
            Total Bookings
          </div>
          <div className="stat-value text-[var(--accent)]">{stats.totalBookings}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">👥</span>
            Total Customers
          </div>
          <div className="stat-value text-blue-600">{stats.totalCustomers}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">💰</span>
            Total Revenue
          </div>
          <div className="stat-value text-[var(--success)]">₱{stats.revenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Management Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/admin/services" className="card-hover p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-[var(--primary)]">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">⚙️</div>
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">Manage Services</h3>
          <p className="text-[var(--muted)]">Create, edit, or delete services</p>
        </Link>
        <Link href="/admin/bookings" className="card-hover p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-[var(--accent)]">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📅</div>
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">Manage Bookings</h3>
          <p className="text-[var(--muted)]">Update booking status and payments</p>
        </Link>
        <Link href="/admin/customers" className="card-hover p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">👥</div>
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] group-hover:text-blue-600 transition-colors">Manage Customers</h3>
          <p className="text-[var(--muted)]">View and manage customer accounts</p>
        </Link>
      </div>

      {/* Recent Bookings */}
      <div className="card p-6">
        <h2 className="section-title">Recent Bookings</h2>
        {recentBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Service</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-[var(--muted)]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">{booking.serviceName}</td>
                    <td className="py-3 px-4">{booking.customerName}</td>
                    <td className="py-3 px-4">{new Date(booking.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' : booking.status === 'completed' ? 'badge-primary' : 'badge-warning'}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[var(--primary)]">₱{booking.totalPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[var(--muted)] text-center py-8">No bookings yet</p>
        )}
      </div>
    </div>
  );
}
