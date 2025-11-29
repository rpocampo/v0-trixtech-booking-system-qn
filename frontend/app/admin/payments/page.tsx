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
        issues: string[];
        extractedAmount: number;
        extractedReference: string;
      };
      flaggedForReview: boolean;
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

  useEffect(() => {
    fetchFlaggedPayments();
  }, []);

  const fetchFlaggedPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/payments/flagged', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPayments(data.payments);
        } else {
          setError(data.message || 'Failed to fetch payments');
        }
      } else {
        setError('Failed to fetch flagged payments');
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
          fetchFlaggedPayments(); // Refresh the list
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
        <h1 className="text-2xl font-bold text-gray-800">Payment Reviews</h1>
        <p className="text-gray-600">Review payments flagged for manual verification</p>
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
          {payments.map((payment) => (
            <div key={payment._id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    ₱{payment.amount.toFixed(2)} - {payment.referenceNumber}
                  </h3>
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
                <button
                  onClick={() => setSelectedPayment(payment)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                >
                  Review
                </button>
              </div>

              {payment.paymentData.receiptVerification?.validation && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">OCR Results</h4>
                  <div className="text-sm text-yellow-700">
                    <p>Extracted Amount: ₱{payment.paymentData.receiptVerification.validation.extractedAmount || 'Not found'}</p>
                    <p>Extracted Reference: {payment.paymentData.receiptVerification.validation.extractedReference || 'Not found'}</p>
                    <p>Issues: {payment.paymentData.receiptVerification.validation.issues.join(', ') || 'None'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
}