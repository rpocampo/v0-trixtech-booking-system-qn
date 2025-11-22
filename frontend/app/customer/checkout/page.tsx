'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../../components/CartContext';
import { useSocket } from '../../../components/SocketProvider';

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  serviceType: string;
  category: string;
  image?: string;
  bookingDate?: string;
  notes?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const {
    items,
    clearCart,
    getTotalItems,
    getTotalPrice,
    validateStockAvailability,
    refreshStockData,
  } = useCart();

  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stockValidationIssues, setStockValidationIssues] = useState<string[]>([]);
  const [isValidatingStock, setIsValidatingStock] = useState(false);
  const [currentStep, setCurrentStep] = useState<'review' | 'schedule' | 'confirm' | 'payment-type' | 'payment'>('review');
  const [scheduledItems, setScheduledItems] = useState<{ [key: string]: { date: string; notes: string } }>({});
  const [paymentBooking, setPaymentBooking] = useState<any>(null);
  const [checkoutTotal, setCheckoutTotal] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'full' | 'down_payment'>('full');
  const [downPaymentAmount, setDownPaymentAmount] = useState<number>(0);
  const [qrPayment, setQrPayment] = useState<{
    qrCode: string;
    instructions: any;
    referenceNumber: string;
    transactionId: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Initialize checkout items from cart
  useEffect(() => {
    if (items.length === 0) {
      router.push('/customer/cart');
      return;
    }

    const initialCheckoutItems: CheckoutItem[] = items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      serviceType: item.serviceType,
      category: item.category,
      image: item.image,
    }));

    setCheckoutItems(initialCheckoutItems);
  }, [items, router]);

  // Validate stock on load
  useEffect(() => {
    if (checkoutItems.length > 0) {
      validateStock();
    }
  }, [checkoutItems]);

  // Auto-generate QR code when payment step is reached
  useEffect(() => {
    console.log('🔄 Payment step effect triggered:', {
      currentStep,
      hasPaymentBooking: !!paymentBooking,
      paymentBookingId: paymentBooking?._id,
      checkoutTotal,
      hasQrPayment: !!qrPayment,
      creatingPayment
    });

    if (currentStep === 'payment' && paymentBooking && !qrPayment && !creatingPayment) {
      console.log('🚀 Auto-generating QR code for payment');
      // Small delay to ensure state is settled
      const timer = setTimeout(() => {
        // Double-check conditions before generating
        if (currentStep === 'payment' && paymentBooking && !qrPayment && !creatingPayment) {
          console.log('⚡ Executing QR code generation');
          createPaymentForBooking();
        } else {
          console.log('⏭️ QR generation skipped - conditions not met after delay');
        }
      }, 1000); // Increased delay

      return () => clearTimeout(timer);
    } else {
      console.log('⏸️ Auto-generation conditions not met');
    }
  }, [currentStep, paymentBooking, checkoutTotal]); // Include checkoutTotal

  const validateStock = async () => {
    setIsValidatingStock(true);
    try {
      const validation = await validateStockAvailability();
      setStockValidationIssues(validation.valid ? [] : validation.issues);
    } catch (error) {
      console.error('Stock validation failed:', error);
      setStockValidationIssues(['Failed to validate stock availability']);
    } finally {
      setIsValidatingStock(false);
    }
  };

  const handleScheduleUpdate = (itemId: string, date: string, notes: string) => {
    setScheduledItems(prev => ({
      ...prev,
      [itemId]: { date, notes }
    }));
  };

  const handleProceedToSchedule = () => {
    if (stockValidationIssues.length === 0) {
      setCurrentStep('schedule');
    }
  };

  const createPaymentForBooking = async () => {
    console.log('createPaymentForBooking called');
    console.log('paymentBooking:', paymentBooking);
    console.log('checkoutTotal:', checkoutTotal);
    console.log('creatingPayment:', creatingPayment);

    if (!paymentBooking) {
      console.log('❌ No payment booking available');
      setPaymentError('No booking found. Please go back and try again.');
      return;
    }

    if (creatingPayment) {
      console.log('⚠️ QR generation already in progress');
      return;
    }

    if (!checkoutTotal || checkoutTotal <= 0) {
      console.log('❌ Invalid checkout total:', checkoutTotal);
      setPaymentError('Invalid payment amount. Please go back and try again.');
      return;
    }

    console.log('✅ Starting QR payment creation for booking:', paymentBooking._id, 'amount:', checkoutTotal);
    setCreatingPayment(true);
    setPaymentError('');
    setQrPayment(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to continue');
      }

      console.log('📡 Making API call to create QR payment...');
      const response = await fetch('http://localhost:5000/api/payments/create-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: paymentBooking._id,
          amount: checkoutTotal,
          paymentType: paymentType,
        }),
      });

      console.log('📡 API response status:', response.status);

      if (response.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ API error response:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 API response data:', data);

      if (data.success && data.qrCode) {
        console.log('✅ QR payment created successfully');
        setQrPayment({
          qrCode: data.qrCode,
          instructions: data.instructions,
          referenceNumber: data.referenceNumber,
          transactionId: data.transactionId,
        });
        setCreatingPayment(false);

        // Start polling for payment status
        console.log('🔄 Starting payment polling for reference:', data.referenceNumber);
        startPaymentPolling(data.referenceNumber, token);
      } else {
        console.log('❌ Invalid API response:', data);
        throw new Error(data.message || 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('❌ QR payment creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR code';
      setPaymentError(errorMessage);
      setCreatingPayment(false);
      setQrPayment(null); // Reset QR payment state on error
    }
  };

  const startPaymentPolling = (referenceNumber: string, token: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/payments/status/${referenceNumber}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.payment) {
            if (data.payment.status === 'completed') {
              setPaymentStatus('completed');
              clearInterval(pollInterval);
              // Clear cart and redirect to success page after a short delay
              setTimeout(() => {
                clearCart();
                router.push('/customer/bookings?payment=success');
              }, 2000);
            } else if (data.payment.status === 'failed') {
              setPaymentStatus('failed');
              clearInterval(pollInterval);
            }
          }
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 5 * 60 * 1000);
  };

  const handleConfirmBooking = async () => {
    setIsProcessing(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to continue');
        router.push('/login');
        return;
      }

      // Process each item in the cart
      const bookingPromises = checkoutItems.map(async (item) => {
        const scheduleData = scheduledItems[item.id];
        if (!scheduleData?.date) {
          throw new Error(`Please schedule a date for ${item.name}`);
        }

        const response = await fetch('http://localhost:5000/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            serviceId: item.id,
            quantity: item.quantity,
            bookingDate: scheduleData.date,
            notes: scheduleData.notes || '',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to book ${item.name}: ${errorData.message}`);
        }

        const data = await response.json();
        return data;
      });

      const results = await Promise.all(bookingPromises);
      console.log('Booking creation results:', results);

      // Check if any bookings require payment
      const paymentRequiredBookings = results.filter(result => result.requiresPayment);
      console.log('Payment required bookings:', paymentRequiredBookings);

      if (paymentRequiredBookings.length > 0) {
        // Store the checkout total for display in payment step
        const totalAmount = getTotalPrice();
        console.log('💰 Calculated checkout total:', totalAmount);
        console.log('📦 Cart items:', checkoutItems);
        setCheckoutTotal(totalAmount);

        // For now, handle the first payment-required booking
        // In a full implementation, this could handle bulk payment
        const firstPaymentBooking = paymentRequiredBookings[0];
        console.log('📋 First payment booking:', firstPaymentBooking);
        console.log('🎫 Booking object:', firstPaymentBooking.booking);
        console.log('💵 Checkout total:', totalAmount);

        if (firstPaymentBooking && firstPaymentBooking.booking) {
          console.log('✅ Setting payment booking and moving to payment type selection');
          setPaymentBooking(firstPaymentBooking.booking);
          setCurrentStep('payment-type');
        } else {
          console.error('❌ Invalid payment booking data:', firstPaymentBooking);
          alert('Error: Invalid booking data. Please try again.');
        }
        // Don't clear cart yet - wait for payment completion
      } else {
        // All bookings completed successfully
        console.log('✅ No payment required, redirecting to success');
        clearCart();
        router.push('/customer/bookings?success=true');
      }

    } catch (error) {
      console.error('Checkout failed:', error);
      alert(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  if (checkoutItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center space-x-2 ${currentStep === 'review' ? 'text-indigo-600' : currentStep === 'schedule' || currentStep === 'confirm' || currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'review' ? 'bg-indigo-600 text-white' : currentStep === 'schedule' || currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              1
            </div>
            <span className="font-medium">Review Cart</span>
          </div>
          <div className={`w-16 h-0.5 ${currentStep === 'schedule' || currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep === 'schedule' ? 'text-indigo-600' : currentStep === 'confirm' || currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'schedule' ? 'bg-indigo-600 text-white' : currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              2
            </div>
            <span className="font-medium">Schedule Services</span>
          </div>
          <div className={`w-16 h-0.5 ${currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep === 'confirm' ? 'text-indigo-600' : currentStep === 'payment-type' || currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'confirm' ? 'bg-indigo-600 text-white' : currentStep === 'payment-type' || currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              3
            </div>
            <span className="font-medium">Confirm Booking</span>
          </div>
          <div className={`w-16 h-0.5 ${currentStep === 'payment-type' || currentStep === 'payment' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep === 'payment-type' ? 'text-indigo-600' : currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'payment-type' ? 'bg-indigo-600 text-white' : currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              4
            </div>
            <span className="font-medium">Payment Options</span>
          </div>
          <div className={`w-16 h-0.5 ${currentStep === 'payment' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-2 ${currentStep === 'payment' ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'payment' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              5
            </div>
            <span className="font-medium">Process Payment</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'review' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Review Your Cart</h1>
            <p className="text-gray-600">Please review all items before proceeding to schedule your services.</p>
          </div>

          {/* Stock Validation Issues */}
          {stockValidationIssues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <span className="text-lg">⚠️</span>
                <span className="font-semibold">Stock Issues Detected</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {stockValidationIssues.map((issue, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cart Items */}
          <div className="space-y-4">
            {checkoutItems.map((item) => (
              <div key={item.id} className="card p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-2xl">
                    {item.image ? (
                      <img
                        src={item.image.startsWith('/uploads/') ? `http://localhost:5000${item.image}` : item.image}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      item.category === 'party' ? '🎉' :
                      item.category === 'wedding' ? '💒' :
                      item.category === 'corporate' ? '🏢' :
                      item.category === 'equipment' ? '🎪' :
                      item.category === 'cleaning' ? '🧹' : '⚙️'
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{item.category.replace('-', ' ')} • {item.serviceType}</p>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-indigo-600">₱{(item.price * item.quantity).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">₱{item.price.toFixed(2)} each</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Cart Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Items ({totalItems}):</span>
                <span className="font-semibold">₱{totalPrice.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-indigo-600">₱{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Link href="/customer/cart" className="btn-secondary">
              ← Back to Cart
            </Link>
            <button
              onClick={handleProceedToSchedule}
              disabled={stockValidationIssues.length > 0 || isValidatingStock}
              className="btn-primary"
            >
              {isValidatingStock ? 'Validating...' : 'Proceed to Schedule →'}
            </button>
          </div>
        </div>
      )}

      {currentStep === 'schedule' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Schedule Your Services</h1>
            <p className="text-gray-600">Select dates and times for each service in your cart.</p>
          </div>

          {/* Scheduling Interface */}
          <div className="space-y-6">
            {checkoutItems.map((item, index) => (
              <div key={item.id} className="card p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl">
                    {item.category === 'party' ? '🎉' :
                     item.category === 'wedding' ? '💒' :
                     item.category === 'corporate' ? '🏢' :
                     item.category === 'equipment' ? '🎪' :
                     item.category === 'cleaning' ? '🧹' : '⚙️'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date & Time {!scheduledItems[item.id]?.date && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="datetime-local"
                      className={`input-field ${!scheduledItems[item.id]?.date ? 'border-red-300 focus:border-red-500' : 'border-green-300 focus:border-green-500'}`}
                      min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} // At least 1 hour from now
                      value={scheduledItems[item.id]?.date || ''}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        if (selectedDate) {
                          handleScheduleUpdate(item.id, selectedDate, scheduledItems[item.id]?.notes || '');
                        } else {
                          // Clear the date if user clears the input
                          const updatedNotes = scheduledItems[item.id]?.notes || '';
                          setScheduledItems(prev => ({
                            ...prev,
                            [item.id]: { date: '', notes: updatedNotes }
                          }));
                        }
                      }}
                      required
                    />
                    {!scheduledItems[item.id]?.date && (
                      <p className="text-xs text-red-600 mt-1">Please select a date and time</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="Any special requests or notes..."
                      value={scheduledItems[item.id]?.notes || ''}
                      onChange={(e) => handleScheduleUpdate(item.id, scheduledItems[item.id]?.date || '', e.target.value)}
                    />
                  </div>
                </div>

                {scheduledItems[item.id]?.date && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <span className="text-lg">✅</span>
                      <div>
                        <span className="text-sm font-medium">Scheduled for: {new Date(scheduledItems[item.id].date).toLocaleString()}</span>
                        {scheduledItems[item.id]?.notes && (
                          <p className="text-xs text-green-700 mt-1">Notes: {scheduledItems[item.id].notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Missing Dates Warning */}
          {checkoutItems.some(item => !scheduledItems[item.id]?.date) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <span className="text-lg">⚠️</span>
                <span className="font-semibold">Please schedule dates for all items</span>
              </div>
              <p className="text-sm text-yellow-700">
                The following items need scheduling before you can proceed:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                {checkoutItems.filter(item => !scheduledItems[item.id]?.date).map(item => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span>•</span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setCurrentStep('review')}
              className="btn-secondary"
            >
              ← Back to Review
            </button>
            <button
              onClick={() => setCurrentStep('confirm')}
              disabled={checkoutItems.some(item => !scheduledItems[item.id]?.date)}
              className="btn-primary"
              title={checkoutItems.some(item => !scheduledItems[item.id]?.date) ? 'Please schedule dates for all items to continue' : ''}
            >
              Review & Confirm →
            </button>
          </div>
        </div>
      )}

      {currentStep === 'confirm' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Confirm Your Booking</h1>
            <p className="text-gray-600">Please review all details before confirming your booking.</p>
          </div>

          {/* Final Summary */}
          <div className="space-y-4">
            {checkoutItems.map((item) => {
              const schedule = scheduledItems[item.id];
              return (
                <div key={item.id} className="card p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl">
                        {item.category === 'party' ? '🎉' :
                         item.category === 'wedding' ? '💒' :
                         item.category === 'corporate' ? '🏢' :
                         item.category === 'equipment' ? '🎪' :
                         item.category === 'cleaning' ? '🧹' : '⚙️'}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-sm text-indigo-600 font-medium">
                          {schedule?.date ? new Date(schedule.date).toLocaleString() : 'Not scheduled'}
                        </p>
                        {schedule?.notes && (
                          <p className="text-sm text-gray-500 mt-1">Notes: {schedule.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-indigo-600">₱{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final Total */}
          <div className="card p-6">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total Amount:</span>
              <span className="text-indigo-600">₱{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setCurrentStep('schedule')}
              className="btn-secondary"
              disabled={isProcessing}
            >
              ← Back to Schedule
            </button>
            <button
              onClick={handleConfirmBooking}
              disabled={isProcessing}
              className="btn-primary"
            >
              {isProcessing ? 'Processing...' : 'Confirm & Proceed to Payment'}
            </button>
          </div>
        </div>
      )}

      {currentStep === 'payment-type' && paymentBooking && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Choose Payment Option</h1>
            <p className="text-gray-600">Select how you'd like to pay for your booking</p>
          </div>

          {/* Payment Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Full Payment Option */}
            <div
              className={`card cursor-pointer transition-all duration-200 ${
                paymentType === 'full'
                  ? 'border-2 border-indigo-500 bg-indigo-50'
                  : 'border border-gray-200 hover:border-indigo-300'
              }`}
              onClick={() => setPaymentType('full')}
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    paymentType === 'full' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                  }`}>
                    {paymentType === 'full' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Full Payment</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="text-2xl font-bold text-indigo-600">₱{checkoutTotal.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Pay the full amount now and complete your booking immediately.
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center text-green-800">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium">Booking confirmed immediately</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Down Payment Option */}
            <div
              className={`card cursor-pointer transition-all duration-200 ${
                paymentType === 'down_payment'
                  ? 'border-2 border-indigo-500 bg-indigo-50'
                  : 'border border-gray-200 hover:border-indigo-300'
              }`}
              onClick={() => {
                setPaymentType('down_payment');
                setDownPaymentAmount(Math.round(checkoutTotal * 0.3)); // 30% down payment
              }}
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    paymentType === 'down_payment' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                  }`}>
                    {paymentType === 'down_payment' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Down Payment</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Down Payment (30%):</span>
                    <span className="text-2xl font-bold text-orange-600">₱{Math.round(checkoutTotal * 0.3).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Remaining Balance:</span>
                    <span className="text-lg text-gray-700">₱{Math.round(checkoutTotal * 0.7).toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Pay 30% now to reserve your booking. Pay the remaining balance later.
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center text-orange-800">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Booking reserved, pay balance later</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Booking Amount:</span>
                <span className="font-semibold">₱{checkoutTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Type:</span>
                <span className="font-semibold capitalize">{paymentType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Amount to Pay Now:</span>
                <span className="text-indigo-600">
                  ₱{paymentType === 'full' ? checkoutTotal.toFixed(2) : Math.round(checkoutTotal * 0.3).toFixed(2)}
                </span>
              </div>
              {paymentType === 'down_payment' && (
                <div className="text-sm text-gray-500 mt-2">
                  Remaining balance of ₱{Math.round(checkoutTotal * 0.7).toFixed(2)} to be paid before service date.
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setCurrentStep('confirm')}
              className="btn-secondary"
              disabled={isProcessing}
            >
              ← Back to Confirm
            </button>
            <button
              onClick={() => {
                const paymentAmount = paymentType === 'full' ? checkoutTotal : Math.round(checkoutTotal * 0.3);
                // Store payment info in localStorage for the payment process page
                localStorage.setItem('pendingPayment', JSON.stringify({
                  bookingId: paymentBooking._id,
                  amount: paymentAmount,
                  paymentType: paymentType,
                  totalAmount: checkoutTotal
                }));
                // Redirect to payment process page
                router.push(`/payment/process?bookingId=${paymentBooking._id}&amount=${paymentAmount}&paymentType=${paymentType}`);
              }}
              className="btn-primary"
            >
              Proceed to Payment →
            </button>
          </div>
        </div>
      )}

      {currentStep === 'payment' && paymentBooking && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Payment</h1>
            <p className="text-gray-600">Secure payment powered by GCash</p>
          </div>

          {/* Payment Error */}
          {paymentError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800">{paymentError}</span>
              </div>
            </div>
          )}

          {/* Checkout Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              {checkoutItems.map((item, index) => {
                const schedule = scheduledItems[item.id];
                return (
                  <div key={item.id} className="flex justify-between py-1">
                    <span className="text-gray-600">
                      {item.name} {item.quantity > 1 ? `(${item.quantity}x)` : ''}
                      {schedule?.date && (
                        <span className="text-xs text-gray-500 block">
                          {new Date(schedule.date).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount:</span>
                  <span className="text-green-600">₱{checkoutTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Display */}
          {!qrPayment && !creatingPayment && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 21h.01M12 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-blue-800 mb-2">Ready to Pay</h3>
                <p className="text-blue-700 mb-4">Click below to generate your QR code for payment</p>
              </div>
              <button
                onClick={createPaymentForBooking}
                className="btn-primary text-lg px-8 py-3"
              >
                Generate QR Code
              </button>
            </div>
          )}

          {creatingPayment && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Generating QR Code</h3>
              <p className="text-gray-600">Please wait while we prepare your payment...</p>
            </div>
          )}

          {qrPayment && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2">Scan QR Code to Pay</h3>
                <p className="text-gray-600 mb-2">Scan on the GCash app</p>
              </div>

              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 relative">
                  {qrPayment.qrCode ? (
                    <img
                      src={qrPayment.qrCode}
                      alt="GCash QR Code"
                      className="w-64 h-64"
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
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-2">Payment Instructions:</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  {qrPayment.instructions.instructions.map((instruction: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="font-medium mr-2">{index + 1}.</span>
                      {instruction.replace('₱' + qrPayment.instructions.amount, '₱' + checkoutTotal.toFixed(2))}
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
                    <div className="font-bold text-green-600">₱{checkoutTotal.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="mt-4 text-center">
                {paymentStatus === 'pending' && (
                  <div className="space-y-3">
                    <div className="inline-flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Waiting for payment...
                    </div>
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

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setCurrentStep('confirm')}
              className="btn-secondary"
              disabled={creatingPayment || paymentStatus === 'completed'}
            >
              ← Back to Confirm
            </button>
            {!qrPayment && !creatingPayment && (
              <button
                onClick={createPaymentForBooking}
                className="btn-primary"
              >
                Generate QR Code
              </button>
            )}
            {creatingPayment && (
              <button
                disabled
                className="btn-primary opacity-50 cursor-not-allowed"
              >
                Generating QR Code...
              </button>
            )}
            {qrPayment && paymentStatus === 'pending' && (
              <button
                onClick={() => {
                  setQrPayment(null);
                  setPaymentStatus('pending');
                  setCreatingPayment(false);
                  createPaymentForBooking();
                }}
                className="btn-secondary"
              >
                Regenerate QR Code
              </button>
            )}
            {paymentError && (
              <button
                onClick={() => {
                  setPaymentError('');
                  setQrPayment(null);
                  setCreatingPayment(false);
                  createPaymentForBooking();
                }}
                className="btn-primary"
              >
                Try Again
              </button>
            )}
            {paymentStatus === 'failed' && (
              <button
                onClick={() => {
                  setQrPayment(null);
                  setPaymentStatus('pending');
                  setCreatingPayment(false);
                  createPaymentForBooking();
                }}
                className="btn-primary"
              >
                Generate New QR Code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}