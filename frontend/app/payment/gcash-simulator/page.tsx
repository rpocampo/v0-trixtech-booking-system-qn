'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PayMongoGCashContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const amount = searchParams.get('amount');

  const [paymentStatus, setPaymentStatus] = useState<'redirecting' | 'processing' | 'success' | 'failed'>('processing');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have required parameters and create PayMongo payment
    if (bookingId && amount) {
      createPayMongoPayment();
    } else {
      setPaymentStatus('failed');
    }
  }, [bookingId, amount]);

  const createPayMongoPayment = async () => {
    try {
      setPaymentStatus('processing');

      // Create payment intent via our backend
      const response = await fetch('http://localhost:5000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          bookingId: bookingId,
          amount: parseFloat(amount || '0'),
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        setRedirectUrl(data.paymentUrl);
        setPaymentStatus('redirecting');

        // Auto-redirect to PayMongo after showing status
        setTimeout(() => {
          window.location.href = data.paymentUrl;
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to create payment');
      }
    } catch (error) {
      console.error('PayMongo payment creation error:', error);
      setPaymentStatus('failed');
      setTimeout(() => {
        router.push('/customer/bookings?payment=error');
      }, 3000);
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'redirecting':
        return 'Redirecting to GCash...';
      case 'processing':
        return 'Setting up payment...';
      case 'success':
        return 'Payment successful! Redirecting...';
      case 'failed':
        return 'Payment setup failed. Redirecting...';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* PayMongo GCash Logo/Branding */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">₱</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">GCash Payment</h1>
          <p className="text-gray-600">PayMongo Integration</p>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-600 mb-2">Booking ID</div>
          <div className="font-mono text-sm bg-white p-2 rounded border mb-4">
            {bookingId}
          </div>

          <div className="text-sm text-gray-600 mb-2">Amount</div>
          <div className="text-2xl font-bold text-green-600">
            ₱{amount}
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          <div className={`text-lg font-semibold ${getStatusColor()}`}>
            {getStatusMessage()}
          </div>

          {paymentStatus === 'redirecting' && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">
                You will be redirected to GCash to complete your payment...
              </p>
              {redirectUrl && (
                <p className="text-xs text-gray-400 mt-2">
                  If not redirected automatically, <a href={redirectUrl} className="text-blue-600 underline">click here</a>
                </p>
              )}
            </div>
          )}

          {paymentStatus === 'processing' && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">
                Setting up your payment...
              </p>
            </div>
          )}

          {paymentStatus === 'success' && (
            <div className="mt-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="mt-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Manual redirect button */}
        {paymentStatus === 'redirecting' && redirectUrl && (
          <div className="space-y-2">
            <button
              onClick={() => window.location.href = redirectUrl}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded"
            >
              Continue to GCash
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-xs text-gray-500">
          <p>TRIXTECH Booking System - PayMongo GCash</p>
          <p>Secure payment processing powered by PayMongo</p>
        </div>
      </div>
    </div>
  );
}

function PayMongoGCashPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PayMongoGCashContent />
    </Suspense>
  );
}

export default PayMongoGCashPage;