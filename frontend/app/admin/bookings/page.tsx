'use client';

import { useEffect, useState } from 'react';

interface Booking {
  _id: string;
  customerId: { name: string; email: string };
  serviceId: { name: string; price: number };
  bookingDate: string;
  status: string;
  paymentStatus: string;
  paymentType?: string;
  amountPaid?: number;
  remainingBalance?: number;
  totalPrice: number;
  createdAt?: string;
  updatedAt?: string;
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
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/bookings/admin/all', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          // Token expired or invalid, don't log as error
          setLoading(false);
          return;
        }

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

  const viewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowBookingModal(true);
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
              <option value="partial">Partial</option>
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
              <th className="px-6 py-3 text-left text-sm font-semibold">Payment Type</th>
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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    booking.paymentType === 'full' ? 'bg-green-100 text-green-800' :
                    booking.paymentType === 'down_payment' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.paymentType === 'full' ? 'Full Payment' :
                     booking.paymentType === 'down_payment' ? 'Down Payment' :
                     'N/A'}
                  </span>
                </td>
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
                    className={`px-3 py-1 rounded text-sm font-semibold ${
                      booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                      booking.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </td>
                <td className="px-6 py-3">
                  <button
                    onClick={() => viewBooking(booking)}
                    className="text-[var(--primary)] hover:underline text-sm"
                  >
                    View
                  </button>
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

      {/* Booking Details Modal */}
      {showBookingModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Booking Details</h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Booking ID */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Booking ID</h4>
                  <p className="font-mono text-sm">{selectedBooking._id}</p>
                </div>

                {/* Customer Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card p-4">
                    <h4 className="font-semibold mb-3">Customer Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-600">Name:</span>
                        <p className="font-medium">{selectedBooking.customerId?.name || 'Unknown Customer'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Email:</span>
                        <p className="font-medium">{selectedBooking.customerId?.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Service Information */}
                  <div className="card p-4">
                    <h4 className="font-semibold mb-3">Service Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-600">Service:</span>
                        <p className="font-medium">{selectedBooking.serviceId?.name || 'Unknown Service'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Unit Price:</span>
                        <p className="font-medium">₱{selectedBooking.serviceId?.price || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="card p-4">
                  <h4 className="font-semibold mb-3">Booking Details</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Booking Date:</span>
                      <p className="font-medium">{new Date(selectedBooking.bookingDate).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-500">{new Date(selectedBooking.bookingDate).toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Total Price:</span>
                      <p className="font-medium text-lg">₱{selectedBooking.totalPrice}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Created:</span>
                      <p className="font-medium">{new Date(selectedBooking.createdAt || '').toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Status Information */}
                <div className="card p-4">
                  <h4 className="font-semibold mb-3">Status Information</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Booking Status:</span>
                      <div className="mt-1">
                        <select
                          value={selectedBooking.status}
                          onChange={(e) => updateBooking(selectedBooking._id, e.target.value, selectedBooking.paymentStatus)}
                          className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(selectedBooking.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Payment Status:</span>
                      <div className="mt-1">
                        <select
                          value={selectedBooking.paymentStatus}
                          onChange={(e) => updateBooking(selectedBooking._id, selectedBooking.status, e.target.value)}
                          className={`px-3 py-1 rounded text-sm font-semibold ${
                            selectedBooking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                            selectedBooking.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="btn-secondary"
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
