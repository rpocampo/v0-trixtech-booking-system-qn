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

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const [servicesRes, customersRes] = await Promise.all([
        fetch('http://localhost:5000/api/services', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/users', {
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

      const lowStock = servicesData.services?.filter((s: any) => (s.serviceType === 'equipment' || s.serviceType === 'supply') && s.quantity <= 5) || [];

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
      const response = await fetch('http://localhost:5000/api/bookings/admin/all?limit=10', {
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
        totalBookings: data.total || 0,
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
      console.log('New booking received:', data);
      setUpdating(true);
      setLastUpdate(new Date());

      // Refresh recent bookings to get complete data with customer info
      fetchRecentBookings();

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
    <div className="space-y-3">

      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
              Dashboard
            </h1>
            <p className="text-[var(--muted)] text-sm">
              Monitor your business operations and manage reservations
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--muted)] mb-1">Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[var(--success)] rounded-full"></div>
              <span className="text-sm font-medium text-[var(--foreground)]">Online</span>
            </div>
            {lastUpdate && (
              <div className="text-xs text-[var(--muted)] mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Key Metrics */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        <div className="bg-gradient-to-br from-white to-blue-50/30 border border-blue-200/50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-blue-600/80 text-sm font-semibold uppercase tracking-wider mb-2">Total Reservations</p>
              <p className="text-4xl font-bold text-blue-900">{stats.totalBookings?.toLocaleString() || 0}</p>
              <p className="text-blue-700/70 text-sm mt-2">All time bookings</p>
            </div>
            <div className="p-4 bg-blue-100 rounded-2xl">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-blue-700 text-sm font-medium">Active tracking</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-green-50/30 border border-green-200/50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-green-600/80 text-sm font-semibold uppercase tracking-wider mb-2">Active Customers</p>
              <p className="text-4xl font-bold text-green-900">{stats.bookedCustomers?.toLocaleString() || 0}</p>
              <p className="text-green-700/70 text-sm mt-2">Registered users</p>
            </div>
            <div className="p-4 bg-green-100 rounded-2xl">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-700 text-sm font-medium">Growing community</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-orange-50/30 border border-orange-200/50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-orange-600/80 text-sm font-semibold uppercase tracking-wider mb-2">Inventory Items</p>
              <p className="text-4xl font-bold text-orange-900">{stats.totalInventory?.toLocaleString() || 0}</p>
              <p className="text-orange-700/70 text-sm mt-2">Equipment available</p>
            </div>
            <div className="p-4 bg-orange-100 rounded-2xl">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-orange-700 text-sm font-medium">Well stocked</span>
          </div>
        </div>
      </div>

      {/* Modern Alerts Section */}
      {lowStockItems.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/50 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-2xl">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-900 mb-1">Low Stock Alerts</h2>
              <p className="text-red-700">Items requiring immediate attention</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.slice(0, 6).map((item) => (
              <div key={item._id} className="bg-white/70 backdrop-blur-sm border border-red-200/30 rounded-xl p-4 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                      <p className="text-red-600 text-xs font-medium">{item.quantity} remaining</p>
                    </div>
                  </div>
                </div>
                <Link href="/admin/services" className="inline-flex items-center gap-2 text-red-600 hover:text-red-800 text-sm font-semibold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                  Update Stock
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
          {lowStockItems.length > 6 && (
            <div className="text-center mt-6">
              <Link href="/admin/services" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg hover:shadow-xl">
                View All {lowStockItems.length} Alerts
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Modern Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/admin/bookings" className="group bg-gradient-to-br from-white to-blue-50/30 border border-blue-200/50 rounded-2xl p-6 hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 text-lg mb-1">Manage Reservations</h3>
              <p className="text-blue-700/80 text-sm">View and process bookings</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-600 font-semibold text-sm">View Details</span>
            <svg className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/admin/services" className="group bg-gradient-to-br from-white to-green-50/30 border border-green-200/50 rounded-2xl p-6 hover:shadow-xl hover:border-green-300 transition-all duration-300 hover:-translate-y-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 rounded-2xl group-hover:bg-green-200 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-green-900 text-lg mb-1">Equipment</h3>
              <p className="text-green-700/80 text-sm">Manage inventory & services</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-green-600 font-semibold text-sm">Configure</span>
            <svg className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/admin/customers" className="group bg-gradient-to-br from-white to-purple-50/30 border border-purple-200/50 rounded-2xl p-6 hover:shadow-xl hover:border-purple-300 transition-all duration-300 hover:-translate-y-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-100 rounded-2xl group-hover:bg-purple-200 transition-colors">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-purple-900 text-lg mb-1">Customers</h3>
              <p className="text-purple-700/80 text-sm">View customer accounts</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-purple-600 font-semibold text-sm">Manage</span>
            <svg className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/admin/reports" className="group bg-gradient-to-br from-white to-orange-50/30 border border-orange-200/50 rounded-2xl p-6 hover:shadow-xl hover:border-orange-300 transition-all duration-300 hover:-translate-y-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-100 rounded-2xl group-hover:bg-orange-200 transition-colors">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 text-lg mb-1">Reports</h3>
              <p className="text-orange-700/80 text-sm">View analytics & insights</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-orange-600 font-semibold text-sm">Analyze</span>
            <svg className="w-5 h-5 text-orange-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Reservation</h2>
          <Link href="/admin/bookings" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View all →
          </Link>
        </div>
        {recentBookingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : recentBookings.length > 0 ? (
          <div className="space-y-3">
            {recentBookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{booking.serviceId?.name || 'Unknown Equipment'}</p>
                    <p className="text-slate-600 text-xs">{booking.customerId?.name || 'Unknown Customer'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">₱{booking.totalPrice}</p>
                    <p className="text-xs text-slate-500">{new Date(booking.bookingDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-500 text-sm">No recent reservations</p>
          </div>
        )}
      </div>

    </div>
  );
}
