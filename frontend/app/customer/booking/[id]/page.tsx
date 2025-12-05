'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import Button from '../../../../components/Button';
import Calendar from '../../../../components/Calendar';

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  price?: number; // For backward compatibility
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

  // Load saved booking data from localStorage
  const loadSavedBookingData = () => {
    const saved = localStorage.getItem(`booking_page_${serviceId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only return if it's for the same service and not older than 24 hours
        if (parsed.serviceId === serviceId && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
      } catch (error) {
        console.error('Failed to load saved booking data:', error);
      }
    }
    return null;
  };

  const savedData = loadSavedBookingData();
  const [booking, setBooking] = useState(savedData?.booking || {
    quantity: 1,
    bookingDate: '',
    deliveryTime: '',
    pickupDate: '',
    pickupTime: '',
    notes: '',
    extendRental: false,
    extendedDays: 0,
    extendedHours: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | React.ReactElement>('');
  const [queued, setQueued] = useState(savedData?.queued || false);
  const [alternatives, setAlternatives] = useState<any[]>(savedData?.alternatives || []);
  const [recommendations, setRecommendations] = useState<Service[]>([]);
  const [showDateTimePicker, setShowDateTimePicker] = useState(savedData?.showDateTimePicker || false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    // First check saved booking data
    if (savedData?.selectedDate) {
      return new Date(savedData.selectedDate);
    }
    // Then check if user has previously selected a reservation date
    const reservationDate = localStorage.getItem('selectedReservationDate');
    if (reservationDate) {
      return new Date(reservationDate);
    }
    return null;
  });
  const [selectedHour, setSelectedHour] = useState(savedData?.selectedHour || 9);
  const [selectedMinute, setSelectedMinute] = useState(savedData?.selectedMinute || 0);
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>(savedData?.selectedAmPm || 'AM');
  const [dateTimeConfirmed, setDateTimeConfirmed] = useState(savedData?.dateTimeConfirmed || false);
  const [availabilityChecked, setAvailabilityChecked] = useState(savedData?.availabilityChecked || false);
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    available: boolean;
    availableQuantity: number;
    reason?: string;
    requiresDelivery?: boolean;
    deliveryTruckAvailable?: boolean;
    deliveryTruckReason?: string;
    nextAvailableDeliveryTime?: string;
  } | null>(savedData?.availabilityStatus || null);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(savedData?.calculatedPrice || 0);
  const [pricingInfo, setPricingInfo] = useState<any>(savedData?.pricingInfo || null);
  const [showPayment, setShowPayment] = useState(savedData?.showPayment || false);
  const [qrPayment, setQrPayment] = useState<{
    qrCode: string;
    instructions: any;
    referenceNumber: string;
    transactionId: string;
  } | null>(savedData?.qrPayment || null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'failed'>(savedData?.paymentStatus || 'pending');
  const [currentBookingId, setCurrentBookingId] = useState<string>(savedData?.currentBookingId || '');
  const [currentBookingIntent, setCurrentBookingIntent] = useState<any>(savedData?.currentBookingIntent || null);
  const [showBookingSummary, setShowBookingSummary] = useState(savedData?.showBookingSummary || false);
  const [bookingSummaryData, setBookingSummaryData] = useState<any>(savedData?.bookingSummaryData || null);
  const [showTimeConfirmation, setShowTimeConfirmation] = useState(false);
  const [calculatedPickupDateTime, setCalculatedPickupDateTime] = useState<Date | null>(null);

  // Save booking data to localStorage whenever it changes
  useEffect(() => {
    const dataToSave = {
      serviceId,
      timestamp: Date.now(),
      data: {
        booking,
        queued,
        alternatives,
        showDateTimePicker,
        selectedDate: selectedDate?.toISOString(),
        selectedHour,
        selectedMinute,
        selectedAmPm,
        dateTimeConfirmed,
        availabilityChecked,
        availabilityStatus,
        calculatedPrice,
        pricingInfo,
        showPayment,
        qrPayment,
        paymentStatus,
        currentBookingId,
        currentBookingIntent,
        showBookingSummary,
        bookingSummaryData,
      }
    };
    localStorage.setItem(`booking_page_${serviceId}`, JSON.stringify(dataToSave));
  }, [
    serviceId, booking, queued, alternatives, showDateTimePicker, selectedDate,
    selectedHour, selectedMinute, selectedAmPm, dateTimeConfirmed,
    availabilityChecked, availabilityStatus, calculatedPrice, pricingInfo,
    showPayment, qrPayment, paymentStatus, currentBookingId,
    currentBookingIntent, showBookingSummary, bookingSummaryData
  ]);

  // Reset and check availability when selections change
  useEffect(() => {
    if (selectedDate) {
      setAvailabilityChecked(false);
      setAvailabilityStatus(null);

      // Auto-check availability when all required fields are selected
      const checkAutoAvailability = async () => {
        // Convert to 24-hour format
        let hour24 = selectedHour;
        if (selectedAmPm === 'PM' && selectedHour !== 12) {
          hour24 += 12;
        } else if (selectedAmPm === 'AM' && selectedHour === 12) {
          hour24 = 0;
        }

        const dateTime = new Date(selectedDate);
        dateTime.setHours(hour24, selectedMinute, 0, 0);

        await checkAvailability(dateTime, booking.quantity);
      };

      // Debounce the check to avoid too many API calls
      const timeoutId = setTimeout(checkAutoAvailability, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedDate, selectedHour, selectedMinute, selectedAmPm, booking.quantity]);

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

  // Calculate pick-up date/time when delivery date/time or extension changes
  useEffect(() => {
    calculatePickupDateTime();
  }, [booking.bookingDate, booking.extendRental, booking.extendedDays, booking.extendedHours]);

  const openDateTimePicker = () => {
    setShowDateTimePicker(true);
  };

  const checkAvailability = async (date: Date, quantity: number, deliveryTime?: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to check availability');
        return false;
      }

      let url = `http://localhost:5000/api/bookings/check-availability/${serviceId}?date=${date.toISOString().split('T')[0]}&quantity=${quantity}`;
      if (deliveryTime) {
        url += `&deliveryTime=${deliveryTime}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setError('Your session has expired. Please log in again.');
        return false;
      }

      const data = await response.json();
      if (data.success) {
        setAvailabilityStatus({
          available: data.available,
          availableQuantity: data.availableQuantity,
          reason: data.reason,
          requiresDelivery: data.requiresDelivery,
          deliveryTruckAvailable: data.deliveryTruckAvailable,
          deliveryTruckReason: data.deliveryTruckReason,
          nextAvailableDeliveryTime: data.nextAvailableDeliveryTime,
        });
        setAvailabilityChecked(true);
        return data.available;
      } else {
        setError(data.message || 'Failed to check availability');
        return false;
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setError('Failed to check availability. Please try again.');
    }
    return false;
  };

  const calculateDynamicPrice = async (bookingDate: Date) => {
    if (!service) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const daysBefore = Math.ceil((bookingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const daysBeforeCheckout = Math.max(0, daysBefore);

      const response = await fetch(`http://localhost:5000/api/services/pricing/${service._id}?daysBefore=${daysBeforeCheckout}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCalculatedPrice(data.calculatedPrice);
          setPricingInfo(data);
        }
      }
    } catch (error) {
      console.error('Error calculating price:', error);
    }
  };

  const calculatePickupDateTime = () => {
    if (!booking.bookingDate) {
      setCalculatedPickupDateTime(null);
      setBooking((prev: any) => ({ ...prev, pickupDate: '', pickupTime: '' }));
      return;
    }

    const deliveryDateTime = new Date(booking.bookingDate);
    const pickupDateTime = new Date(deliveryDateTime);

    // Base rental is 1 day, plus extended days and hours
    const totalDays = 1 + (booking.extendRental ? (booking.extendedDays || 0) : 0);
    const totalHours = booking.extendRental ? (booking.extendedHours || 0) : 0;

    pickupDateTime.setDate(pickupDateTime.getDate() + totalDays);
    pickupDateTime.setHours(pickupDateTime.getHours() + totalHours);

    setCalculatedPickupDateTime(pickupDateTime);

    // Update booking state with formatted pickup date and time
    const pickupDate = pickupDateTime.toISOString().split('T')[0]; // YYYY-MM-DD format
    const pickupTime = pickupDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // HH:MM format

    setBooking((prev: any) => ({
      ...prev,
      pickupDate,
      pickupTime
    }));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    calculateDynamicPrice(date);
  };

  const handleTimeConfirm = async () => {
    if (!selectedDate) {
      setError('No delivery date available. Please go back and select a reservation date.');
      return;
    }

    // Convert to 24-hour format
    let hour24 = selectedHour;
    if (selectedAmPm === 'PM' && selectedHour !== 12) {
      hour24 += 12;
    } else if (selectedAmPm === 'AM' && selectedHour === 12) {
      hour24 = 0;
    }

    const dateTime = new Date(selectedDate);
    dateTime.setHours(hour24, selectedMinute, 0, 0);

    // Check availability if not already checked
    if (!availabilityChecked) {
      const isAvailable = await checkAvailability(dateTime, booking.quantity);
      if (!isAvailable) {
        return; // Error already set in checkAvailability
      }
    } else if (!availabilityStatus?.available) {
      setError(availabilityStatus?.reason || 'Selected date/time is not available');
      return;
    }

    // Format as ISO string for the backend
    const isoString = dateTime.toISOString();
    setBooking({ ...booking, bookingDate: isoString });
    setDateTimeConfirmed(true);
    setError('');
    setShowTimeConfirmation(true);

    // Show success message before closing
    setTimeout(() => {
      setShowTimeConfirmation(false);
      setShowDateTimePicker(false);
      // Scroll to notes section after modal closes
      setTimeout(() => {
        document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }, 2000); // Keep modal open for 2 seconds to show confirmation
  };

  const createQRPayment = async (bookingId: string, amount: number, token: string) => {
    console.log('createQRPayment called with:', { bookingId, amount, token: token ? 'present' : 'missing' });

    try {
      const response = await fetch('http://localhost:5000/api/payments/create-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          amount,
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
        setQrPayment({
          qrCode: data.qrCode,
          instructions: data.instructions,
          referenceNumber: data.referenceNumber,
          transactionId: data.transactionId,
        });

        // Start polling for payment status
        startPaymentPolling(data.referenceNumber, token);
      } else {
        throw new Error('Invalid QR payment response');
      }
    } catch (error) {
      console.error('Error creating QR payment:', error);
      setError(error instanceof Error ? error.message : 'Failed to create QR payment');
      throw error; // Re-throw to be caught by caller
    }
  };

  const confirmBookingAfterPayment = async (paymentReference: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to confirm booking');
        return;
      }

      const response = await fetch('http://localhost:5000/api/bookings/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentReference,
          bookingIntent: currentBookingIntent,
        }),
      });

      if (response.status === 401) {
        setError('Your session has expired. Please log in again.');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to confirm booking');
        return;
      }

      if (data.success) {
        // Booking confirmed successfully
        console.log('Booking confirmed successfully');
        // Clear saved booking data on successful completion
        localStorage.removeItem(`booking_page_${serviceId}`);
        router.push('/customer/bookings');
      } else {
        setError('Failed to confirm booking. Please contact support.');
      }
    } catch (err) {
      console.error('Error confirming booking:', err);
      setError('An error occurred while confirming booking. Please contact support.');
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
              // Confirm booking after successful payment
              await confirmBookingAfterPayment(referenceNumber);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!booking.bookingDate) {
      setError('Please select a date and time for your booking');
      setSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to make a booking');
        setSubmitting(false);
        return;
      }

      if (!service) {
        setError('Service information not available');
        setSubmitting(false);
        return;
      }

      // Calculate final price for summary (accounting for extended rental duration)
      const basePrice = pricingInfo?.calculatedPrice || service.basePrice;
      const totalDays = booking.extendRental ? (1 + (booking.extendedDays || 0)) : 1;
      const calculatedPrice = basePrice * totalDays * booking.quantity;

      // Prepare booking summary data
      const summaryData = {
        service: {
          name: service.name,
          category: service.category,
          basePrice: service.basePrice,
          duration: service.duration
        },
        booking: {
          quantity: booking.quantity,
          bookingDate: booking.bookingDate,
          deliveryTime: booking.deliveryTime,
          pickupDate: booking.pickupDate,
          pickupTime: booking.pickupTime,
          notes: booking.notes,
          extendRental: booking.extendRental,
          extendedDays: booking.extendedDays,
          extendedHours: booking.extendedHours
        },
        pricing: {
          unitPrice: pricingInfo?.calculatedPrice || service.basePrice,
          totalPrice: calculatedPrice,
          discount: pricingInfo?.discount || 0,
          daysBeforeEvent: selectedDate ? Math.max(0, Math.ceil((selectedDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0,
          totalDays: booking.extendRental ? (1 + (booking.extendedDays || 0)) : 1
        },
        availability: availabilityStatus
      };

      setBookingSummaryData(summaryData);
      setShowBookingSummary(true);
      setSubmitting(false);

    } catch (err) {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  const handleConfirmBooking = async () => {
    setShowBookingSummary(false);
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to make a booking');
        setSubmitting(false);
        return;
      }

      // Step 1: Create booking intent (payment-first approach)
      const intentResponse = await fetch('http://localhost:5000/api/bookings/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId,
          quantity: booking.quantity,
          bookingDate: booking.bookingDate,
          deliveryTime: booking.deliveryTime,
          pickupDate: booking.pickupDate,
          pickupTime: booking.pickupTime,
          notes: booking.notes,
          extendRental: booking.extendRental,
          extendedDays: booking.extendedDays,
          extendedHours: booking.extendedHours,
        }),
      });

      if (intentResponse.status === 401) {
        setError('Your session has expired. Please log in again.');
        setSubmitting(false);
        return;
      }

      const intentData = await intentResponse.json();

      if (!intentResponse.ok) {
        // Handle specific error types
        if (intentData.errorType === 'multiple_event_reservation') {
          setError(
            <div className="space-y-3">
              <div className="font-semibold text-red-800">{intentData.message}</div>
              {intentData.existingBooking && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                  <div className="font-medium text-red-800 mb-2">Your Current Event Booking:</div>
                  <div className="text-red-700">
                    <div><strong>Service:</strong> {intentData.existingBooking.serviceName}</div>
                    <div><strong>Date:</strong> {new Date(intentData.existingBooking.bookingDate).toLocaleDateString()}</div>
                    <div><strong>Status:</strong> {intentData.existingBooking.status}</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-red-200">
                    <p className="text-xs text-red-600">
                      To book a new event, please complete or cancel your current booking first.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        } else {
          setError(intentData.message || 'Failed to create booking intent');
        }
        setSubmitting(false);
        return;
      }

      if (intentData.queued) {
        // Item was queued, show alternatives
        setQueued(true);
        setAlternatives(intentData.alternatives || []);
        setError('');
        setSubmitting(false);
      } else if (intentData.success && intentData.payment) {
        // Payment intent created successfully, show QR code
        console.log('Booking intent created, showing payment QR code');
        setQrPayment(intentData.payment);
        setCurrentBookingIntent(intentData.bookingIntent);
        setShowPayment(true);
        setSubmitting(false);
      } else {
        setError('Failed to initiate payment. Please try again.');
        setSubmitting(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!service) return <div>Service not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <Button
        onClick={() => {
          // Clear saved booking data when going back
          localStorage.removeItem(`booking_page_${serviceId}`);
          router.back();
        }}
        variant="ghost"
        icon="←"
        className="mb-6"
      >
        Back
      </Button>

      <h1 className="text-2xl sm:text-3xl font-bold mb-2">{service.name}</h1>
      <p className="text-[var(--muted)] mb-6 sm:mb-8 text-sm sm:text-base">{service.description}</p>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
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
              <span className="text-[var(--primary)] font-bold">₱{service.basePrice}</span>
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
              <label className="block text-sm font-medium mb-2">Delivery Date & Time</label>
              <button
                type="button"
                onClick={openDateTimePicker}
                className={`input-field text-left ${dateTimeConfirmed ? 'border-green-500 bg-green-50' : ''}`}
              >
                {booking.bookingDate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <div>
                      <div className="font-medium">{new Date(booking.bookingDate).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-600">{new Date(booking.bookingDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  </div>
                ) : selectedDate ? (
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <div>
                      <div className="font-medium">{selectedDate.toLocaleDateString()}</div>
                      <div className="text-sm text-gray-600">Select delivery time</div>
                    </div>
                  </div>
                ) : (
                  'Select delivery time'
                )}
              </button>
              {dateTimeConfirmed && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <span>✓</span> Delivery time selected successfully
                </p>
              )}
            </div>

            {/* Pick-up Date & Time - Auto-filled */}
            {booking.bookingDate && (
              <div>
                <label className="block text-sm font-medium mb-2">Pick-up Date & Time</label>
                <div className="input-field bg-gray-50 border-gray-300 cursor-not-allowed">
                  {booking.pickupDate && booking.pickupTime ? (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">📦</span>
                      <div>
                        <div className="font-medium">{new Date(booking.pickupDate).toLocaleDateString()}</div>
                        <div className="text-sm text-gray-600">{booking.pickupTime}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500">Calculating pick-up time...</div>
                  )}
                </div>
                <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                  <span>🔄</span> Automatically calculated based on delivery time and rental duration
                </p>
              </div>
            )}

            {/* Rental Duration Extension - Only show for equipment/services that require delivery */}
            {availabilityStatus?.requiresDelivery && (
              <div>
                <label className="block text-sm font-medium mb-2">Rental Duration</label>

                {/* Extension Checkbox */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="extend-rental"
                    checked={booking.extendRental || false}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setBooking({
                        ...booking,
                        extendRental: isChecked,
                        extendedDays: isChecked ? (booking.extendedDays || 1) : 0,
                        extendedHours: isChecked ? (booking.extendedHours || 0) : 0
                      });
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="extend-rental"
                    className="text-sm text-gray-700 font-medium cursor-pointer"
                  >
                    Extend rental duration beyond 1 day
                  </label>
                </div>

                {/* Extension Controls */}
                {booking.extendRental && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Additional Days
                        </label>
                        <select
                          value={booking.extendedDays || 1}
                          onChange={(e) => setBooking({
                            ...booking,
                            extendedDays: parseInt(e.target.value)
                          })}
                          className="input-field w-full"
                        >
                          {Array.from({ length: 30 }, (_, i) => i + 1).map(days => (
                            <option key={days} value={days}>{days} day{days !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Additional Hours
                        </label>
                        <select
                          value={booking.extendedHours || 0}
                          onChange={(e) => setBooking({
                            ...booking,
                            extendedHours: parseInt(e.target.value)
                          })}
                          className="input-field w-full"
                        >
                          <option value={0}>0 hours</option>
                          {Array.from({ length: 23 }, (_, i) => i + 1).map(hours => (
                            <option key={hours} value={hours}>{hours} hour{hours !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-blue-600 mt-3">
                      Each rental lasts 1 day and the duration starts after the service or equipment is delivered.
                    </p>
                  </div>
                )}

                {/* Default 1-day rental note */}
                {!booking.extendRental && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Standard Rental:</span> Each rental lasts 1 day and the duration starts after the service or equipment is delivered.
                    </p>
                  </div>
                )}

                <p className="text-sm text-[var(--muted)] mt-2">
                  Delivery truck availability will be checked automatically
                </p>
              </div>
            )}

            <div id="notes-section">
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <textarea
                value={booking.notes}
                onChange={(e) => setBooking({ ...booking, notes: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Any special requests or notes..."
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-semibold mb-3 text-gray-800">Booking Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-medium text-gray-800">{service.name}</span>
                </div>
                {service.category === 'equipment' && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium text-gray-800">{booking.quantity}</span>
                  </div>
                )}
                {selectedDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Days before event:</span>
                    <span className="font-medium text-gray-800">{Math.max(0, Math.ceil((selectedDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days</span>
                  </div>
                )}
                {/* Rental Duration Display */}
                {availabilityStatus?.requiresDelivery && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Rental Duration:</span>
                      <span className="font-medium text-gray-800">
                        {booking.extendRental ? `${1 + (booking.extendedDays || 0)} days` : '1 day'}
                        {booking.extendRental && booking.extendedHours ? ` + ${booking.extendedHours} hours` : ''}
                      </span>
                    </div>
                    {calculatedPickupDateTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Pick-up Date & Time:</span>
                        <span className="font-medium text-gray-800">
                          {calculatedPickupDateTime.toLocaleDateString()} at {calculatedPickupDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {pricingInfo && pricingInfo.discount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Discount applied:</span>
                    <span className="font-medium">-{pricingInfo.discount}%</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-3">
                  <div className="flex justify-between items-center font-semibold text-lg">
                    <span className="text-gray-800">Total Price:</span>
                    <div className="text-right">
                      <div className="text-[var(--primary)] text-xl">
                        ₱{calculatedPrice}
                      </div>
                      {pricingInfo && pricingInfo.discount > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          was ₱{service.basePrice * (booking.extendRental ? (1 + (booking.extendedDays || 0)) : 1) * booking.quantity}
                        </div>
                      )}
                      {availabilityStatus?.requiresDelivery && (
                        <div className="text-xs text-gray-500 mt-1">
                          ₱{pricingInfo?.calculatedPrice || service.basePrice}/day × {booking.extendRental ? (1 + (booking.extendedDays || 0)) : 1} day{booking.extendRental && (booking.extendedDays || 0) !== 0 ? 's' : ''}
                          {booking.quantity > 1 ? ` × ${booking.quantity} items` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" loading={submitting} size="lg" fullWidth>
              {submitting ? 'Processing...' : 'Review & Confirm Booking'}
            </Button>
          </form>
        </div>
      </div>

      {/* Payment Section */}
      {showPayment && qrPayment && (
        <div className="mt-8 card p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Complete Your Payment</h2>
            <p className="text-gray-600 mt-2">Secure payment powered by GCash</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Scan QR Code to Pay</h3>
              <p className="text-gray-600">Open your GCash app and scan the QR code below</p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <img
                  src={qrPayment.qrCode}
                  alt="GCash QR Code"
                  className="w-64 h-64"
                />
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
                  <div className="font-bold text-green-600">₱{qrPayment.instructions.amount}</div>
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

                  {/* Test verification button (only in development) */}
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const response = await fetch(`http://localhost:5000/api/payments/verify-qr/${qrPayment.referenceNumber}`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              test: true,
                              amount: qrPayment.instructions.amount,
                              referenceNumber: qrPayment.referenceNumber
                            }),
                          });

                          if (response.ok) {
                            setPaymentStatus('completed');
                            setTimeout(() => {
                              router.push('/customer/bookings');
                            }, 2000);
                          } else {
                            setPaymentStatus('failed');
                          }
                        } catch (error) {
                          console.error('Test verification failed:', error);
                          setPaymentStatus('failed');
                        }
                      }}
                      className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Test: Mark as Paid
                    </button>
                  )}
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

          <div className="flex gap-3 justify-center">
            {paymentStatus === 'failed' && (
              <Button
                onClick={async () => {
                  const token = localStorage.getItem('token');
                  if (token && currentBookingId) {
                    await createQRPayment(currentBookingId, qrPayment?.instructions.amount || service.basePrice * booking.quantity, token);
                    setPaymentStatus('pending');
                  }
                }}
                variant="primary"
              >
                Generate New QR Code
              </Button>
            )}

            <Button
              onClick={() => router.back()}
              variant="outline"
              disabled={paymentStatus === 'completed'}
            >
              {paymentStatus === 'completed' ? 'Redirecting...' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}

      {/* Booking Summary Modal */}
      {showBookingSummary && bookingSummaryData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Confirm Your Booking</h2>
                <p className="text-gray-600 mt-2">Please review your booking details before proceeding to payment</p>
              </div>

              <div className="space-y-6">
                {/* Service Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Service:</span>
                      <div className="font-medium text-gray-900">{bookingSummaryData.service.name}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Category:</span>
                      <div className="font-medium text-gray-900 capitalize">{bookingSummaryData.service.category}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <div className="font-medium text-gray-900">{bookingSummaryData.service.duration} minutes</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit Price:</span>
                      <div className="font-medium text-gray-900">₱{bookingSummaryData.service.basePrice}</div>
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Booking Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date & Time:</span>
                      <span className="font-medium text-gray-900">{new Date(bookingSummaryData.booking.bookingDate).toLocaleString()}</span>
                    </div>
                    {bookingSummaryData.booking.quantity > 1 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium text-gray-900">{bookingSummaryData.booking.quantity}</span>
                      </div>
                    )}
                    {bookingSummaryData.booking.deliveryTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivery Time:</span>
                        <span className="font-medium text-gray-900">{bookingSummaryData.booking.deliveryTime}</span>
                      </div>
                    )}
                    {bookingSummaryData.booking.extendRental && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Extended Rental:</span>
                        <span className="font-medium text-gray-900">
                          {1 + (bookingSummaryData.booking.extendedDays || 0)} days
                          {bookingSummaryData.booking.extendedHours ? ` + ${bookingSummaryData.booking.extendedHours} hours` : ''}
                        </span>
                      </div>
                    )}
                    {bookingSummaryData.booking.pickupDate && bookingSummaryData.booking.pickupTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pick-up Date & Time:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(bookingSummaryData.booking.pickupDate).toLocaleDateString()} at {bookingSummaryData.booking.pickupTime}
                        </span>
                      </div>
                    )}
                    {bookingSummaryData.booking.notes && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Notes:</span>
                        <span className="font-medium text-gray-900">{bookingSummaryData.booking.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-3">Pricing Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Unit Price:</span>
                      <span className="font-medium text-blue-900">₱{bookingSummaryData.pricing.unitPrice}</span>
                    </div>
                    {bookingSummaryData.booking.quantity > 1 && (
                      <div className="flex justify-between">
                        <span className="text-blue-700">Quantity:</span>
                        <span className="font-medium text-blue-900">×{bookingSummaryData.booking.quantity}</span>
                      </div>
                    )}
                    {bookingSummaryData.pricing.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Early Booking Discount:</span>
                        <span className="font-medium">-{bookingSummaryData.pricing.discount}%</span>
                      </div>
                    )}
                    <div className="border-t border-blue-200 pt-2 mt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-blue-900">Total Amount:</span>
                        <span className="text-blue-900">₱{bookingSummaryData.pricing.totalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Availability Status */}
                {bookingSummaryData.availability && (
                  <div className={`p-3 rounded-lg ${
                    bookingSummaryData.availability.available
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${bookingSummaryData.availability.available ? 'text-green-600' : 'text-red-600'}`}>
                        {bookingSummaryData.availability.available ? '✓' : '⚠️'}
                      </span>
                      <span className={`text-sm font-medium ${bookingSummaryData.availability.available ? 'text-green-800' : 'text-red-800'}`}>
                        {bookingSummaryData.availability.available ? 'Service is available' : 'Service availability may have changed'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowBookingSummary(false)}
                  className="flex-1 btn-secondary"
                >
                  Review Details
                </button>
                <button
                  onClick={handleConfirmBooking}
                  className="flex-1 btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : 'Proceed to Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Time Picker Modal */}
      {showDateTimePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Select Delivery Time</h3>

              {/* Delivery Date Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Delivery Date</label>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <span>📅</span>
                    <span className="font-medium">
                      {selectedDate ? selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'No date selected'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Date selected from your reservation</p>
                </div>
              </div>

              {/* Time Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Delivery Time</label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <select
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                    className="input-field text-center"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                      <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-lg text-center font-semibold">:</span>
                  <select
                    value={selectedMinute}
                    onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                    className="input-field text-center"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map(minute => (
                      <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>

                {/* AM/PM Selection */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAmPm('AM')}
                    className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                      selectedAmPm === 'AM'
                        ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                        : 'border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAmPm('PM')}
                    className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                      selectedAmPm === 'PM'
                        ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                        : 'border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    PM
                  </button>
                </div>

                {/* Availability Status */}
                {availabilityChecked && availabilityStatus && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    availabilityStatus.available
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-lg ${availabilityStatus.available ? 'text-green-600' : 'text-red-600'}`}>
                        {availabilityStatus.available ? '✓' : '✗'}
                      </span>
                      <div className={`flex-1 text-sm leading-relaxed ${
                        availabilityStatus.available ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {availabilityStatus.available ? (
                          <div>
                            <div className="font-semibold mb-1">Available</div>
                            <div className="text-xs">
                              {availabilityStatus.availableQuantity} {availabilityStatus.availableQuantity === 1 ? 'item' : 'items'} left
                              {availabilityStatus.requiresDelivery && availabilityStatus.deliveryTruckAvailable && (
                                <div className="mt-1">• Delivery truck available</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold mb-1">Not Available</div>
                            <div className="text-xs mt-1">
                              {availabilityStatus.reason?.includes('active event reservation') ? (
                                <div className="space-y-2">
                                  <div>{availabilityStatus.reason}</div>
                                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs">
                                    <div className="font-medium mb-1">💡 What to do next:</div>
                                    <div>• Complete or cancel your current event booking</div>
                                    <div>• Visit your bookings page to manage existing reservations</div>
                                  </div>
                                </div>
                              ) : (
                                availabilityStatus.reason
                              )}
                              {availabilityStatus.deliveryTruckReason && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                                  <div className="font-medium mb-1">🚚 Delivery Truck Unavailable</div>
                                  <div>{availabilityStatus.deliveryTruckReason}</div>
                                  {availabilityStatus.nextAvailableDeliveryTime && (
                                    <div className="mt-1 text-xs">
                                      Next available: {new Date(availabilityStatus.nextAvailableDeliveryTime).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* OK Button below AM/PM */}
                <button
                  type="button"
                  onClick={handleTimeConfirm}
                  disabled={!selectedDate || !availabilityChecked || !availabilityStatus?.available}
                  className={`w-full mt-4 font-semibold py-3 px-4 rounded ${
                    !selectedDate || !availabilityChecked || !availabilityStatus?.available
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {!selectedDate
                    ? 'No delivery date selected'
                    : !availabilityChecked
                    ? 'Checking availability...'
                    : availabilityStatus?.available
                      ? 'Confirm Delivery Time'
                      : 'Not Available'
                  }
                </button>
              </div>

              {/* Cancel Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDateTimePicker(false)}
                  className="flex-1 btn-secondary"
                  disabled={showTimeConfirmation}
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Time Confirmation Overlay */}
            {showTimeConfirmation && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-95 flex items-center justify-center rounded-lg">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Date & Time Confirmed!</h3>
                  <p className="text-green-100">Your booking schedule has been set successfully.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Queued Reservation Message */}
      {queued && (
        <div className="mt-8 card p-6 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">⏳</div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-700">Reservation Queued</h3>
              <p className="text-sm text-[var(--muted)]">
                Your requested item is currently unavailable. You've been added to the reservation queue with first-come, first-served priority.
              </p>
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Alternative Options Available:</h4>
              <div className="space-y-3">
                {alternatives.map((alt, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{alt.name}</span>
                      <span className="text-sm text-[var(--muted)] ml-2">
                        ₱{alt.price} • {alt.availableQuantity} available
                      </span>
                      <br />
                      <span className="text-xs text-[var(--muted)]">{alt.reason}</span>
                    </div>
                    <Link
                      href={`/customer/booking/${alt.serviceId}`}
                      className="btn-secondary text-sm"
                    >
                      Book This Instead
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>What happens next?</strong><br />
              • You'll be notified immediately when your reservation becomes available<br />
              • We'll process reservations in first-come, first-served order<br />
              • Check your notifications and bookings page for updates
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <Link href="/customer/bookings" className="btn-primary">
              View My Bookings
            </Link>
            <Link href="/customer/services" className="btn-secondary">
              Browse More Services
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
