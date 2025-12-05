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
  duration?: number; // Duration in days
  dailyRate?: number; // Daily rate for the item
}

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gcashQRCode?: string;
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

  // Helper function to parse date string as local time
  const parseLocalDate = (dateString: string) => {
    if (!dateString) return null;
    const [year, month, day, hour, minute] = dateString.split(/[-T:]/).map(Number);
    const date = new Date();
    date.setFullYear(year, month - 1, day);
    date.setHours(hour || 0, minute || 0, 0, 0);
    return date;
  };

  // Helper function to format date for datetime-local input
  const formatForDatetimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to get time from datetime string
  const getTimeFromDatetime = (datetimeString: string) => {
    if (!datetimeString) return '';
    const date = parseLocalDate(datetimeString);
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stockValidationIssues, setStockValidationIssues] = useState<string[]>([]);
  const [isValidatingStock, setIsValidatingStock] = useState(false);
  const [currentStep, setCurrentStep] = useState<'review' | 'schedule' | 'confirm' | 'payment-type' | 'payment'>('review');
  const [scheduledItems, setScheduledItems] = useState<{ [key: string]: { date: string; notes: string; sameDateTime: boolean; pickupDate?: string; pickupNotes?: string; extendDuration?: boolean; extendedDays?: number; extendedHours?: number } }>({});
  const [pickupDate, setPickupDate] = useState<string>('');
  const [numberOfDays, setNumberOfDays] = useState<number>(0);
  const [paymentBooking, setPaymentBooking] = useState<any>(null);
  const [checkoutTotal, setCheckoutTotal] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'full'>('full');
  const [qrPayment, setQrPayment] = useState<{
    qrCode: string;
    brandingImage: string;
    instructions: any;
    referenceNumber: string;
    transactionId: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'processing' | 'paid' | 'failed'>('unpaid');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [durationError, setDurationError] = useState('');
  const [user, setUser] = useState<User | null>(null);
   const [userLoading, setUserLoading] = useState(true);
   const [addressComplete, setAddressComplete] = useState(false);
   const [receiptUploading, setReceiptUploading] = useState(false);
   const [receiptError, setReceiptError] = useState('');

  // Initialize checkout items from cart and load scheduled data
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
      duration: 1, // Default 1 day minimum
      dailyRate: item.price, // Assume current price is daily rate
    }));

    setCheckoutItems(initialCheckoutItems);

    // Load scheduled items from localStorage
    const savedScheduledItems = localStorage.getItem('cartScheduledItems');

    let scheduledData: { [key: string]: { date: string; notes: string; sameDateTime: boolean; pickupDate?: string; pickupNotes?: string; extendDuration?: boolean; extendedDays?: number; extendedHours?: number } } = {};
    if (savedScheduledItems) {
      try {
        scheduledData = JSON.parse(savedScheduledItems);
      } catch (error) {
        console.error('Failed to load scheduled items:', error);
      }
    }

    // Pre-populate delivery dates with reservation date if available
    const reservationDate = localStorage.getItem('selectedReservationDate');
    if (reservationDate) {
      const defaultDateTime = formatForDatetimeLocal(new Date(reservationDate));

      // Set default delivery dates for all items that don't have scheduled dates
      const updatedScheduledItems = { ...scheduledData };
      initialCheckoutItems.forEach(item => {
        if (!updatedScheduledItems[item.id]) {
          updatedScheduledItems[item.id] = {
            date: defaultDateTime,
            notes: '',
            sameDateTime: true // All items now share the same delivery time
          };
        }
      });

      setScheduledItems(updatedScheduledItems);
    } else {
      setScheduledItems(scheduledData);
    }
  }, [items, router]);

  // Validate stock on load
  useEffect(() => {
    if (checkoutItems.length > 0) {
      validateStock();
    }
  }, [checkoutItems]);

  // No longer auto-polling for payment status since we use receipt upload

  // Fetch user data for address validation
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setUserLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
            setAddressComplete(!!data.user.address && data.user.address.trim().length > 0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setUserLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Save scheduled items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cartScheduledItems', JSON.stringify(scheduledItems));
  }, [scheduledItems]);

  // Auto-calculate pick-up dates when delivery dates or extension settings change
  useEffect(() => {
    setScheduledItems(prev => {
      const updated = { ...prev };
      let hasChanges = false;

      Object.keys(updated).forEach(itemId => {
        const item = updated[itemId];
        if (item.date && item.extendDuration) {
          const calculatedPickup = calculatePickupDateTime(item.date, item.extendDuration, item.extendedDays || 1);
          if (calculatedPickup && calculatedPickup !== item.pickupDate) {
            updated[itemId] = {
              ...item,
              pickupDate: calculatedPickup
            };
            hasChanges = true;
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [scheduledItems]);

  // Auto-redirect to dashboard when payment incorrect error is shown
  useEffect(() => {
    if (receiptError && receiptError.includes('Payment Incorrect') && receiptError.includes('09127607860')) {
      setTimeout(() => {
        router.push('/customer/dashboard');
      }, 3000); // Give time to read the note
    }
  }, [receiptError, router]);

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
    setScheduledItems(prev => {
      // If no date provided, use the reservation date as default
      let finalDate = date;
      if (!finalDate) {
        const reservationDate = localStorage.getItem('selectedReservationDate');
        if (reservationDate) {
          const date = new Date(reservationDate);
          finalDate = formatForDatetimeLocal(date);
        }
      }

      // Update all items with the same date and notes (unified scheduling)
      const updated = { ...prev };
      checkoutItems.forEach(item => {
        updated[item.id] = {
          date: finalDate,
          notes: item.id === itemId ? notes : (prev[item.id]?.notes || ''), // Keep existing notes for other items
          sameDateTime: true
        };
      });

      return updated;
    });
    calculateNumberOfDays();
  };

  const handlePickupDateChange = (date: string) => {
    setPickupDate(date);
    calculateNumberOfDays();
  };

  const calculateItemDuration = (itemId: string, deliveryDate?: string, pickupDate?: string) => {
    if (!deliveryDate || !pickupDate) return;

    const delivery = parseLocalDate(deliveryDate);
    const pickup = parseLocalDate(pickupDate);

    if (!delivery || !pickup) return;

    // Validate that pick-up is after delivery
    if (pickup <= delivery) {
      console.warn('Pick-up date must be after delivery date');
      return;
    }

    // Calculate duration in days (rounded up)
    const diffTime = pickup.getTime() - delivery.getTime();
    const duration = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Update the item duration
    setCheckoutItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, duration, price: (item.dailyRate || item.price) * duration }
          : item
      )
    );

    // Trigger visual feedback for price change
    const itemElement = document.querySelector(`[data-item-id="${itemId}"] .duration-price`);
    if (itemElement) {
      itemElement.classList.add('text-green-600', 'font-bold');
      setTimeout(() => {
        itemElement.classList.remove('text-green-600', 'font-bold');
      }, 1000);
    }
  };

  const handleDurationChange = (itemId: string, duration: number) => {
    if (duration < 1) return; // Minimum 1 day

    setCheckoutItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, duration, price: (item.dailyRate || item.price) * duration }
          : item
      )
    );

    // Trigger visual feedback for price change
    const itemElement = document.querySelector(`[data-item-id="${itemId}"] .duration-price`);
    if (itemElement) {
      itemElement.classList.add('text-green-600', 'font-bold');
      setTimeout(() => {
        itemElement.classList.remove('text-green-600', 'font-bold');
      }, 1000);
    }
  };

  const handleSameDateTimeChange = (itemId: string, checked: boolean) => {
    setScheduledItems(prev => {
      const updated = { ...prev };

      if (checked) {
        // When checking, use the current date/time or set a default
        const currentItem = updated[itemId] || { date: '', notes: '', sameDateTime: false };
        let dateTime = currentItem.date;

        // If no date, use reservation date as default
        if (!dateTime) {
          const reservationDate = localStorage.getItem('selectedReservationDate');
          if (reservationDate) {
            const date = new Date(reservationDate);
            dateTime = formatForDatetimeLocal(date);
          } else {
            dateTime = formatForDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000));
          }
        }

        updated[itemId] = {
          date: dateTime,
          notes: currentItem.notes || '',
          sameDateTime: true
        };
      } else {
        // When unchecking, keep current values but mark as not same
        if (updated[itemId]) {
          updated[itemId] = {
            ...updated[itemId],
            sameDateTime: false
          };
        }
      }

      return updated;
    });
  };


  const calculatePickupDateTime = (deliveryDate: string, extendDuration: boolean = false, extendedDays: number = 0): string | undefined => {
    if (!deliveryDate) return undefined;

    const delivery = parseLocalDate(deliveryDate);
    if (!delivery) return undefined;

    const pickupDateTime = new Date(delivery);

    // Base rental is 1 day, plus extended days
    const totalDays = 1 + (extendDuration ? extendedDays : 0);

    pickupDateTime.setDate(pickupDateTime.getDate() + totalDays);
    pickupDateTime.setHours(18, 0, 0, 0); // Set to 6:00 PM

    return formatForDatetimeLocal(pickupDateTime);
  };

  const calculateNumberOfDays = () => {
    // Get the earliest delivery date from scheduled items
    const deliveryDates = Object.values(scheduledItems)
      .map(item => item.date)
      .filter(date => date)
      .map(date => parseLocalDate(date))
      .filter(date => date !== null);

    if (deliveryDates.length === 0 || !pickupDate) {
      setNumberOfDays(0);
      setDurationError('');
      return;
    }

    const earliestDelivery = new Date(Math.min(...deliveryDates.map(d => d.getTime())));
    const pickup = parseLocalDate(pickupDate);

    if (!pickup) return;

    // Calculate difference in days
    const diffTime = pickup.getTime() - earliestDelivery.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const finalDays = Math.max(0, diffDays);
    setNumberOfDays(finalDays);

    // Validate minimum 1-day duration
    if (finalDays < 1) {
      setDurationError('Minimum booking duration is 1 day. Please select a pick-up date at least 24 hours after delivery.');
    } else {
      setDurationError('');
    }
  };

  const handleProceedToSchedule = () => {
    if (stockValidationIssues.length === 0) {
      setCurrentStep('schedule');
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
              setPaymentStatus('paid');
              clearInterval(pollInterval);

              // Clear cart and redirect to success page after a short delay
              // The payment verification already created the booking and sent notifications
              setTimeout(() => {
                clearCart();
                router.push('/customer/bookings?payment=success');
              }, 2000);
            } else if (data.payment.status === 'failed') {
              setPaymentStatus('failed');
            } else {
              setPaymentStatus('processing');
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

      // Prepare booking intents for cart payment
      const bookingIntents = [];

      for (const item of checkoutItems) {
        const scheduleData = scheduledItems[item.id];

        if (!scheduleData?.date) {
          throw new Error(`Please schedule a date for ${item.name}`);
        }

        // Handle packages differently
        if (item.serviceType === 'package') {
          // For packages, send package information
          bookingIntents.push({
            serviceId: item.id, // This will be the package ID
            quantity: item.quantity,
            bookingDate: parseLocalDate(scheduleData.date)?.toISOString() || scheduleData.date,
            notes: scheduleData.notes || '',
            duration: item.duration || 1,
            dailyRate: item.dailyRate || item.price,
            totalPrice: item.price * item.quantity, // Package price
            isPackage: true,
            packageId: item.id,
          });
        } else {
          // Regular service booking
          bookingIntents.push({
            serviceId: item.id,
            quantity: item.quantity,
            bookingDate: parseLocalDate(scheduleData.date)?.toISOString() || scheduleData.date,
            notes: scheduleData.notes || '',
            duration: item.duration || 1,
            dailyRate: item.dailyRate || item.price,
            totalPrice: (item.dailyRate || item.price) * (item.duration || 1) * item.quantity,
          });
        }
      }

      // Calculate total amount from booking intents
      const totalAmount = bookingIntents.reduce((sum, intent) => sum + intent.totalPrice, 0);

      // Create cart payment with all booking intents
      const paymentResponse = await fetch('http://localhost:5000/api/payments/create-cart-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingIntents: bookingIntents,
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(`Failed to create cart payment: ${errorData.message}`);
      }

      const paymentData = await paymentResponse.json();

      if (paymentData.success) {
        // Store payment details and booking intents
        setCheckoutTotal(totalAmount);
        setPaymentBooking(bookingIntents); // Store all intents
        setQrPayment({
          qrCode: paymentData.qrCode,
          brandingImage: paymentData.brandingImage,
          instructions: paymentData.instructions,
          referenceNumber: paymentData.referenceNumber,
          transactionId: paymentData.transactionId,
        });
        setCurrentStep('payment-type');
      } else {
        throw new Error(paymentData.message || 'Failed to create cart payment');
      }

    } catch (error) {
      console.error('Checkout failed:', error);
      alert(error instanceof Error ? error.message : 'Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiptUpload = async (file: File) => {
    if (!qrPayment) {
      alert('Payment setup not available. Please go back and try again.');
      return;
    }

    setReceiptUploading(true);
    setReceiptError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to continue');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setReceiptError('Please upload a valid image file (JPG, PNG, GIF, BMP)');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setReceiptError('File size must be less than 5MB');
        return;
      }

      const formData = new FormData();
      formData.append('receipt', file);
      formData.append('expectedAmount', checkoutTotal.toString());

      const response = await fetch(`http://localhost:5000/api/payments/verify-receipt/${qrPayment.referenceNumber}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPaymentStatus('paid');
        // Clear cart and redirect to customer bookings page
        setTimeout(() => {
          clearCart();
          router.push('/customer/bookings');
        }, 2000);
      } else {
        if (data.flaggedForReview) {
          setReceiptError('Receipt verification failed. Your payment has been flagged for manual review. You will be notified once reviewed.');
          setPaymentStatus('processing');
        } else {
          setReceiptError(data.message || 'Receipt verification failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Receipt upload failed:', error);
      setReceiptError('Failed to upload receipt. Please try again.');
    } finally {
      setReceiptUploading(false);
    }
  };

  const totalItems = getTotalItems();
  const totalPrice = checkoutItems.reduce((total, item) => total + (item.price * item.quantity), 0);

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
    <div className="max-w-4xl mx-auto p-4">
      {/* Progress Steps */}
      <div className="mb-4">
        <div className="flex items-center justify-center space-x-2">
          <div className={`flex items-center space-x-1 ${currentStep === 'review' ? 'text-indigo-600' : currentStep === 'schedule' || currentStep === 'confirm' || currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep === 'review' ? 'bg-indigo-600 text-white' : currentStep === 'schedule' || currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              1
            </div>
            <span className="font-medium text-xs">Review</span>
          </div>
          <div className={`w-8 h-0.5 ${currentStep === 'schedule' || currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-1 ${currentStep === 'schedule' ? 'text-indigo-600' : currentStep === 'confirm' || currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep === 'schedule' ? 'bg-indigo-600 text-white' : currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              2
            </div>
            <span className="font-medium text-xs">Schedule</span>
          </div>
          <div className={`w-8 h-0.5 ${currentStep === 'confirm' || currentStep === 'payment' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center space-x-1 ${currentStep === 'confirm' || currentStep === 'payment-type' || currentStep === 'payment' ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep === 'confirm' || currentStep === 'payment-type' || currentStep === 'payment' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              3
            </div>
            <span className="font-medium text-xs">Confirm & Pay</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'review' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Review Your Reservation</h1>
            <p className="text-gray-600 text-sm">Please review all items before proceeding to schedule your equipments.</p>
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

          {/* Address Validation Warning */}
          {!userLoading && !addressComplete && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <span className="text-lg">📍</span>
                <span className="font-semibold">Address Required</span>
              </div>
              <p className="text-sm text-yellow-700 mb-3">
                Please complete your address information before proceeding with checkout. This is required for delivery services.
              </p>
              <Link
                href="/customer/profile"
                className="inline-flex items-center gap-2 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-lg font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Update Address in Profile
              </Link>
            </div>
          )}

          {/* Cart Items */}
          <div className="space-y-3">
            {checkoutItems.map((item) => (
              <div key={item.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-lg">
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
                      item.category === 'birthday' ? '🎂' :
                      item.category === 'funeral' ? '⚰️' : '⚙️'
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-800">{item.name}</h3>
                    <p className="text-xs text-gray-600 capitalize">{item.category.replace('-', ' ')} • {item.serviceType}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-indigo-600">₱{(item.price * item.quantity).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      ₱{(item.dailyRate || item.price).toFixed(2)}/day × {item.duration || 1}d
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="card p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Cart Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Items ({totalItems}):</span>
                <span className="font-semibold">₱{totalPrice.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between text-base font-bold">
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
              disabled={stockValidationIssues.length > 0 || isValidatingStock || !addressComplete}
              className="btn-primary"
            >
              {isValidatingStock ? 'Validating...' : !addressComplete ? 'Complete Address to Continue' : 'Proceed to Date Selection →'}
            </button>
          </div>
        </div>
      )}

      {currentStep === 'schedule' && (
        <div className="space-y-6">
          <div className="text-center mb-8 relative">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Delivery date and time</h1>
            <p className="text-gray-600">Select delivery and pick-up dates for your services.</p>

          </div>


          {/* Delivery & Pickup Interface */}
          <div className="space-y-6">
            {/* Synchronized Bookings Section */}
            {checkoutItems.some(item => scheduledItems[item.id]?.sameDateTime) && (
              <div className="card p-6 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 text-blue-800 mb-6">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl font-bold">Delivery Scheduling</h3>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  These items share the same delivery and pick-up schedule
                </p>

                {/* Synchronized Items List */}
                <div className="space-y-3 mb-6">
                  {checkoutItems.filter(item => scheduledItems[item.id]?.sameDateTime).map((item) => (
                    <div key={item.id} className="p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm">
                          {item.category === 'party' ? '🎉' :
                           item.category === 'wedding' ? '💒' :
                           item.category === 'corporate' ? '🏢' :
                           item.category === 'equipment' ? '🎪' :
                           item.category === 'birthday' ? '🎂' :
                           item.category === 'funeral' ? '⚰️' : '⚙️'}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-800">{item.name}</h4>
                          <p className="text-xs text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                        <button
                          onClick={() => handleSameDateTimeChange(item.id, false)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Duration Selection for Synchronized Items */}
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded" data-item-id={item.id}>
                        <label className="block text-xs font-medium text-blue-800 mb-1">
                          Duration (Days)
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-800">
                            Duration: {item.duration || 1} day{(item.duration || 1) !== 1 ? 's' : ''}
                          </span>
                          <span
                            className="text-xs text-blue-700 duration-price transition-colors"
                            data-item-id={item.id}
                          >
                            ₱{((item.dailyRate || item.price) * (item.duration || 1) * item.quantity).toFixed(2)} • Auto-calculated
                          </span>
                        </div>

                        {/* Extend Rental Duration Checkbox for Synchronized Items */}
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`extend-duration-sync-${item.id}`}
                            checked={scheduledItems[item.id]?.extendDuration || false}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              // Apply to all synchronized items
                              const synchronizedItems = checkoutItems.filter(i => scheduledItems[i.id]?.sameDateTime);
                              synchronizedItems.forEach(syncItem => {
                                const deliveryDate = scheduledItems[syncItem.id]?.date;
                                const pickupDateTime = isChecked && deliveryDate ? calculatePickupDateTime(deliveryDate, isChecked, scheduledItems[syncItem.id]?.extendedDays || 1) : undefined;
 
                                setScheduledItems(prev => ({
                                  ...prev,
                                  [syncItem.id]: {
                                    ...prev[syncItem.id],
                                    extendDuration: isChecked,
                                    extendedDays: isChecked ? (prev[syncItem.id]?.extendedDays || 1) : 0,
                                    pickupDate: pickupDateTime || undefined,
                                  }
                                }));

                                if (isChecked) {
                                  handleDurationChange(syncItem.id, (syncItem.duration || 1) + 1);
                                } else {
                                  handleDurationChange(syncItem.id, 1);
                                }
                              });
                            }}
                            className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label
                            htmlFor={`extend-duration-sync-${item.id}`}
                            className="text-xs text-blue-700 font-medium cursor-pointer"
                          >
                            Extend all rentals
                          </label>
                        </div>

                        {/* Extended Duration Controls for Synchronized Items */}
                        {scheduledItems[item.id]?.extendDuration && (
                          <div className="mt-2 p-2 bg-white border border-blue-300 rounded">
                            <div>
                              <label className="block text-xs font-medium text-blue-800 mb-1">
                                Additional Days
                              </label>
                              <select
                                value={scheduledItems[item.id]?.extendedDays || 1}
                                onChange={(e) => {
                                  const additionalDays = parseInt(e.target.value);
                                  // Apply to all synchronized items
                                  const synchronizedItems = checkoutItems.filter(i => scheduledItems[i.id]?.sameDateTime);
                                  synchronizedItems.forEach(syncItem => {
                                    setScheduledItems(prev => ({
                                      ...prev,
                                      [syncItem.id]: {
                                        ...prev[syncItem.id],
                                        extendedDays: additionalDays,
                                      }
                                    }));
                                    handleDurationChange(syncItem.id, 1 + additionalDays);
                                  });
                                }}
                                className="input-field text-xs"
                              >
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(days => (
                                  <option key={days} value={days}>{days} day{days !== 1 ? 's' : ''}</option>
                                ))}
                              </select>
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                              Extension applies to all synchronized items
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shared Delivery & Pick-up Controls */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Delivery Time {!scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.date && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="time"
                      className={`input-field ${
                        !scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.date
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-green-300 focus:border-green-500'
                      }`}
                      value={(() => {
                        const scheduledDate = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.date;
                        if (scheduledDate) return getTimeFromDatetime(scheduledDate);
                        return '09:00';
                      })()}
                      onChange={(e) => {
                        const time = e.target.value;
                        const reservationDate = localStorage.getItem('selectedReservationDate');
                        if (reservationDate) {
                          const date = new Date(reservationDate);
                          const [hours, minutes] = time.split(':');
                          date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                          const datetimeString = formatForDatetimeLocal(date);
                          // Update all synchronized items
                          const synchronizedItems = checkoutItems.filter(item => scheduledItems[item.id]?.sameDateTime);
                          synchronizedItems.forEach(item => {
                            handleScheduleUpdate(item.id, datetimeString, scheduledItems[item.id]?.notes || '');
                          });
                          calculateNumberOfDays();
                        }
                      }}
                      required
                    />
                    {!scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.date && (
                      <p className="text-xs text-red-600 mt-1">Please select a delivery date and time</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">Delivery Notes (Optional)</label>
                    <textarea
                      className="input-field resize-none"
                      rows={3}
                      placeholder="Any special delivery instructions for all synchronized items..."
                      value={scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.notes || ''}
                      onChange={(e) => {
                        const notes = e.target.value;
                        // Update all synchronized items
                        const synchronizedItems = checkoutItems.filter(item => scheduledItems[item.id]?.sameDateTime);
                        synchronizedItems.forEach(item => {
                          handleScheduleUpdate(item.id, scheduledItems[item.id]?.date || '', notes);
                        });
                      }}
                    />
                  </div>
                  {/* Pick-up Date & Time - Only show when extending rental duration */}
                  {scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.extendDuration && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Pick-up Date & Time
                        </label>
                        <div className="relative">
                          <input
                            type="datetime-local"
                            className="input-field bg-gray-50 border-gray-300 cursor-not-allowed text-gray-700"
                            value={(() => {
                              const pickupDate = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.pickupDate;
                              if (pickupDate) return pickupDate;

                              // Auto-calculate pickup date based on delivery + extension
                              const deliveryDate = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.date;
                              const extendDuration = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.extendDuration;
                              const extendedDays = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.extendedDays || 1;

                              if (deliveryDate) {
                                return calculatePickupDateTime(deliveryDate, extendDuration, extendedDays) || '';
                              }

                              return '';
                            })()}
                            readOnly
                            disabled
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              Auto-calculated
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          Automatically calculated based on delivery time and rental duration
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">Pick-up Notes (Optional)</label>
                        <textarea
                          className="input-field resize-none"
                          rows={3}
                          placeholder="Any special pick-up instructions for all synchronized items..."
                          value={scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.pickupNotes || ''}
                          onChange={(e) => {
                            const pickupNotes = e.target.value;
                            // Update all synchronized items
                            const synchronizedItems = checkoutItems.filter(item => scheduledItems[item.id]?.sameDateTime);
                            synchronizedItems.forEach(item => {
                              setScheduledItems(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  pickupNotes
                                }
                              }));
                            });
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Confirmation Messages */}
                {scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.date && scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.pickupDate && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
                      <span className="text-lg">✅</span>
                      <span className="text-sm font-medium">
                        Delivery scheduled for: {(() => {
                          const dateStr = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || ''].date;
                          return parseLocalDate(dateStr)?.toLocaleString() || 'Invalid date';
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-sm">📅</span>
                      <span className="text-sm font-medium">
                        Pick-up scheduled for: {(() => {
                          const dateStr = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || ''].date;
                          const extendDuration = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.extendDuration;
                          const extendedDays = scheduledItems[checkoutItems.find(item => scheduledItems[item.id]?.sameDateTime)?.id || '']?.extendedDays || 1;
                          if (dateStr) {
                            const pickupDateTime = calculatePickupDateTime(dateStr, extendDuration, extendedDays);
                            if (pickupDateTime) {
                              const pickupDate = parseLocalDate(pickupDateTime);
                              return pickupDate ? pickupDate.toLocaleString() : 'Invalid date';
                            }
                          }
                          return 'Invalid date';
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All items now use unified scheduling */}
            {false && (
              <div className="card p-6 bg-gray-50 border-gray-200">
                <div className="flex items-center gap-2 text-gray-800 mb-6">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl font-bold">Individual Bookings</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  These items have their own delivery and pick-up schedules
                </p>

                <div className="space-y-6">
                  {checkoutItems.filter(item => !scheduledItems[item.id]?.sameDateTime).map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl">
                          {item.category === 'party' ? '🎉' :
                           item.category === 'wedding' ? '💒' :
                           item.category === 'corporate' ? '🏢' :
                           item.category === 'equipment' ? '🎪' :
                           item.category === 'birthday' ? '🎂' :
                           item.category === 'funeral' ? '⚰️' : '⚙️'}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-800">{item.name}</h4>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                      </div>

                      {/* Duration Selection */}
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg" data-item-id={item.id}>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Duration (Days) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-800">
                            Duration: {item.duration || 1} day{(item.duration || 1) !== 1 ? 's' : ''}
                          </span>
                          <span className="text-sm text-blue-700 ml-2">
                            ₱{(item.dailyRate || item.price).toFixed(2)}/day
                          </span>
                        </div>

                        {/* Extend Rental Duration Checkbox */}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`extend-duration-${item.id}`}
                            checked={scheduledItems[item.id]?.extendDuration || false}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const deliveryDate = scheduledItems[item.id]?.date;
                              const pickupDateTime = isChecked && deliveryDate ? calculatePickupDateTime(deliveryDate, isChecked, scheduledItems[item.id]?.extendedDays || 1) : undefined;

                              setScheduledItems(prev => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  extendDuration: isChecked,
                                  extendedDays: isChecked ? (prev[item.id]?.extendedDays || 1) : 0,
                                  pickupDate: pickupDateTime || undefined,
                                  pickupNotes: isChecked ? prev[item.id]?.pickupNotes : undefined,
                                }
                              }));

                              if (isChecked) {
                                // Auto-extend by 1 day when checked
                                handleDurationChange(item.id, (item.duration || 1) + 1);
                              } else {
                                // Reset to original duration when unchecked
                                handleDurationChange(item.id, 1);
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label
                            htmlFor={`extend-duration-${item.id}`}
                            className="text-sm text-blue-700 font-medium cursor-pointer"
                          >
                            Extend rental duration beyond 1 day
                          </label>
                        </div>

                        {/* Educational Note */}
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-blue-700">
                            <span className="font-medium">Note:</span> Each rental lasts 1 day and the duration starts after the service or equipment is delivered.
                          </p>
                        </div>

                        {/* Extended Duration Controls */}
                        {scheduledItems[item.id]?.extendDuration && (
                          <div className="mt-3 p-3 bg-white border border-blue-300 rounded-lg">
                            <div>
                              <label className="block text-xs font-medium text-blue-800 mb-1">
                                Additional Days
                              </label>
                              <select
                                value={scheduledItems[item.id]?.extendedDays || 1}
                                onChange={(e) => {
                                  const additionalDays = parseInt(e.target.value);
                                  setScheduledItems(prev => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      extendedDays: additionalDays,
                                    }
                                  }));
                                  handleDurationChange(item.id, 1 + additionalDays);
                                }}
                                className="input-field text-sm"
                              >
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(days => (
                                  <option key={days} value={days}>{days} day{days !== 1 ? 's' : ''}</option>
                                ))}
                              </select>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                              Extension uses the original booking time • Total duration: {(item.duration || 1)} days
                            </p>
                          </div>
                        )}

                        <div className="mt-2 flex justify-between items-center">
                          <p className="text-xs text-blue-600">
                            Minimum 1 day required • Auto-calculated from dates
                          </p>
                          <div
                            className="text-sm font-semibold text-blue-800 duration-price transition-colors"
                            data-item-id={item.id}
                          >
                            Total: ₱{((item.dailyRate || item.price) * (item.duration || 1) * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Delivery Time {!scheduledItems[item.id]?.date && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="time"
                            className={`input-field ${
                              !scheduledItems[item.id]?.date
                                ? 'border-red-300 focus:border-red-500'
                                : 'border-green-300 focus:border-green-500'
                            }`}
                            value={(() => {
                              const scheduledDate = scheduledItems[item.id]?.date;
                              if (scheduledDate) return getTimeFromDatetime(scheduledDate);
                              return '09:00';
                            })()}
                            onChange={(e) => {
                              const time = e.target.value;
                              const reservationDate = localStorage.getItem('selectedReservationDate');
                              if (reservationDate) {
                                const date = new Date(reservationDate);
                                const [hours, minutes] = time.split(':');
                                date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                const datetimeString = formatForDatetimeLocal(date);
                                handleScheduleUpdate(item.id, datetimeString, scheduledItems[item.id]?.notes || '');
                              }
                            }}
                            required
                          />
                          {!scheduledItems[item.id]?.date && (
                            <p className="text-xs text-red-600 mt-1">Please select a delivery time</p>
                          )}
                        </div>

                        {/* Automatic Pick-up Date Display */}
                        {scheduledItems[item.id]?.date && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Pick-up Date & Time <span className="text-xs text-gray-500">(Auto-calculated)</span>
                            </label>
                            <div className="relative">
                              <input
                                type="datetime-local"
                                className="input-field bg-gray-50 border-gray-300 cursor-not-allowed text-gray-700"
                                value={(() => {
                                  const deliveryDate = scheduledItems[item.id]?.date;
                                  const extendDuration = scheduledItems[item.id]?.extendDuration;
                                  const extendedDays = scheduledItems[item.id]?.extendedDays || 1;

                                  if (deliveryDate) {
                                    return calculatePickupDateTime(deliveryDate, extendDuration, extendedDays) || '';
                                  }

                                  return '';
                                })()}
                                readOnly
                                disabled
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  Auto-set
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Standard 1-day rental: 1 day after delivery at 6:00 PM
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Notes (Optional)</label>
                          <textarea
                            className="input-field resize-none"
                            rows={3}
                            placeholder="Any special delivery instructions..."
                            value={scheduledItems[item.id]?.notes || ''}
                            onChange={(e) => handleScheduleUpdate(item.id, scheduledItems[item.id]?.date || '', e.target.value)}
                          />
                        </div>

                        {/* Pick-up fields only show when extending rental duration */}
                        {scheduledItems[item.id]?.extendDuration && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pick-up Date & Time
                              </label>
                              <div className="relative">
                                <input
                                  type="datetime-local"
                                  className="input-field bg-gray-50 border-gray-300 cursor-not-allowed text-gray-700"
                                  value={(() => {
                                    const pickupDate = scheduledItems[item.id]?.pickupDate;
                                    if (pickupDate) return pickupDate;

                                    // Auto-calculate pickup date based on delivery + extension
                                    const deliveryDate = scheduledItems[item.id]?.date;
                                    const extendDuration = scheduledItems[item.id]?.extendDuration;
                                    const extendedDays = scheduledItems[item.id]?.extendedDays || 1;

                                    if (deliveryDate) {
                                      return calculatePickupDateTime(deliveryDate, extendDuration, extendedDays) || '';
                                    }

                                    return '';
                                  })()}
                                  readOnly
                                  disabled
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Auto-calculated
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                Automatically calculated based on delivery time and rental duration
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Pick-up Notes (Optional)</label>
                              <textarea
                                className="input-field resize-none"
                                rows={3}
                                placeholder="Any special pick-up instructions..."
                                value={scheduledItems[item.id]?.pickupNotes || ''}
                                onChange={(e) => {
                                  setScheduledItems(prev => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      pickupNotes: e.target.value
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {scheduledItems[item.id]?.date && (
                        <div className="mt-4 space-y-2">
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800">
                              <span className="text-lg">✅</span>
                              <div>
                                <span className="text-sm font-medium">Delivery scheduled for: {parseLocalDate(scheduledItems[item.id].date)?.toLocaleString() || 'Invalid date'}</span>
                                {scheduledItems[item.id]?.notes && (
                                  <p className="text-xs text-green-700 mt-1">Notes: {scheduledItems[item.id].notes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 text-blue-800">
                              <span className="text-sm">📅</span>
                              <div>
                                <span className="text-sm font-medium">
                                  Pick-up scheduled for: {(() => {
                                    const deliveryDate = scheduledItems[item.id]?.date;
                                    const extendDuration = scheduledItems[item.id]?.extendDuration;
                                    const extendedDays = scheduledItems[item.id]?.extendedDays || 1;

                                    if (deliveryDate) {
                                      const pickupDateTime = calculatePickupDateTime(deliveryDate, extendDuration, extendedDays);
                                      if (pickupDateTime) {
                                        const pickupDate = parseLocalDate(pickupDateTime);
                                        return pickupDate ? pickupDate.toLocaleString() : 'Invalid date';
                                      }
                                    }

                                    return 'Invalid date';
                                  })()}
                                </span>
                                <p className="text-xs text-blue-700 mt-1">Auto-calculated: 1 day after delivery at 6:00 PM</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Only show pick-up confirmation if extending rental duration */}
                      {scheduledItems[item.id]?.extendDuration && scheduledItems[item.id]?.pickupDate && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-800">
                            <span className="text-sm">📅</span>
                            <div>
                              <span className="text-xs font-medium">Pick-up scheduled for: {parseLocalDate(scheduledItems[item.id].pickupDate!)?.toLocaleString() || 'Invalid date'}</span>
                              {scheduledItems[item.id]?.pickupNotes && (
                                <p className="text-xs text-blue-700 mt-1">Notes: {scheduledItems[item.id].pickupNotes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Duration Error */}
          {durationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <span className="text-lg">⚠️</span>
                <span className="font-semibold">Minimum Duration Required</span>
              </div>
              <p className="text-sm text-red-700">{durationError}</p>
            </div>
          )}

          {/* Missing Dates Warning */}
          {(() => {
            const hasDeliveryDate = checkoutItems.length > 0 && scheduledItems[checkoutItems[0]?.id]?.date;

            return !hasDeliveryDate ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-semibold">Delivery time required</span>
                </div>
                <p className="text-sm text-yellow-700">
                  Please select a delivery time for all items in your cart before proceeding.
                </p>
              </div>
            ) : null;
          })()}

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
              disabled={(() => {
                // Since all items now share the same delivery time, just check that the first item has a date
                const hasDeliveryDate = checkoutItems.length > 0 && scheduledItems[checkoutItems[0]?.id]?.date;
                const hasValidDuration = !durationError;
                return !(hasDeliveryDate && hasValidDuration);
              })()}
              className="btn-primary"
              title={(() => {
                const hasDeliveryDate = checkoutItems.length > 0 && scheduledItems[checkoutItems[0]?.id]?.date;
                const hasValidDuration = !durationError;

                if (!hasValidDuration) return 'Minimum booking duration is 1 day. Please adjust your pick-up date.';
                if (!hasDeliveryDate) return 'Please select a delivery time to continue';
                return '';
              })()}
            >
              Review & Confirm →
            </button>
          </div>
        </div>
      )}

      {currentStep === 'confirm' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Confirm Your Reservation</h1>
            <p className="text-gray-600">Please review all details before confirming your reservation.</p>
          </div>

          {/* Final Summary */}
          <div className="space-y-6">
            {/* Delivery Scheduling Summary */}
            <div className="card p-6 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 text-blue-800 mb-4">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-bold">Delivery Scheduling</h3>
              </div>
              <div className="space-y-3">
                {checkoutItems.map((item) => {
                  const schedule = scheduledItems[item.id];
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm">
                          {item.category === 'party' ? '🎉' :
                           item.category === 'wedding' ? '💒' :
                           item.category === 'corporate' ? '🏢' :
                           item.category === 'equipment' ? '🎪' :
                           item.category === 'birthday' ? '🎂' :
                           item.category === 'funeral' ? '⚰️' : '⚙️'}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800">{item.name}</h4>
                          <p className="text-xs text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-600">₱{(item.price * item.quantity).toFixed(2)}</div>
                        <div className="text-xs text-blue-500">
                          ₱{(item.dailyRate || item.price).toFixed(2)}/day × {item.duration || 1} day{item.duration !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-blue-200">
                <div>
                  <span className="text-sm text-blue-700">Delivery:</span>
                  <p className="font-medium text-blue-900">
                    {(() => {
                      const dateStr = scheduledItems[checkoutItems[0]?.id]?.date;
                      return dateStr ? parseLocalDate(dateStr)?.toLocaleString() || 'Invalid date' : 'Not set';
                    })()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-blue-700">Pick-up:</span>
                  <p className="font-medium text-blue-900">
                    {(() => {
                      const dateStr = scheduledItems[checkoutItems[0]?.id]?.date;
                      const extendDuration = scheduledItems[checkoutItems[0]?.id]?.extendDuration;
                      const extendedDays = scheduledItems[checkoutItems[0]?.id]?.extendedDays || 1;
                      if (!dateStr) return 'Not set';
                      const pickupDateTime = calculatePickupDateTime(dateStr, extendDuration, extendedDays);
                      if (pickupDateTime) {
                        const pickupDate = parseLocalDate(pickupDateTime);
                        return pickupDate ? pickupDate.toLocaleString() : 'Invalid date';
                      }
                      return 'Invalid date';
                    })()}
                  </p>
                </div>
              </div>
            </div>

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

          {/* Payment Options */}
          <div className="grid md:grid-cols-1 gap-6 max-w-md mx-auto">
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
                <span className="font-semibold capitalize">Full Payment</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Amount to Pay Now:</span>
                <span className="text-indigo-600">
                  ₱{checkoutTotal.toFixed(2)}
                </span>
              </div>
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
                setCurrentStep('payment');
              }}
              className="btn-primary"
            >
              Proceed to Payment →
            </button>
          </div>
        </div>
      )}

      {currentStep === 'payment' && paymentBooking && qrPayment && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Payment</h1>
            <p className="text-gray-600">Secure payment powered by GCash</p>
          </div>

          {/* Payment Error - Compact */}
          {paymentError && (
            <div className="flex-shrink-0 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800 text-sm">{paymentError}</span>
              </div>
            </div>
          )}

          {/* Main Payment Interface */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - QR Code and Instructions */}
            <div className="space-y-6">
              {/* QR Code Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Scan QR Code to Pay</h3>
                  <p className="text-gray-600">Scan on the GCash app to complete your payment</p>
                </div>

                <div className="flex justify-center mb-6">
                  <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">

                    {/* Brand Name Section */}
                    <div className="p-4 border-b border-gray-200 flex justify-center">
                      <img
                        src="/brandname.jpg"
                        alt="Brand Name"
                        className="h-16 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    {/* QR Code Section */}
                    <div className="p-4 border-b border-gray-200 flex justify-center">
                      {qrPayment!.qrCode ? (
                        <img
                          src={qrPayment!.qrCode}
                          alt="GCash QR Code"
                          className="w-64 h-64"
                          onError={(e) => {
                            console.error('QR code failed to load, src:', qrPayment!.qrCode);
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

                    {/* GCash Name Section */}
                    <div className="p-4 flex justify-center">
                      <img
                        src="/gcashname.jpg"
                        alt="GCash Name"
                        className="h-16 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Payment Instructions:</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    {qrPayment!.instructions.instructions.map((instruction: string, index: number) => (
                      <div key={index} className="flex items-start">
                        {instruction.replace('₱' + qrPayment!.instructions.amount, '₱' + checkoutTotal.toFixed(2))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Reference:</span>
                      <div className="font-mono text-gray-800">{qrPayment!.referenceNumber}</div>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Amount:</span>
                      <div className="font-bold text-green-600">₱{checkoutTotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary and Upload */}
            <div className="space-y-6">
              {/* Checkout Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Payment Summary</h3>
                <div className="space-y-2 text-sm">
                  {checkoutItems.map((item, index) => {
                    const schedule = scheduledItems[item.id];
                    return (
                      <div key={item.id} className="flex justify-between py-1">
                        <span className="text-gray-600 truncate mr-2">
                          {item.name} {item.quantity > 1 ? `(${item.quantity}x)` : ''}
                        </span>
                        <span className="font-medium">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span className="text-green-600">₱{checkoutTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Receipt Verification Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Receipt Verification</h3>
                  <p className="text-gray-600">After completing payment, upload your GCash receipt screenshot for verification</p>
                </div>

                {/* Receipt Upload Form */}
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                    <input
                      type="file"
                      id="receipt-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleReceiptUpload(file);
                        }
                      }}
                    />
                    <label htmlFor="receipt-upload" className="cursor-pointer">
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-lg font-medium text-gray-700 mb-2">Click to upload receipt</p>
                      <p className="text-sm text-gray-500">PNG, JPG, GIF up to 5MB</p>
                    </label>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Receipt Verification Instructions:</h4>
                  <ol className="text-sm text-green-700 space-y-1">
                    <li className="flex items-start">
                      <span className="font-medium mr-2">1.</span>
                      Complete your GCash payment using the QR code above
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">2.</span>
                      Take a screenshot or download the payment confirmation/receipt
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">3.</span>
                      Upload the screenshot above for automatic verification
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">4.</span>
                      Our system will verify the amount and reference number
                    </li>
                  </ol>
                </div>
              </div>

              {/* Receipt Upload Status */}
              <div className="text-center">
                {receiptUploading && (
                  <div className="space-y-3">
                    <div className="inline-flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Verifying receipt...
                    </div>
                  </div>
                )}
                {receiptError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-center text-red-800">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{receiptError}</span>
                    </div>
                  </div>
                )}
                {paymentStatus === 'processing' && !receiptUploading && (
                  <div className="space-y-3">
                    <div className="inline-flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Payment under review...
                    </div>
                  </div>
                )}
                {paymentStatus === 'paid' && (
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
          </div>

          {/* Receipt Upload Form */}
          {!qrPayment && !creatingPayment && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 21h.01M12 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-blue-800 mb-2">Payment Setup Not Available</h3>
                <p className="text-blue-700 mb-4">Please go back and complete the booking process</p>
              </div>
            </div>
          )}

          {qrPayment && (
            <div className="space-y-6">
              {/* QR Code Section */}


              {/* Receipt Upload Status */}
              <div className="mt-4 text-center">
                {receiptUploading && (
                  <div className="space-y-3">
                    <div className="inline-flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Verifying receipt...
                    </div>
                  </div>
                )}
                {receiptError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center text-red-800">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{receiptError}</span>
                    </div>
                  </div>
                )}
                {paymentStatus === 'processing' && !receiptUploading && (
                  <div className="space-y-3">
                    <div className="inline-flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Payment under review...
                    </div>
                  </div>
                )}
                {paymentStatus === 'paid' && (
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
          <div className="flex gap-4 justify-center flex-wrap">
            {!(receiptError && receiptError.includes('Payment Incorrect') && receiptError.includes('09127607860')) && (
              <button
                onClick={() => setCurrentStep('confirm')}
                className="btn-secondary"
                disabled={creatingPayment || paymentStatus === 'paid'}
              >
                ← Back to Confirm
              </button>
            )}
            {paymentError && (
              <button
                onClick={() => {
                  setPaymentError('');
                  setQrPayment(null);
                  setCreatingPayment(false);
                  setCurrentStep('payment-type');
                }}
                className="btn-primary"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}