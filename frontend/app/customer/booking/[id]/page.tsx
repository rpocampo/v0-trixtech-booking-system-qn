'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  quantity?: number;
  image?: string;
}

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState({
    quantity: 1,
    bookingDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [queued, setQueued] = useState(false);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Service[]>([]);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>('AM');
  const [dateTimeConfirmed, setDateTimeConfirmed] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    available: boolean;
    availableQuantity: number;
    reason?: string;
  } | null>(null);

  // Reset and check availability when selections change
  useEffect(() => {
    if (selectedDate) {
      setAvailabilityChecked(false);
      setAvailabilityStatus(null);

      // Auto-check availability when all required fields are selected
      const checkAutoAvailability = async () => {
        // Convert to 24-hour format
        let hour24 = selectedHour;
        if (selectedAmPm === 'PM' && selectedHour !== 12) {
          hour24 += 12;
        } else if (selectedAmPm === 'AM' && selectedHour === 12) {
          hour24 = 0;
        }

        const dateTime = new Date(selectedDate);
        dateTime.setHours(hour24, selectedMinute, 0, 0);

        await checkAvailability(dateTime, booking.quantity);
      };

      // Debounce the check to avoid too many API calls
      const timeoutId = setTimeout(checkAutoAvailability, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedDate, selectedHour, selectedMinute, selectedAmPm, booking.quantity]);

  useEffect(() => {
    const fetchService = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/services/${serviceId}`);
        const data = await response.json();
        if (data.success) {
          setService(data.service);
        }
      } catch (error) {
        console.error('Failed to fetch service:', error);
      } finally {
        setLoading(false);
      }
    };

    if (serviceId) {
      fetchService();
    }
  }, [serviceId]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!serviceId) return;

      try {
        const response = await fetch(`http://localhost:5000/api/analytics/recommendations/${serviceId}`);
        const data = await response.json();
        if (data.success) {
          setRecommendations(data.recommendations);
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      }
    };

    if (serviceId) {
      fetchRecommendations();
    }
  }, [serviceId]);

  const openDateTimePicker = () => {
    setShowDateTimePicker(true);
  };

  const checkAvailability = async (date: Date, quantity: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to check availability');
        return false;
      }

      const response = await fetch(`http://localhost:5000/api/bookings/check-availability/${serviceId}?date=${date.toISOString()}&quantity=${quantity}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setError('Your session has expired. Please log in again.');
        return false;
      }

      const data = await response.json();
      if (data.success) {
        setAvailabilityStatus({
          available: data.available,
          availableQuantity: data.availableQuantity,
          reason: data.reason,
        });
        setAvailabilityChecked(true);
        return data.available;
      } else {
        setError(data.message || 'Failed to check availability');
        return false;
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setError('Failed to check availability. Please try again.');
    }
    return false;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleTimeConfirm = async () => {
    if (!selectedDate) {
      setError('Please select a date first');
      return;
    }

    // Convert to 24-hour format
    let hour24 = selectedHour;
    if (selectedAmPm === 'PM' && selectedHour !== 12) {
      hour24 += 12;
    } else if (selectedAmPm === 'AM' && selectedHour === 12) {
      hour24 = 0;
    }

    const dateTime = new Date(selectedDate);
    dateTime.setHours(hour24, selectedMinute, 0, 0);

    // Check availability if not already checked
    if (!availabilityChecked) {
      const isAvailable = await checkAvailability(dateTime, booking.quantity);
      if (!isAvailable) {
        return; // Error already set in checkAvailability
      }
    } else if (!availabilityStatus?.available) {
      setError(availabilityStatus?.reason || 'Selected date/time is not available');
      return;
    }

    // Format as ISO string for the backend
    const isoString = dateTime.toISOString();
    setBooking({ ...booking, bookingDate: isoString });
    setDateTimeConfirmed(true);
    setShowDateTimePicker(false);
    setError('');

    // Scroll to notes section
    setTimeout(() => {
      document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!booking.bookingDate) {
      setError('Please select a date and time for your booking');
      setSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to make a booking');
        setSubmitting(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId,
          quantity: booking.quantity,
          bookingDate: booking.bookingDate,
          notes: booking.notes,
        }),
      });

      if (response.status === 401) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Booking failed');
        return;
      }

      if (data.queued) {
        // Item was queued, show alternatives
        setQueued(true);
        setAlternatives(data.alternatives || []);
        setError('');
      } else {
        // Booking confirmed successfully
        router.push('/customer/bookings');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!service) return <div>Service not found</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="text-[var(--primary)] hover:underline mb-6">
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-2">{service.name}</h1>
      <p className="text-[var(--muted)] mb-8">{service.description}</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Service Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between pb-3 border-b border-[var(--border)]">
              <span className="text-[var(--muted)]">Duration:</span>
              <span className="font-semibold">{service.duration} minutes</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-[var(--border)]">
              <span className="text-[var(--muted)]">Category:</span>
              <span className="font-semibold capitalize">{service.category}</span>
            </div>
            {service.category === 'equipment' && service.quantity !== undefined && (
              <div className="flex justify-between pb-3 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">Available:</span>
                <span className={`font-semibold ${service.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {service.quantity} {service.quantity === 1 ? 'item' : 'items'}
                </span>
              </div>
            )}
            <div className="flex justify-between pb-3 border-b border-[var(--border)]">
              <span className="text-[var(--muted)]">Price per unit:</span>
              <span className="text-[var(--primary)] font-bold">₱{service.price}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Book Your Service</h2>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {service.category === 'equipment' && (
              <div>
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={service.quantity}
                  value={booking.quantity}
                  onChange={(e) => setBooking({ ...booking, quantity: parseInt(e.target.value) || 1 })}
                  required
                  className="input-field"
                />
                <p className="text-sm text-[var(--muted)] mt-1">
                  Maximum available: {service.quantity} items
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Booking Date & Time</label>
              <button
                type="button"
                onClick={openDateTimePicker}
                className={`input-field text-left ${dateTimeConfirmed ? 'border-green-500 bg-green-50' : ''}`}
              >
                {booking.bookingDate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    {new Date(booking.bookingDate).toLocaleString()}
                  </div>
                ) : (
                  'Select date and time'
                )}
              </button>
              {dateTimeConfirmed && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <span>✓</span> Schedule selected successfully
                </p>
              )}
            </div>

            <div id="notes-section">
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <textarea
                value={booking.notes}
                onChange={(e) => setBooking({ ...booking, notes: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Any special requests or notes..."
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Booking Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Service:</span>
                  <span>{service.name}</span>
                </div>
                {service.category === 'equipment' && (
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{booking.quantity}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total Price:</span>
                  <span className="text-[var(--primary)]">₱{service.price * booking.quantity}</span>
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Processing...' : 'Confirm Booking'}
            </button>
          </form>
        </div>
      </div>

      {/* Date Time Picker Modal */}
      {showDateTimePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Select Date & Time</h3>

              {/* Date Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setSelectedDate(date);
                  }}
                  className="input-field"
                />
              </div>

              {/* Time Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Time</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                    className="input-field flex-1"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                      <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-lg">:</span>
                  <select
                    value={selectedMinute}
                    onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                    className="input-field flex-1"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map(minute => (
                      <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>

                {/* AM/PM Selection */}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAmPm('AM')}
                    className={`flex-1 py-2 px-4 rounded border ${
                      selectedAmPm === 'AM' ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAmPm('PM')}
                    className={`flex-1 py-2 px-4 rounded border ${
                      selectedAmPm === 'PM' ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300'
                    }`}
                  >
                    PM
                  </button>
                </div>

                {/* Availability Status */}
                {availabilityChecked && availabilityStatus && (
                  <div className={`mt-4 p-3 rounded ${
                    availabilityStatus.available
                      ? 'bg-green-100 border border-green-300'
                      : 'bg-red-100 border border-red-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={availabilityStatus.available ? 'text-green-600' : 'text-red-600'}>
                        {availabilityStatus.available ? '✓' : '✗'}
                      </span>
                      <span className={`text-sm font-medium ${
                        availabilityStatus.available ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {availabilityStatus.available
                          ? `Available (${availabilityStatus.availableQuantity} ${availabilityStatus.availableQuantity === 1 ? 'item' : 'items'} left)`
                          : availabilityStatus.reason
                        }
                      </span>
                    </div>
                  </div>
                )}

                {/* OK Button below AM/PM */}
                <button
                  type="button"
                  onClick={handleTimeConfirm}
                  disabled={!selectedDate || !availabilityChecked || !availabilityStatus?.available}
                  className={`w-full mt-4 font-semibold py-3 px-4 rounded ${
                    !selectedDate || !availabilityChecked || !availabilityStatus?.available
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {!selectedDate
                    ? 'Select a date first'
                    : !availabilityChecked
                      ? 'Checking availability...'
                      : availabilityStatus?.available
                        ? 'Confirm Selection'
                        : 'Not Available'
                  }
                </button>
              </div>

              {/* Cancel Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDateTimePicker(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">You might also like</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {recommendations.map((rec) => (
              <div key={rec._id} className="card p-4">
                {rec.image && (
                  <img
                    src={rec.image.startsWith('/uploads/') ? `http://localhost:5000${rec.image}` : rec.image}
                    alt={rec.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Image+Not+Available';
                    }}
                  />
                )}
                <h3 className="font-semibold mb-2">{rec.name}</h3>
                <p className="text-sm text-[var(--muted)] mb-3">{rec.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--primary)] font-bold">₱{rec.price}</span>
                  <Link href={`/customer/booking/${rec._id}`} className="text-sm text-blue-600 hover:underline">
                    Book Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queued Reservation Message */}
      {queued && (
        <div className="mt-8 card p-6 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">⏳</div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-700">Reservation Queued</h3>
              <p className="text-sm text-[var(--muted)]">
                Your requested item is currently unavailable. You've been added to the reservation queue with first-come, first-served priority.
              </p>
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Alternative Options Available:</h4>
              <div className="space-y-3">
                {alternatives.map((alt, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{alt.name}</span>
                      <span className="text-sm text-[var(--muted)] ml-2">
                        ₱{alt.price} • {alt.availableQuantity} available
                      </span>
                      <br />
                      <span className="text-xs text-[var(--muted)]">{alt.reason}</span>
                    </div>
                    <Link
                      href={`/customer/booking/${alt.serviceId}`}
                      className="btn-secondary text-sm"
                    >
                      Book This Instead
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>What happens next?</strong><br />
              • You'll be notified immediately when your reservation becomes available<br />
              • We'll process reservations in first-come, first-served order<br />
              • Check your notifications and bookings page for updates
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <Link href="/customer/bookings" className="btn-primary">
              View My Bookings
            </Link>
            <Link href="/customer/services" className="btn-secondary">
              Browse More Services
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
