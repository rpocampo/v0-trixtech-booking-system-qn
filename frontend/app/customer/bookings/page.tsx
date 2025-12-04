'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '../../../components/SocketProvider';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  status: string;
  totalPrice: number;
  serviceName: string;
}

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
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
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

  // Convert bookings to calendar events
  useEffect(() => {
    const events: CalendarEvent[] = bookings.map(booking => ({
      id: booking._id,
      title: booking.serviceId?.name || 'Unknown Service',
      date: new Date(booking.bookingDate),
      status: booking.status,
      totalPrice: booking.totalPrice,
      serviceName: booking.serviceId?.name || 'Unknown Service'
    }));
    setCalendarEvents(events);
  }, [bookings]);

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

  // Calendar utility functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter(event =>
      formatDate(event.date) === formatDate(date)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) return <div>Loading bookings...</div>;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">New booking added!</span>
        </div>
      )}

      {/* Welcome Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">Welcome back, Mikki Mamaradlo! 👋</h1>
            <p className="text-[var(--muted)]">Manage your bookings and discover equipment</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-xs text-[var(--muted)]">Member since</div>
            <div className="font-semibold text-[var(--foreground)]">2025</div>
          </div>
        </div>
      </div>

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

      {/* Calendar */}
      <div className="card p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>

          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center font-semibold text-[var(--muted)] text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: getFirstDayOfMonth(currentDate) }, (_, i) => (
            <div key={`empty-${i}`} className="p-2 min-h-[100px] bg-[var(--surface-secondary)] rounded-lg opacity-30"></div>
          ))}

          {/* Days of the month */}
          {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => {
            const day = i + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const eventsForDay = getEventsForDate(date);
            const isToday = formatDate(date) === formatDate(new Date());

            return (
              <div
                key={day}
                className={`p-2 min-h-[100px] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer ${
                  isToday ? 'bg-[var(--primary)]/10 border-[var(--primary)]' : 'bg-[var(--surface)]'
                }`}
              >
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-[var(--primary)] font-bold' : 'text-[var(--foreground)]'}`}>
                  {day}
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {eventsForDay.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded truncate ${
                        event.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : event.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : event.status === 'completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                      title={`${event.serviceName} - ₱${event.totalPrice}`}
                    >
                      {event.serviceName}
                    </div>
                  ))}

                  {eventsForDay.length > 3 && (
                    <div className="text-xs text-[var(--muted)] font-medium">
                      +{eventsForDay.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <h3 className="text-lg font-semibold mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-100 rounded"></div>
              <span className="text-sm text-[var(--muted)]">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-100 rounded"></div>
              <span className="text-sm text-[var(--muted)]">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 rounded"></div>
              <span className="text-sm text-[var(--muted)]">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span className="text-sm text-[var(--muted)]">Other</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--primary)]">{calendarEvents.length}</div>
              <div className="text-sm text-[var(--muted)]">Total Bookings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {calendarEvents.filter(e => e.status === 'confirmed').length}
              </div>
              <div className="text-sm text-[var(--muted)]">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--primary)]">
                ₱{calendarEvents.reduce((sum, event) => sum + event.totalPrice, 0).toLocaleString()}
              </div>
              <div className="text-sm text-[var(--muted)]">Total Value</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
