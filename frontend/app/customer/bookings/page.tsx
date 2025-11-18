'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '../../../components/SocketProvider';

interface Booking {
  _id: string;
  serviceId: { name: string; price: number; category: string };
  quantity: number;
  bookingDate: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
}

export default function Bookings() {
  const { socket } = useSocket();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/bookings', {
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

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleBookingCreated = (data: any) => {
      console.log('New booking created:', data);
      setUpdating(true);

      // Add the new booking to the list
      setBookings(prev => [data.booking, ...prev]);

      setTimeout(() => setUpdating(false), 2000);
    };

    socket.on('booking-created', handleBookingCreated);

    return () => {
      socket.off('booking-created', handleBookingCreated);
    };
  }, [socket]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'completed':
        return 'text-blue-600 bg-blue-50';
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) return <div>Loading bookings...</div>;

  return (
    <div>
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">New booking added!</span>
        </div>
      )}

      <h1 className="text-4xl font-bold mb-2">Your Bookings</h1>
      <p className="text-[var(--muted)] mb-8">Manage your service bookings</p>

      {bookings.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking._id} className="card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{booking.serviceId?.name || 'Unknown Service'}</h3>
                  <p className="text-[var(--muted)] text-sm">
                    {new Date(booking.bookingDate).toLocaleString()}
                  </p>
                  {booking.serviceId?.category === 'equipment' && (
                    <p className="text-[var(--muted)] text-sm">
                      Quantity: {booking.quantity}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--primary)]">₱{booking.totalPrice}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-[var(--border)]">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.paymentStatus)}`}>
                  {booking.paymentStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
