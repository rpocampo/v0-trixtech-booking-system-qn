'use client';

import { useEffect, useState } from 'react';

interface Booking {
  _id: string;
  customerId: { name: string; email: string };
  serviceId: { name: string; price: number };
  bookingDate: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    const fetchBookings = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch('http://localhost:5000/api/bookings/admin/all', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setBookings(data.bookings);
        }
      } catch (error) {
        console.error('Failed to fetch bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  useEffect(() => {
    let filtered = bookings;

    if (filters.status) {
      filtered = filtered.filter(booking => booking.status === filters.status);
    }

    if (filters.paymentStatus) {
      filtered = filtered.filter(booking => booking.paymentStatus === filters.paymentStatus);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(booking => new Date(booking.bookingDate) >= new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
      filtered = filtered.filter(booking => new Date(booking.bookingDate) <= new Date(filters.dateTo));
    }

    setFilteredBookings(filtered);
  }, [bookings, filters]);

  const updateBooking = async (bookingId: string, status: string, paymentStatus: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, paymentStatus }),
      });

      const data = await response.json();
      if (response.ok) {
        setBookings(bookings.map((b) => (b._id === bookingId ? data.booking : b)));
      }
    } catch (error) {
      console.error('Failed to update booking:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div>Loading bookings...</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Manage Bookings</h1>
      <p className="text-[var(--muted)] mb-8">View and update booking status</p>

      {/* Filters */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Filter Bookings</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Payment Status</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
              className="input-field"
            >
              <option value="">All Payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setFilters({ status: '', paymentStatus: '', dateFrom: '', dateTo: '' })}
            className="btn-primary"
          >
            Clear Filters
          </button>
          <span className="text-sm text-[var(--muted)] self-center">
            Showing {filteredBookings.length} of {bookings.length} bookings
          </span>
        </div>
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-6 py-3 text-left text-sm font-semibold">Customer</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Service</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Price</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Payment</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((booking) => (
              <tr key={booking._id} className="border-b border-[var(--border)]">
                <td className="px-6 py-3">
                  <div>
                    <p className="font-semibold">{booking.customerId?.name || 'Unknown Customer'}</p>
                    <p className="text-xs text-[var(--muted)]">{booking.customerId?.email || 'N/A'}</p>
                  </div>
                </td>
                <td className="px-6 py-3">{booking.serviceId?.name || 'Unknown Service'}</td>
                <td className="px-6 py-3 text-sm">{new Date(booking.bookingDate).toLocaleDateString()}</td>
                <td className="px-6 py-3 font-semibold">₱{booking.totalPrice}</td>
                <td className="px-6 py-3">
                  <select
                    value={booking.status}
                    onChange={(e) => updateBooking(booking._id, e.target.value, booking.paymentStatus)}
                    className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(booking.status)}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <select
                    value={booking.paymentStatus}
                    onChange={(e) => updateBooking(booking._id, booking.status, e.target.value)}
                    className={`px-3 py-1 rounded text-sm font-semibold ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <button className="text-[var(--primary)] hover:underline text-sm">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredBookings.length === 0 && bookings.length > 0 && (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No bookings match the current filters</p>
        </div>
      )}

      {bookings.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No bookings yet</p>
        </div>
      )}
    </div>
  );
}
