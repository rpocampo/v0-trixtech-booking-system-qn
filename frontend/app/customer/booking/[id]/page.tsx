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
  const [recommendations, setRecommendations] = useState<Service[]>([]);

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
          quantity: booking.quantity,
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
    </div>
  );
}
