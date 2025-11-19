'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Booking {
  _id: string;
  serviceId: {
    name: string;
    category: string;
  };
  quantity: number;
  bookingDate: string;
  totalPrice: number;
  status: string;
}

function PaymentProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
    } else {
      setError('No booking ID provided');
      setLoading(false);
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to continue');
        setLoading(false);
        return;
      }

      await createPaymentIntent();
    } catch (error) {
      console.error('Error fetching booking:', error);
      setError('Failed to load booking details');
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    if (!bookingId) return;

    setCreatingPayment(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to continue');
      }

      // First, get the booking details to get the amount
      const bookingResponse = await fetch(`http://localhost:5000/api/bookings/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (bookingResponse.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      }

      if (!bookingResponse.ok) {
        throw new Error('Failed to load booking details');
      }

      const bookingData = await bookingResponse.json();
      if (!bookingData.success) {
        throw new Error('Invalid booking data');
      }

      setBooking(bookingData.booking);

      // Now create payment intent with the correct amount
      const response = await fetch('http://localhost:5000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          amount: bookingData.booking.totalPrice,
        }),
      });

      if (response.status === 401) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create payment intent');
      }

      if (data.success && data.paymentUrl) {
        // Redirect to GCash payment
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('Invalid payment response');
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      setError(error instanceof Error ? error.message : 'Failed to initiate payment');
      setCreatingPayment(false);
    }
  };

  const handleRetry = () => {
    setError('');
    createPaymentIntent();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Complete Your Payment</h1>
          <p className="text-gray-600 mt-2">Secure payment powered by GCash</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {booking && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{booking.serviceId.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">
                  {new Date(booking.bookingDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="font-medium">
                  {new Date(booking.bookingDate).toLocaleTimeString()}
                </span>
              </div>
              {booking.quantity > 1 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{booking.quantity}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span className="text-green-600">₱{booking.totalPrice}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {creatingPayment ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Preparing payment...</p>
            </div>
          ) : (
            <>
              <button
                onClick={createPaymentIntent}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
              >
                Pay with GCash
              </button>

              {error && (
                <button
                  onClick={handleRetry}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Try Again
                </button>
              )}

              <button
                onClick={() => router.back()}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🔒 Secure payment processed by GCash</p>
          <p>Your payment information is protected</p>
        </div>
      </div>
    </div>
  );
}

function PaymentProcessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentProcessContent />
    </Suspense>
  );
}

export default PaymentProcessPage;