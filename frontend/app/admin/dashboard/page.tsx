'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../components/SocketProvider';

export default function AdminDashboard() {
  const router = useRouter();
  const { socket } = useSocket();
  const [stats, setStats] = useState({
    availableServices: 0,
    availableEquipment: 0,
    totalBookings: 0,
    totalCustomers: 0,
    revenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

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

      const lowStock = servicesData.services?.filter((s: any) => s.category === 'equipment' && s.quantity <= 5) || [];

      setStats({
        availableServices: servicesData.services?.filter((s: any) => s.isAvailable).length || 0,
        availableEquipment: servicesData.services?.filter((s: any) => s.category === 'equipment' && s.isAvailable).length || 0,
        totalBookings: bookings.length,
        totalCustomers: customersData.users?.filter((u: any) => u.role === 'customer').length || 0,
        revenue,
      });

      setRecentBookings(bookings.slice(0, 8));
      setLowStockItems(lowStock);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchStats();
  }, [router]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewBooking = (data: any) => {
      console.log('New booking received:', data);
      setUpdating(true);
      setLastUpdate(new Date());

      // Update stats
      setStats(prev => ({
        ...prev,
        totalBookings: prev.totalBookings + 1,
      }));

      // Add to recent bookings if not already there
      setRecentBookings(prev => {
        const newBooking = {
          id: data.booking.id,
          serviceName: data.booking.serviceName,
          date: data.booking.date,
          time: new Date(data.booking.date).toLocaleTimeString(),
          status: data.booking.status,
          totalPrice: data.booking.totalPrice,
          customerName: 'New Customer', // Would need to fetch from API
        };

        // Remove oldest if we have 8, add new one at top
        const updated = [newBooking, ...prev.slice(0, 7)];
        return updated;
      });

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleInventoryUpdate = (data: any) => {
      console.log('Inventory updated:', data);
      setUpdating(true);
      setLastUpdate(new Date());

      // Refresh low stock items
      fetchStats();

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleServiceUpdate = (data: any) => {
      console.log('Service updated:', data);
      setUpdating(true);
      setLastUpdate(new Date());

      // Refresh stats
      fetchStats();

      setTimeout(() => setUpdating(false), 2000);
    };

    socket.on('new-booking', handleNewBooking);
    socket.on('inventory-updated', handleInventoryUpdate);
    socket.on('service-updated', handleServiceUpdate);

    return () => {
      socket.off('new-booking', handleNewBooking);
      socket.off('inventory-updated', handleInventoryUpdate);
      socket.off('service-updated', handleServiceUpdate);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Updating...</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[var(--foreground)]">Admin Dashboard</h1>
        <p className="text-[var(--muted)] mt-2">Overview of your business performance</p>
        {lastUpdate && (
          <p className="text-xs text-[var(--muted)] mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
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

      {/* Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card p-6 border-l-4 border-red-500">
          <h2 className="section-title text-red-600">⚠️ Low Stock Alerts</h2>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div key={item._id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div>
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-red-600 ml-2">({item.quantity} remaining)</span>
                </div>
                <Link href="/admin/services" className="text-blue-600 hover:underline text-sm">
                  Update Stock
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

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
