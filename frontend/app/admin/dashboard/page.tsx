'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../components/SocketProvider';

export default function AdminDashboard() {
  const router = useRouter();
  const { socket } = useSocket();
  const [stats, setStats] = useState({
    totalBookings: 0,
    bookedCustomers: 0,
    totalInventory: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentBookingsLoading, setRecentBookingsLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const [servicesRes, customersRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/services`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      // Handle 401 errors gracefully
      if (servicesRes.status === 401 || customersRes.status === 401) {
        localStorage.clear();
        router.push('/login');
        return;
      }

      const servicesData = await servicesRes.json();
      const customersData = await customersRes.json();

      const totalInventory = servicesData.services?.reduce((sum: number, s: any) => {
        if (s.serviceType === 'equipment' || s.serviceType === 'supply') {
          return sum + (s.quantity || 0);
        }
        return sum;
      }, 0) || 0;

      const lowStock = servicesData.services?.filter((s: any) => s.category === 'equipment' && s.quantity <= 5) || [];

      setStats({
        totalBookings: 0, // Will be updated by fetchRecentBookings
        bookedCustomers: customersData.users?.filter((u: any) => u.role === 'customer').length || 0,
        totalInventory,
      });

      setLowStockItems(lowStock);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentBookings = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setRecentBookingsLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/bookings/admin/all?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.clear();
        router.push('/login');
        return;
      }

      const data = await response.json();
      const bookings = data.bookings || [];

      setStats(prev => ({
        ...prev,
        totalBookings: bookings.length,
      }));

      setRecentBookings(bookings);
    } catch (error) {
      console.error('Failed to fetch recent bookings:', error);
    } finally {
      setRecentBookingsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchStats();
    fetchRecentBookings();
  }, [router]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewBooking = (data: any) => {
      setUpdating(true);
      setLastUpdate(new Date());

      // Refresh recent bookings to get complete data with customer info
      fetchRecentBookings();

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleInventoryUpdate = (data: any) => {
      setUpdating(true);
      setLastUpdate(new Date());

      // Refresh low stock items
      fetchStats();

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleServiceUpdate = (data: any) => {
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
      <div className="text-center mb-12">
        <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text mb-4">
          Admin Dashboard
        </h1>
        <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto">
          Comprehensive overview of your business performance and real-time insights
        </p>
        {lastUpdate && (
          <p className="text-sm text-[var(--muted)] mt-4 bg-[var(--primary-50)] px-4 py-2 rounded-full inline-block">
            🔄 Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="flex justify-center">
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl">
          <div className="stat-box hover:shadow-lg transition-shadow duration-300 p-6">
            <div className="stat-label flex items-center gap-3 mb-4">
              <span className="text-2xl">📅</span>
              <span className="text-lg font-semibold">Total Bookings</span>
            </div>
            <div className="stat-value text-[var(--accent)] text-4xl font-bold">{stats.totalBookings}</div>
          </div>
          <div className="stat-box hover:shadow-lg transition-shadow duration-300 p-6">
            <div className="stat-label flex items-center gap-3 mb-4">
              <span className="text-2xl">👥</span>
              <span className="text-lg font-semibold">Booked Customers</span>
            </div>
            <div className="stat-value text-blue-600 text-4xl font-bold">{stats.bookedCustomers}</div>
          </div>
          <div className="stat-box hover:shadow-lg transition-shadow duration-300 p-6">
            <div className="stat-label flex items-center gap-3 mb-4">
              <span className="text-2xl">📦</span>
              <span className="text-lg font-semibold">Total Inventory</span>
            </div>
            <div className="stat-value text-purple-600 text-4xl font-bold">{stats.totalInventory}</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card p-8 border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-white">
          <h2 className="text-3xl font-bold text-red-600 mb-6 flex items-center gap-3">
            <span className="text-4xl">⚠️</span>
            Low Stock Alerts
          </h2>
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
      <div className="mb-16">
        <h2 className="text-4xl font-black text-center text-[var(--foreground)] mb-12">
          Management Center
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Link href="/admin/services" className="card-hover p-8 group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border-l-4 border-[var(--primary)] bg-gradient-to-br from-white to-[var(--primary-50)]">
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">⚙️</div>
            <h3 className="text-2xl font-bold mb-4 text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">Manage Services</h3>
            <p className="text-[var(--muted)] text-lg leading-relaxed">Create, edit, or delete services with advanced inventory management</p>
          </Link>
          <Link href="/admin/bookings" className="card-hover p-8 group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border-l-4 border-[var(--accent)] bg-gradient-to-br from-white to-[var(--accent-50)]">
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">📅</div>
            <h3 className="text-2xl font-bold mb-4 text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">Manage Bookings</h3>
            <p className="text-[var(--muted)] text-lg leading-relaxed">Update booking status, process payments, and track delivery schedules</p>
          </Link>
          <Link href="/admin/customers" className="card-hover p-8 group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border-l-4 border-blue-500 bg-gradient-to-br from-white to-blue-50">
            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">👥</div>
            <h3 className="text-2xl font-bold mb-4 text-[var(--foreground)] group-hover:text-blue-600 transition-colors">Manage Customers</h3>
            <p className="text-[var(--muted)] text-lg leading-relaxed">View and manage customer accounts, profiles, and communication</p>
          </Link>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card p-8">
        <h2 className="text-3xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-3">
          <span className="text-4xl">📋</span>
          Recent Bookings
        </h2>
        {recentBookingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent"></div>
            <span className="ml-3 text-[var(--muted)]">Loading recent bookings...</span>
          </div>
        ) : recentBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Service</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Date & Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-[var(--muted)]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr
                    key={booking._id}
                    className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setShowBookingModal(true);
                    }}
                  >
                    <td className="py-3 px-4">{booking.serviceId?.name || 'Unknown Service'}</td>
                    <td className="py-3 px-4">{booking.customerId?.name || 'Unknown Customer'}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <div>{new Date(booking.bookingDate).toLocaleDateString()}</div>
                        <div className="text-[var(--muted)] text-xs">{new Date(booking.bookingDate).toLocaleTimeString()}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        booking.status === 'confirmed' ? 'badge-success' :
                        booking.status === 'completed' ? 'badge-primary' :
                        booking.status === 'pending' ? 'badge-info' :
                        'badge-warning'
                      }`}>
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

      {/* Booking Details Modal */}
      {showBookingModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-[var(--foreground)]">Booking Details</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Booking Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card p-4">
                    <h4 className="font-semibold mb-3 text-[var(--foreground)]">Booking Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Booking ID:</span>
                        <span className="font-mono text-xs">{selectedBooking._id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Status:</span>
                        <span className={`badge ${
                          selectedBooking.status === 'confirmed' ? 'badge-success' :
                          selectedBooking.status === 'completed' ? 'badge-primary' :
                          selectedBooking.status === 'pending' ? 'badge-info' :
                          'badge-warning'
                        }`}>
                          {selectedBooking.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Date & Time:</span>
                        <span>{new Date(selectedBooking.bookingDate).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Quantity:</span>
                        <span>{selectedBooking.quantity}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4">
                    <h4 className="font-semibold mb-3 text-[var(--foreground)]">Customer Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Name:</span>
                        <span>{selectedBooking.customerId?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Email:</span>
                        <span className="text-xs">{selectedBooking.customerId?.email || 'Unknown'}</span>
                      </div>
                      {selectedBooking.customerId?.phone && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Phone:</span>
                          <span>{selectedBooking.customerId.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Details */}
                <div className="card p-4">
                  <h4 className="font-semibold mb-3 text-[var(--foreground)]">Service Details</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Service:</span>
                          <span>{selectedBooking.serviceId?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Category:</span>
                          <span className="capitalize">{selectedBooking.serviceId?.category?.replace('-', ' ') || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Type:</span>
                          <span className="capitalize">{selectedBooking.serviceId?.serviceType || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Unit Price:</span>
                          <span>₱{selectedBooking.serviceId?.price || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Quantity:</span>
                          <span>{selectedBooking.quantity}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-lg">
                          <span className="text-[var(--muted)]">Total:</span>
                          <span className="text-[var(--primary)]">₱{selectedBooking.totalPrice}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedBooking.notes && (
                  <div className="card p-4">
                    <h4 className="font-semibold mb-3 text-[var(--foreground)]">Additional Notes</h4>
                    <p className="text-[var(--muted)] text-sm">{selectedBooking.notes}</p>
                  </div>
                )}

                {/* Payment Status */}
                <div className="card p-4">
                  <h4 className="font-semibold mb-3 text-[var(--foreground)]">Payment Information</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--muted)]">Payment Status:</span>
                    <span className={`badge ${
                      selectedBooking.paymentStatus === 'paid' ? 'badge-success' :
                      selectedBooking.paymentStatus === 'unpaid' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {selectedBooking.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="btn-secondary flex-1"
                >
                  Close
                </button>
                <Link
                  href={`/admin/bookings`}
                  className="btn-primary flex-1 text-center"
                  onClick={() => setShowBookingModal(false)}
                >
                  Manage All Bookings
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

