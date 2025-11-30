'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '../../../components/SocketProvider';

interface Booking {
  _id: string;
  serviceId: {
    name: string;
    basePrice: number;
    category: string;
    description?: string;
    serviceType?: string;
    requiresDelivery?: boolean;
    includedEquipment?: Array<{
      equipmentId: string;
      quantity: number;
      name: string;
    }>;
  };
  quantity: number;
  bookingDate: string;
  status: string;
  totalPrice: number;
  paymentStatus: string;
  paymentType?: string;
  deliveryStartTime?: string;
  deliveryEndTime?: string;
  requiresDelivery?: boolean;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  duration?: number;
  dailyRate?: number;
  appliedMultiplier?: number;
  daysBeforeCheckout?: number;
  deliveryDuration?: number;
  itemQuantities?: { [itemName: string]: number };
  amountPaid?: number;
  remainingBalance?: number;
  downPaymentPercentage?: number;
}

export default function Bookings() {
  const { socket } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    // Check for payment status messages
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus) {
      switch (paymentStatus) {
        case 'success':
          setPaymentMessage({
            type: 'success',
            message: 'Payment completed successfully! Your booking has been confirmed.'
          });
          break;
        case 'failed':
          setPaymentMessage({
            type: 'error',
            message: 'Payment failed. Please try again or contact support.'
          });
          break;
        case 'error':
          setPaymentMessage({
            type: 'error',
            message: 'An error occurred during payment. Please try again.'
          });
          break;
        default:
          break;
      }

      // Clear the URL parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('payment');
      window.history.replaceState({}, '', newUrl.toString());

      // Auto-hide message after 5 seconds
      setTimeout(() => setPaymentMessage(null), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch('http://localhost:5000/api/bookings', {
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

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleBookingCreated = async (data: any) => {
      console.log('New booking created:', data);
      setUpdating(true);

      // Refetch bookings to get the complete booking data
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await fetch('http://localhost:5000/api/bookings', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const bookingData = await response.json();
            if (bookingData.success) {
              setBookings(bookingData.bookings);
            }
          }
        }
      } catch (error) {
        console.error('Failed to refetch bookings:', error);
      }

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

      {/* Payment Status Message */}
      {paymentMessage && (
        <div className={`mb-6 p-4 rounded-lg border ${
          paymentMessage.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : paymentMessage.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {paymentMessage.type === 'success' && (
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {paymentMessage.type === 'error' && (
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{paymentMessage.message}</span>
          </div>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking._id} className="card p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-4">
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-semibold">{booking.serviceId?.name || 'Unknown Service'}</h3>
                  {booking.serviceId?.description && (
                    <p className="text-[var(--muted)] text-sm mt-1">{booking.serviceId.description}</p>
                  )}
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-3">
                    <p className="text-[var(--muted)] text-sm">
                      📅 {new Date(booking.bookingDate).toLocaleString()}
                    </p>
                    {(booking.requiresDelivery && booking.deliveryStartTime) ||
                     (booking.serviceId?.category === 'equipment' ||
                      booking.serviceId?.category === 'furniture' ||
                      booking.serviceId?.category === 'lighting' ||
                      booking.serviceId?.category === 'sound-system' ||
                      booking.serviceId?.category === 'tents-canopies' ||
                      booking.serviceId?.category === 'linens-tableware' ||
                      booking.serviceId?.serviceType === 'equipment' ||
                      booking.serviceId?.serviceType === 'supply' ||
                      booking.serviceId?.requiresDelivery === true ||
                      (booking.serviceId?.includedEquipment && booking.serviceId.includedEquipment.length > 0)) ? (
                      <p className="text-[var(--muted)] text-sm">
                        🚚 Pick-up: {booking.deliveryStartTime
                          ? new Date(booking.deliveryStartTime).toLocaleString()
                          : (() => {
                              const pickupDate = new Date(booking.bookingDate);
                              pickupDate.setDate(pickupDate.getDate() + 1);
                              return pickupDate.toLocaleString();
                            })()
                        }
                      </p>
                    ) : null}
                    <p className="text-[var(--muted)] text-sm">
                      📦 Quantity: {booking.quantity}
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      🏷️ {booking.serviceId?.category || 'Service'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-col sm:text-right items-start sm:items-end gap-2 sm:gap-0">
                  <p className="text-2xl font-bold text-[var(--primary)]">₱{booking.totalPrice}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Payment Type:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
                      {booking.paymentType === 'full' ? 'Full Payment' : booking.paymentType === 'test_payment' ? 'Test Payment' : 'Full Payment'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Payment Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(booking.paymentStatus)}`}>
                      {booking.paymentStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Amount Paid:</span>
                    <span className="text-sm text-gray-700 font-semibold">₱{booking.amountPaid || 0}</span>
                  </div>
                  {booking.remainingBalance && booking.remainingBalance > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Remaining Balance:</span>
                      <span className="text-sm text-red-600 font-semibold">₱{booking.remainingBalance}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Created:</span>
                    <span className="text-sm text-gray-700">
                      {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {booking.updatedAt && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Last Updated:</span>
                      <span className="text-sm text-gray-700">
                        {new Date(booking.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Booking ID:</span>
                    <span className="text-sm text-gray-700 font-mono">{booking._id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Unit Price:</span>
                    <span className="text-sm text-gray-700">₱{booking.serviceId?.basePrice || 0}</span>
                  </div>
                  {booking.appliedMultiplier && booking.appliedMultiplier !== 1.0 && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Applied Multiplier:</span>
                      <span className="text-sm text-gray-700">{booking.appliedMultiplier}x</span>
                    </div>
                  )}
                  {booking.daysBeforeCheckout && booking.daysBeforeCheckout > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Days Before Event:</span>
                      <span className="text-sm text-gray-700">{booking.daysBeforeCheckout} days</span>
                    </div>
                  )}
                  {booking.duration && booking.duration > 1 && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Duration:</span>
                      <span className="text-sm text-gray-700">{booking.duration} days</span>
                    </div>
                  )}
                  {booking.dailyRate && booking.dailyRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Daily Rate:</span>
                      <span className="text-sm text-gray-700">₱{booking.dailyRate}</span>
                    </div>
                  )}
                  {booking.deliveryDuration && booking.requiresDelivery && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Delivery Duration:</span>
                      <span className="text-sm text-gray-700">{booking.deliveryDuration} minutes</span>
                    </div>
                  )}
                  {booking.notes && (
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-gray-600">Notes:</span>
                      <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">{booking.notes}</p>
                    </div>
                  )}
                  {booking.itemQuantities && Object.keys(booking.itemQuantities).length > 0 && (
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-gray-600">Item Breakdown:</span>
                      <div className="mt-1 space-y-1">
                        {Object.entries(booking.itemQuantities).map(([item, qty]) => (
                          <div key={item} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                            <span>{item}:</span>
                            <span>{qty} item{qty !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Need help? Contact our support team for any questions about your booking.
                  </div>
                  <div className="text-sm text-[var(--primary)] font-medium">
                    📞 Support: (02) 123-4567 | ✉️ support@trixtech.com
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
