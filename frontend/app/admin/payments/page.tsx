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
    fetchAllPayments();
  }, []);

  const fetchAllPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch all payments instead of just flagged ones
      const response = await fetch('http://localhost:5000/api/payments/all', {
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
        <h1 className="text-2xl font-bold text-gray-800">All Payments</h1>
        <p className="text-gray-600">View all payment transactions including OCR-verified ones</p>
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
                  {isPendingReview && (
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                    >
                      Review
                    </button>
                  )}
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
    </div>
  );
}