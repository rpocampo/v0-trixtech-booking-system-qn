'use client';

import { useEffect, useState } from 'react';

interface Payment {
  _id: string;
  amount: number;
  referenceNumber: string;
  status: string;
  createdAt: string;
  userId: {
    name: string;
    email: string;
  };
  bookingId?: {
    _id: string;
    serviceId: {
      name: string;
    };
  };
  paymentData: {
    receiptVerification: {
      extractedData?: {
        amount: number;
        reference: string;
        confidence: string;
        rawText: string;
      };
      validation?: {
        isValid?: boolean;
        amountMatch?: boolean;
        referenceMatch?: boolean;
        issues: string[];
        extractedAmount: number;
        extractedReference: string;
      };
      flaggedForReview: boolean;
      uploadedImage?: string;
    };
  };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [imageModal, setImageModal] = useState<{
    open: boolean;
    imageUrl: string;
    title: string;
    zoom: number;
    loading: boolean;
    error: boolean;
    loadTimeout?: NodeJS.Timeout;
  }>({
    open: false,
    imageUrl: '',
    title: '',
    zoom: 1,
    loading: false,
    error: false
  });

  useEffect(() => {
    fetchAllPayments();
  }, []);

  const fetchAllPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch all payments instead of just flagged ones
      const response = await fetch(`http://localhost:5000/api/payments/all?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Debug: Log payment data to see what's returned
          console.log('Fetched payments data:', data.payments.map((p: any) => ({
            id: p._id,
            reference: p.referenceNumber,
            hasReceiptVerification: !!p.paymentData?.receiptVerification,
            uploadedImage: p.paymentData?.receiptVerification?.uploadedImage,
            status: p.status
          })));

          // Find the specific payment the user mentioned
          const specificPayment = data.payments.find((p: any) => p.referenceNumber === 'QR_1764461434332_IVDTPH');
          if (specificPayment) {
            console.log('Specific payment QR_1764461434332_IVDTPH data:', {
              id: specificPayment._id,
              reference: specificPayment.referenceNumber,
              paymentData: specificPayment.paymentData,
              receiptVerification: specificPayment.paymentData?.receiptVerification,
              uploadedImage: specificPayment.paymentData?.receiptVerification?.uploadedImage
            });
          }

          setPayments(data.payments);
        } else {
          setError(data.message || 'Failed to fetch payments');
        }
      } else {
        setError('Failed to fetch payments');
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (paymentId: string, action: 'approve' | 'reject') => {
    if (!reviewNotes.trim() && action === 'reject') {
      alert('Please provide notes for rejection');
      return;
    }

    setReviewing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/payments/${paymentId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          notes: reviewNotes.trim()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert(`Payment ${action}d successfully`);
          setSelectedPayment(null);
          setReviewNotes('');
          fetchAllPayments(); // Refresh the list
        } else {
          alert(data.message || 'Failed to process review');
        }
      } else {
        alert('Failed to process review');
      }
    } catch (error) {
      console.error('Error reviewing payment:', error);
      alert('Network error');
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">All Payments</h1>
            <p className="text-gray-600">View all payment transactions including OCR-verified ones</p>
            <p className="text-xs text-gray-500 mt-1">
              💡 Click "Refresh" to see the latest payment updates and receipt images
            </p>
          </div>
          <button
            onClick={fetchAllPayments}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No payments flagged for review</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment) => {
            const isOcrVerified = payment.paymentData?.receiptVerification?.validation?.isValid;
            const isCompleted = payment.status === 'completed';
            const isPendingReview = payment.status === 'pending_review';

            return (
              <div key={payment._id} className={`border rounded-lg p-6 ${
                isCompleted && isOcrVerified ? 'bg-green-50 border-green-200' :
                isPendingReview ? 'bg-yellow-50 border-yellow-200' :
                'bg-white border-gray-200'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        ₱{payment.amount.toFixed(2)} - {payment.referenceNumber}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        isCompleted && isOcrVerified ? 'bg-green-100 text-green-800' :
                        isCompleted ? 'bg-blue-100 text-blue-800' :
                        isPendingReview ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {isCompleted && isOcrVerified ? 'OCR Verified' :
                         isCompleted ? 'Completed' :
                         isPendingReview ? 'Needs Review' :
                         payment.status}
                      </span>
                    </div>
                    <p className="text-gray-600">
                      {payment.userId.name} ({payment.userId.email})
                    </p>
                    {payment.bookingId && (
                      <p className="text-sm text-gray-500">
                        Service: {payment.bookingId.serviceId.name}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      Created: {new Date(payment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Debug: Log the specific payment data
                        console.log('View Image clicked for payment:', {
                          paymentId: payment._id,
                          referenceNumber: payment.referenceNumber,
                          paymentData: payment.paymentData,
                          receiptVerification: payment.paymentData?.receiptVerification,
                          uploadedImage: payment.paymentData?.receiptVerification?.uploadedImage
                        });

                        // Check for uploaded image in receipt verification data
                        const uploadedImage = payment.paymentData?.receiptVerification?.uploadedImage;

                        if (uploadedImage) {
                          const fullImageUrl = `http://localhost:5000${uploadedImage}?t=${Date.now()}`;
                          console.log('Opening modal with image URL:', fullImageUrl);

                          // Clear any existing timeout
                          if (imageModal.loadTimeout) {
                            clearTimeout(imageModal.loadTimeout);
                          }

                          // Preload image to detect load success/failure
                          const img = new Image();
                          let timeoutTriggered = false;

                          // Set up a timeout to handle stuck loading state
                          const timeout = setTimeout(() => {
                            timeoutTriggered = true;
                            console.log('Image load timeout, showing error state');
                            setImageModal(prev => ({
                              ...prev,
                              loading: false,
                              error: true,
                              loadTimeout: undefined
                            }));
                          }, 10000); // 10 second timeout

                          img.onload = () => {
                            if (!timeoutTriggered) {
                              clearTimeout(timeout);
                              console.log('Image loaded successfully:', fullImageUrl);
                              setImageModal({
                                open: true,
                                imageUrl: fullImageUrl,
                                title: `Receipt for ₱${payment.amount.toFixed(2)} - ${payment.referenceNumber}`,
                                zoom: 1,
                                loading: false,
                                error: false
                              });
                            }
                          };

                          img.onerror = () => {
                            if (!timeoutTriggered) {
                              clearTimeout(timeout);
                              console.error('Image failed to load:', fullImageUrl);
                              setImageModal({
                                open: true,
                                imageUrl: fullImageUrl,
                                title: `Receipt for ₱${payment.amount.toFixed(2)} - ${payment.referenceNumber}`,
                                zoom: 1,
                                loading: false,
                                error: true
                              });
                            }
                          };

                          // Start loading the image
                          img.src = fullImageUrl;

                          // Show modal in loading state immediately
                          setImageModal({
                            open: true,
                            imageUrl: fullImageUrl,
                            title: `Receipt for ₱${payment.amount.toFixed(2)} - ${payment.referenceNumber}`,
                            zoom: 1,
                            loading: true,
                            error: false,
                            loadTimeout: timeout
                          });
                        } else {
                          console.log('No uploaded image found for payment:', payment._id);
                          // For payments without uploaded images, show a text message
                          setImageModal({
                            open: true,
                            imageUrl: '', // Empty image URL for text-only display
                            title: `Payment ₱${payment.amount.toFixed(2)} - ${payment.referenceNumber} (No Receipt Uploaded)`,
                            zoom: 1,
                            loading: false,
                            error: false
                          });
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-sm"
                      title="View customer's uploaded receipt image"
                    >
                      📷 View Image
                    </button>
                    {isPendingReview && (
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>

                {payment.paymentData?.receiptVerification?.validation && (
                  <div className={`border rounded-lg p-4 ${
                    isOcrVerified ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <h4 className={`font-semibold mb-2 ${
                      isOcrVerified ? 'text-green-800' : 'text-red-800'
                    }`}>
                      OCR Verification Results
                    </h4>
                    <div className={`text-sm ${
                      isOcrVerified ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <p>Extracted Amount: ₱{payment.paymentData.receiptVerification.validation.extractedAmount || 'Not found'}</p>
                      <p>Extracted Reference: {payment.paymentData.receiptVerification.validation.extractedReference || 'Not found'}</p>
                      <p>Amount Match: {payment.paymentData.receiptVerification.validation.amountMatch ? '✅' : '❌'}</p>
                      <p>Reference Match: {payment.paymentData.receiptVerification.validation.referenceMatch ? '✅' : '❌'}</p>
                      {payment.paymentData.receiptVerification.validation.issues.length > 0 && (
                        <p>Issues: {payment.paymentData.receiptVerification.validation.issues.join(', ')}</p>
                      )}
                    </div>
                  </div>
                )}

                {isCompleted && isOcrVerified && (
                  <div className="mt-4 bg-green-100 border border-green-300 rounded-lg p-3">
                    <div className="flex items-center text-green-800">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Successfully verified via OCR</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Review Payment</h2>

              <div className="mb-6">
                <h3 className="font-semibold text-gray-800">Payment Details</h3>
                <div className="mt-2 text-sm text-gray-600">
                  <p><strong>Amount:</strong> ₱{selectedPayment.amount.toFixed(2)}</p>
                  <p><strong>Reference:</strong> {selectedPayment.referenceNumber}</p>
                  <p><strong>Customer:</strong> {selectedPayment.userId.name} ({selectedPayment.userId.email})</p>
                  {selectedPayment.bookingId && (
                    <p><strong>Service:</strong> {selectedPayment.bookingId.serviceId.name}</p>
                  )}
                </div>
              </div>

              {selectedPayment.paymentData.receiptVerification?.extractedData && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800">OCR Extracted Data</h3>
                  <div className="mt-2 p-4 bg-gray-50 rounded text-sm">
                    <p><strong>Amount Found:</strong> ₱{selectedPayment.paymentData.receiptVerification.extractedData.amount || 'None'}</p>
                    <p><strong>Reference Found:</strong> {selectedPayment.paymentData.receiptVerification.extractedData.reference || 'None'}</p>
                    <p><strong>Confidence:</strong> {selectedPayment.paymentData.receiptVerification.extractedData.confidence}</p>
                    <div className="mt-2">
                      <strong>Raw OCR Text:</strong>
                      <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                        {selectedPayment.paymentData.receiptVerification.extractedData.rawText}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (required for rejection)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Enter notes about your decision..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleReview(selectedPayment._id, 'approve')}
                  disabled={reviewing}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                >
                  {reviewing ? 'Processing...' : 'Approve Payment'}
                </button>
                <button
                  onClick={() => handleReview(selectedPayment._id, 'reject')}
                  disabled={reviewing}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                >
                  {reviewing ? 'Processing...' : 'Reject Payment'}
                </button>
                <button
                  onClick={() => {
                    setSelectedPayment(null);
                    setReviewNotes('');
                  }}
                  disabled={reviewing}
                  className="px-6 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 text-gray-800 font-semibold py-3 rounded-lg transition duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">{imageModal.title}</h2>
                <div className="flex items-center gap-3">
                  {imageModal.imageUrl && !imageModal.error && (
                    <>
                      {/* Zoom Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setImageModal(prev => ({ ...prev, zoom: Math.max(0.25, prev.zoom - 0.25) }))}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm font-medium"
                          title="Zoom Out"
                        >
                          🔍-
                        </button>
                        <span className="text-sm text-gray-600 min-w-[60px] text-center">
                          {Math.round(imageModal.zoom * 100)}%
                        </span>
                        <button
                          onClick={() => setImageModal(prev => ({ ...prev, zoom: Math.min(3, prev.zoom + 0.25) }))}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm font-medium"
                          title="Zoom In"
                        >
                          🔍+
                        </button>
                      </div>

                      {/* Download Button */}
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = imageModal.imageUrl;
                          link.download = `receipt-${imageModal.title.replace(/[^a-zA-Z0-9]/g, '-')}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm"
                        title="Download Image"
                      >
                        💾 Download
                      </button>
                    </>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      // Clear any existing timeout
                      if (imageModal.loadTimeout) {
                        clearTimeout(imageModal.loadTimeout);
                      }
                      setImageModal({
                        open: false,
                        imageUrl: '',
                        title: '',
                        zoom: 1,
                        loading: false,
                        error: false
                      });
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl ml-2"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex justify-center items-center min-h-[60vh]">
                {imageModal.loading ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Loading image...</p>
                  </div>
                ) : imageModal.imageUrl && !imageModal.error ? (
                  <div className="bg-white rounded-lg shadow p-4 max-w-xl">
                    <img
                      src={imageModal.imageUrl}
                      alt="Receipt Image"
                      className="w-full rounded-lg"
                      onLoad={() => {
                        console.log('Image loaded successfully:', imageModal.imageUrl);
                        setImageModal(prev => {
                          if (prev.loadTimeout) {
                            clearTimeout(prev.loadTimeout);
                          }
                          return { ...prev, loading: false, error: false, loadTimeout: undefined };
                        });
                      }}
                      onError={() => {
                        console.error('Image failed to load:', imageModal.imageUrl);
                        setImageModal(prev => {
                          if (prev.loadTimeout) {
                            clearTimeout(prev.loadTimeout);
                          }
                          return { ...prev, loading: false, error: true, loadTimeout: undefined };
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center max-w-md">
                    <div className="text-6xl mb-4">📄</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {imageModal.imageUrl ? 'Image Unavailable' : 'No Receipt Image'}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {imageModal.imageUrl
                        ? 'The receipt image could not be loaded. The payment was verified successfully.'
                        : 'The customer did not upload a payment receipt image for this transaction. The payment was processed without receipt verification.'
                      }
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}