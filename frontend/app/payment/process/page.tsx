'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '../../../components/CartContext';
import QRCode from 'qrcode';

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

interface User {
  _id: string;
  name: string;
  email: string;
}

function PaymentProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const bookingId = searchParams.get('bookingId');
  const amountParam = searchParams.get('amount');
  const paymentTypeParam = searchParams.get('paymentType');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  // QR-only payment system - no method selection needed
  const [qrPayment, setQrPayment] = useState<{
    qrCode: string;
    qrData?: string; // Raw QR data if provided
    instructions: any;
    referenceNumber: string;
    transactionId: string;
  } | null>(null);
  const [generatedQRCode, setGeneratedQRCode] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<string>('full');
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  useEffect(() => {
    if (bookingId && amountParam && paymentTypeParam) {
      // Parameters provided via URL - use them directly
      setPaymentAmount(parseFloat(amountParam));
      setPaymentType(paymentTypeParam);
      fetchBookingDetails();
    } else if (bookingId) {
      // Fallback: try to get from localStorage
      const pendingPayment = localStorage.getItem('pendingPayment');
      if (pendingPayment) {
        try {
          const paymentData = JSON.parse(pendingPayment);
          if (paymentData.bookingId === bookingId) {
            setPaymentAmount(paymentData.amount);
            setPaymentType(paymentData.paymentType);
            fetchBookingDetails();
            return;
          }
        } catch (e) {
          console.error('Error parsing pending payment data:', e);
        }
      }
      // Fallback to old behavior
      fetchBookingDetails();
    } else {
      setError('No booking ID provided');
      setLoading(false);
    }
  }, [bookingId, amountParam, paymentTypeParam]);

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

    console.log('Creating payment intent for booking:', bookingId);
    setCreatingPayment(true);
    setError('');
    setQrPayment(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to continue');
      }

      // Get user profile first
      const userResponse = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.user) {
          setUser(userData.user);
          console.log('User profile loaded:', userData.user.name);
        } else {
          console.warn('User profile fetch returned success but no user data');
          setUser(null);
        }
      } else {
        console.warn('User profile fetch failed:', userResponse.status);
        setUser(null);
      }

      // First, get the booking details to get the amount
      console.log('Fetching booking details for ID:', bookingId);
      const bookingResponse = await fetch(`http://localhost:5000/api/bookings/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (bookingResponse.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      }

      if (bookingResponse.status === 403) {
        throw new Error('This booking is no longer accessible. Please create a new booking.');
      }

      if (!bookingResponse.ok) {
        throw new Error('Failed to load booking details');
      }

      const bookingData = await bookingResponse.json();
      if (!bookingData.success) {
        throw new Error('Invalid booking data');
      }

      console.log('Booking data loaded:', bookingData.booking);
      setBooking(bookingData.booking);

      // Create QR payment using the payment amount (may be different from total price for down payments)
      console.log('Creating QR payment for amount:', paymentAmount, 'payment type:', paymentType);
      await createQRPayment(paymentAmount, token);
    } catch (error) {
      console.error('Error creating payment:', error);
      setError(error instanceof Error ? error.message : 'Failed to initiate payment');
      setCreatingPayment(false);
      setLoading(false); // Set loading to false on error
    }
  };

  const createQRPayment = async (amount: number, token: string, retryCount = 0) => {
    try {
      console.log(`Creating QR payment (attempt ${retryCount + 1}) for amount:`, amount);
      const response = await fetch('http://localhost:5000/api/payments/create-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          amount,
          paymentType,
        }),
      });

      console.log('QR payment API response status:', response.status);

      if (response.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      }

      const data = await response.json();
      console.log('QR payment API response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create QR payment');
      }

      if (data.success) {
        console.log('QR payment created successfully:', data);

        // Check if qrCode contains raw QR data (starts with numbers) or is already a data URL
        let qrCodeToUse = data.qrCode;
        let qrData = undefined;

        if (data.qrCode && data.qrCode.startsWith('000201')) {
          // This is raw QR data, generate QR code from it
          qrData = data.qrCode;
          // Generate QR code from raw data
          generateQRCodeFromData(data.qrCode);
        }

        setQrPayment({
          qrCode: qrCodeToUse,
          qrData: qrData,
          instructions: data.instructions,
          referenceNumber: data.referenceNumber,
          transactionId: data.transactionId,
        });
        setCreatingPayment(false);
        setLoading(false); // Set loading to false when QR payment is ready
        setShowReceiptUpload(true); // Show receipt upload form instead of polling
      } else {
        throw new Error('Invalid QR payment response');
      }
    } catch (error) {
      console.error('QR payment creation failed:', error);

      // Retry up to 2 times with exponential backoff
      if (retryCount < 2) {
        console.log(`Retrying QR payment creation (attempt ${retryCount + 1})...`);
        setTimeout(() => {
          createQRPayment(amount, token, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000); // 1s, 2s, 4s delays
      } else {
        setCreatingPayment(false);
        setLoading(false); // Set loading to false when all retries fail
        setError(error instanceof Error ? error.message : 'Failed to generate QR code after multiple attempts');
      }
    }
  };



  const generateQRCodeFromData = async (qrData: string) => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      setGeneratedQRCode(qrCodeDataURL);
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code from data:', error);
      setError('Failed to generate QR code');
      return null;
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
                  <span>Payment Amount:</span>
                  <span className="text-green-600">₱{paymentAmount.toFixed(2)}</span>
                </div>
                {paymentType === 'down_payment' && booking && (
                  <div className="text-sm text-gray-600 mt-1">
                    Down payment (30% of ₱{booking.totalPrice.toFixed(2)})
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {qrPayment && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Scan QR Code to Pay</h3>
              <p className="text-gray-600 mb-2">Scan on the GCash app</p>
              {user && user.name && (
                <p className="text-sm text-gray-500">Payment for: {user.name.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' ')}</p>
              )}
            </div>

            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 relative">
                {generatedQRCode || (qrPayment.qrCode && !qrPayment.qrCode.startsWith('000201')) ? (
                  <img
                    src={generatedQRCode || qrPayment.qrCode}
                    alt="GCash QR Code"
                    className="w-64 h-64 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      // Try multiple GCash URL schemes to ensure compatibility
                      const gcashUrls = [
                        `gcash://pay?amount=${paymentAmount.toFixed(2)}&reference=${qrPayment.referenceNumber}`,
                        `gcash://pay?amount=${paymentAmount.toFixed(2)}`,
                        'gcash://', // Just open GCash app
                      ];

                      let opened = false;
                      for (const url of gcashUrls) {
                        try {
                          window.location.href = url;
                          opened = true;
                          console.log('Opened GCash with:', url);
                          break;
                        } catch (e) {
                          console.log('Failed to open:', url);
                        }
                      }

                      // Fallback: redirect to Play Store if app not installed
                      if (!opened) {
                        setTimeout(() => {
                          window.location.href = 'https://play.google.com/store/apps/details?id=com.globe.gcash.android';
                        }, 1000);
                      }
                    }}
                    onLoad={() => console.log('QR code loaded successfully')}
                    onError={(e) => {
                      console.error('QR code failed to load, src:', qrPayment.qrCode);
                      e.currentTarget.style.display = 'none';
                      // Show error message instead
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'w-64 h-64 flex items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg';
                      errorDiv.innerHTML = `
                        <div class="text-center text-red-600">
                          <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <p class="text-sm font-medium">QR Code Failed to Load</p>
                          <button onclick="window.location.reload()" class="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">
                            Retry
                          </button>
                        </div>
                      `;
                      e.currentTarget.parentNode?.replaceChild(errorDiv, e.currentTarget);
                    }}
                  />
                ) : qrPayment.qrData ? (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 border-2 border-gray-300 rounded-lg">
                    <div className="text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <p className="text-sm">Generating QR Code...</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 border-2 border-gray-300 rounded-lg">
                    <div className="text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <p className="text-sm">Loading QR Code...</p>
                    </div>
                  </div>
                )}
                {user && user.name && qrPayment.qrCode && (
                  <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-center font-medium">
                    {user.name.split(' ').map(n => n.charAt(0).toUpperCase()).join(' ')}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">Payment Instructions:</h4>
              <ol className="text-sm text-blue-700 space-y-1">
                {qrPayment.instructions.instructions.map((instruction: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="font-medium mr-2">{index + 1}.</span>
                    {instruction}
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Reference:</span>
                  <div className="font-mono text-gray-800">{qrPayment.referenceNumber}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Amount:</span>
                  <div className="font-bold text-green-600">₱{paymentAmount.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Receipt Upload Section */}
            {showReceiptUpload && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Upload Payment Receipt</h3>
                <p className="text-sm text-blue-700 mb-4">
                  After completing your GCash payment, take a screenshot of the receipt and upload it here for verification.
                </p>

                {receiptError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-800 text-sm">{receiptError}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipt Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) { // 5MB limit
                            setReceiptError('File size must be less than 5MB');
                            setReceiptFile(null);
                          } else {
                            setReceiptError('');
                            setReceiptFile(file);
                          }
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum file size: 5MB. Supported formats: JPG, PNG, etc.</p>
                  </div>

                  <button
                    onClick={async () => {
                      if (!receiptFile) {
                        setReceiptError('Please select a receipt image');
                        return;
                      }

                      setUploadingReceipt(true);
                      setReceiptError('');

                      try {
                        const token = localStorage.getItem('token');
                        const formData = new FormData();
                        formData.append('receipt', receiptFile);
                        formData.append('expectedAmount', paymentAmount.toString());

                        const response = await fetch(`http://localhost:5000/api/payments/verify-receipt/${qrPayment.referenceNumber}`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                          },
                          body: formData,
                        });

                        const data = await response.json();

                        if (response.ok && data.success) {
                          setPaymentStatus('completed');
                          clearCart();
                          setTimeout(() => {
                            router.push('/customer/bookings?payment=success');
                          }, 2000);
                        } else {
                          if (data.flaggedForReview) {
                            setReceiptError('Receipt verification failed. Your payment has been flagged for manual review by our team. You will be notified once verified.');
                          } else {
                            setReceiptError(data.message || 'Receipt verification failed');
                          }
                        }
                      } catch (error) {
                        console.error('Receipt upload failed:', error);
                        setReceiptError('Failed to upload receipt. Please try again.');
                      } finally {
                        setUploadingReceipt(false);
                      }
                    }}
                    disabled={uploadingReceipt || !receiptFile}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                  >
                    {uploadingReceipt ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Verifying Receipt...
                      </>
                    ) : (
                      'Verify Receipt'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Status */}
            <div className="mt-4 text-center">
              {paymentStatus === 'pending' && !showReceiptUpload && (
                <div className="space-y-3">
                  <div className="inline-flex items-center text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Preparing payment...
                  </div>
                </div>
              )}
              {paymentStatus === 'pending' && showReceiptUpload && (
                <div className="inline-flex items-center text-blue-600">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Waiting for receipt upload and verification...
                </div>
              )}
              {paymentStatus === 'completed' && (
                <div className="inline-flex items-center text-green-600">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Payment completed! Redirecting...
                </div>
              )}
              {paymentStatus === 'failed' && (
                <div className="inline-flex items-center text-red-600">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Payment failed. Please try again.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {creatingPayment ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Generating QR code...</p>
            </div>
          ) : qrPayment && !showReceiptUpload ? (
            // QR Payment generated but not yet showing receipt upload
            <div className="space-y-3">
              <button
                onClick={() => setShowReceiptUpload(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
              >
                I've Completed the Payment - Upload Receipt
              </button>

              {paymentStatus === 'failed' && (
                <button
                  onClick={() => {
                    setQrPayment(null);
                    setPaymentStatus('pending');
                    setShowReceiptUpload(false);
                    createPaymentIntent();
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                >
                  Generate New QR Code
                </button>
              )}

              <button
                onClick={() => router.back()}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
                disabled={paymentStatus === 'completed'}
              >
                {paymentStatus === 'completed' ? 'Redirecting...' : 'Cancel'}
              </button>
            </div>
          ) : qrPayment && showReceiptUpload ? (
            // Receipt upload is active
            <div className="space-y-3">
              <button
                onClick={() => setShowReceiptUpload(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                disabled={uploadingReceipt}
              >
                Back to QR Code
              </button>

              <button
                onClick={() => router.back()}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
                disabled={paymentStatus === 'completed' || uploadingReceipt}
              >
                {paymentStatus === 'completed' ? 'Redirecting...' : 'Cancel'}
              </button>
            </div>
          ) : (
            // Initial state - generate QR code for payment
            <>
              <button
                onClick={createPaymentIntent}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
              >
                Generate QR Code
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