'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState({
    bookingDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId,
          bookingDate: booking.bookingDate,
          notes: booking.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Booking failed');
        return;
      }

      router.push('/customer/bookings');
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
              <span className="text-[var(--muted)]">Price:</span>
              <span className="text-[var(--primary)] font-bold">${service.price}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Book Your Service</h2>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Booking Date & Time</label>
              <input
                type="datetime-local"
                value={booking.bookingDate}
                onChange={(e) => setBooking({ ...booking, bookingDate: e.target.value })}
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <textarea
                value={booking.notes}
                onChange={(e) => setBooking({ ...booking, notes: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Any special requests or notes..."
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Processing...' : 'Confirm Booking'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
