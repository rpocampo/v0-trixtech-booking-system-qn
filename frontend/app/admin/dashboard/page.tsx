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

      {/* Key Metrics */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--muted)] text-sm font-medium">Total Bookings</p>
              <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{stats.totalBookings}</p>
            </div>
            <div className="w-12 h-12 bg-[var(--primary-50)] rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--muted)] text-sm font-medium">Active Customers</p>
              <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{stats.bookedCustomers}</p>
            </div>
            <div className="w-12 h-12 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--muted)] text-sm font-medium">Inventory Items</p>
              <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{stats.totalInventory}</p>
            </div>
            <div className="w-12 h-12 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-semibold text-red-900">Low Stock Alerts</h2>
          </div>
          <div className="space-y-2">
            {lowStockItems.slice(0, 3).map((item) => (
              <div key={item._id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                    <p className="text-red-600 text-xs">{item.quantity} remaining</p>
                  </div>
                </div>
                <Link href="/admin/services" className="text-red-600 hover:text-red-800 text-sm font-medium">
                  Update →
                </Link>
              </div>
            ))}
            {lowStockItems.length > 3 && (
              <Link href="/admin/services" className="text-red-600 hover:text-red-800 text-sm font-medium block text-center">
                View all {lowStockItems.length} alerts →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/admin/bookings" className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] text-sm">Manage Reservations</h3>
              <p className="text-[var(--muted)] text-xs">View and process reservations</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/services" className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Equipment</h3>
              <p className="text-slate-600 text-xs">Manage inventory and services</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/customers" className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Customers</h3>
              <p className="text-slate-600 text-xs">View customer accounts</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/reports" className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Reports</h3>
              <p className="text-slate-600 text-xs">View analytics and reports</p>
            </div>
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
            <p className="text-slate-500 text-sm">No recent bookings</p>
          </div>
        )}
      </div>

    </div>
  );
}
