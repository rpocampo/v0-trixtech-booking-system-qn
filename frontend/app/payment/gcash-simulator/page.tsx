'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function GCashSimulatorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const amount = searchParams.get('amount');

  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Auto-redirect after 3 seconds for demo purposes
    const timer = setTimeout(() => {
      handlePayment(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handlePayment = async (success: boolean) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (success) {
        setPaymentStatus('success');

        // Call the test payment completion endpoint
        const response = await fetch(`http://localhost:5000/api/payments/test-complete/${transactionId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            success: true,
            referenceNumber: `GCASH_${Date.now()}`,
          }),
        });

        if (response.ok) {
          // Redirect to success page after a delay
          setTimeout(() => {
            router.push('/customer/bookings?payment=success');
          }, 2000);
        } else {
          throw new Error('Payment completion failed');
        }
      } else {
        setPaymentStatus('failed');
        setTimeout(() => {
          router.push('/customer/bookings?payment=failed');
        }, 3000);
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
      setTimeout(() => {
        router.push('/customer/bookings?payment=error');
      }, 3000);
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus) {
      case 'pending':
        return 'Preparing payment...';
      case 'processing':
        return 'Processing payment...';
      case 'success':
        return 'Payment successful! Redirecting...';
      case 'failed':
        return 'Payment failed. Redirecting...';
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
        {/* GCash Logo/Branding */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">₱</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">GCash Payment</h1>
          <p className="text-gray-600">Sandbox Environment</p>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-600 mb-2">Transaction ID</div>
          <div className="font-mono text-sm bg-white p-2 rounded border mb-4">
            {transactionId}
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

          {paymentStatus === 'pending' && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">
                This will auto-complete in a few seconds...
              </p>
            </div>
          )}

          {paymentStatus === 'processing' && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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

        {/* Manual Test Buttons (only in development) */}
        {process.env.NODE_ENV !== 'production' && paymentStatus === 'pending' && (
          <div className="space-y-2">
            <button
              onClick={() => handlePayment(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              Simulate Success
            </button>
            <button
              onClick={() => handlePayment(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
            >
              Simulate Failure
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-xs text-gray-500">
          <p>TRIXTECH Booking System - GCash Sandbox</p>
          <p>This is a test environment for development purposes</p>
        </div>
      </div>
    </div>
  );
}

function GCashSimulatorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GCashSimulatorContent />
    </Suspense>
  );
}

export default GCashSimulatorPage;