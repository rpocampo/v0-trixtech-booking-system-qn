'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from './Button';

interface PredictiveSuggestion {
  service: {
    _id: string;
    name: string;
    description: string;
    category: string;
    basePrice: number;
    image?: string;
  };
  confidence: number;
  reasons: string[];
}

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  quantity?: number;
  duration: number;
  image?: string;
}

interface BookingWizardProps {
  service: Service;
  onComplete: (bookingData: any) => void;
  onCancel: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export default function BookingWizard({ service, onComplete, onCancel }: BookingWizardProps) {
  const router = useRouter();

  // Load saved booking data from localStorage
  const loadSavedBookingData = () => {
    const saved = localStorage.getItem(`booking_wizard_${service._id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only return if it's for the same service and not older than 24 hours
        if (parsed.serviceId === service._id && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return {
            currentStep: parsed.currentStep || 0,
            bookingData: parsed.bookingData || {
              quantity: 1,
              bookingDate: '',
              deliveryTime: '',
              notes: '',
              addons: [] as string[]
            }
          };
        }
      } catch (error) {
        console.error('Failed to load saved booking data:', error);
      }
    }
    return null;
  };

  const savedData = loadSavedBookingData();
  const [currentStep, setCurrentStep] = useState(savedData?.currentStep || 0);
  const [bookingData, setBookingData] = useState(savedData?.bookingData || {
    quantity: 1,
    bookingDate: '',
    deliveryTime: '',
    notes: '',
    addons: [] as string[]
  });
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<any>(null);
  const [calculatedPrice, setCalculatedPrice] = useState(service.basePrice);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [touched, setTouched] = useState<{[key: string]: boolean}>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [suggestions, setSuggestions] = useState<PredictiveSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Auto-save booking data to localStorage with debouncing
  useEffect(() => {
    const saveData = async () => {
      setAutoSaveStatus('saving');
      try {
        const dataToSave = {
          serviceId: service._id,
          currentStep,
          bookingData,
          timestamp: Date.now()
        };
        localStorage.setItem(`booking_wizard_${service._id}`, JSON.stringify(dataToSave));
        setAutoSaveStatus('saved');

        // Reset status after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    };

    // Debounce auto-save by 1 second
    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentStep, bookingData, service._id]);

  const steps: WizardStep[] = [
    {
      id: 'details',
      title: 'Service Details',
      description: 'Review service information and select quantity',
      completed: false,
      current: currentStep === 0
    },
    {
      id: 'schedule',
      title: 'Schedule',
      description: 'Choose date and time for your booking',
      completed: false,
      current: currentStep === 1
    },
    {
      id: 'options',
      title: 'Additional Options',
      description: 'Add delivery time and special notes',
      completed: false,
      current: currentStep === 2
    },
    {
      id: 'confirm',
      title: 'Confirm & Pay',
      description: 'Review your booking and complete payment',
      completed: false,
      current: currentStep === 3
    }
  ];

  // Update step completion status
  useEffect(() => {
    const updatedSteps = steps.map((step, index) => ({
      ...step,
      completed: index < currentStep,
      current: index === currentStep
    }));
    // Update local steps state if needed
  }, [currentStep]);

  const checkAvailability = async (date: string, quantity: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:5000/api/bookings/check-availability/${service._id}?date=${date}&quantity=${quantity}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailabilityStatus(data);
        setAvailabilityChecked(true);
        return data.available;
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
    return false;
  };

  const calculatePrice = (quantity: number, daysBefore: number) => {
    // Simple price calculation - could be enhanced with dynamic pricing
    const basePrice = service.basePrice;
    let multiplier = 1.0;

    // Price tiers based on days before booking
    if (daysBefore >= 30) multiplier = 1.0;
    else if (daysBefore >= 14) multiplier = 1.1;
    else if (daysBefore >= 7) multiplier = 1.2;
    else if (daysBefore >= 3) multiplier = 1.3;
    else multiplier = 1.5;

    return Math.round(basePrice * multiplier * quantity);
  };

  // Validation functions
  const validateStep = (step: number): boolean => {
    const newErrors: {[key: string]: string} = {};

    switch (step) {
      case 0: // Service Details
        if (service.category === 'equipment' && (!bookingData.quantity || bookingData.quantity < 1)) {
          newErrors.quantity = 'Please select a valid quantity';
        }
        break;

      case 1: // Schedule
        if (!bookingData.bookingDate) {
          newErrors.bookingDate = 'Please select a date and time';
        } else {
          const selectedDate = new Date(bookingData.bookingDate);
          const now = new Date();
          if (selectedDate <= now) {
            newErrors.bookingDate = 'Please select a future date and time';
          }
        }
        break;

      case 2: // Additional Options
        // Validate delivery time if provided
        if (service.category === 'equipment' && bookingData.deliveryTime) {
          const bookingDate = new Date(bookingData.bookingDate);
          const deliveryDateTime = new Date(`${bookingData.bookingDate.split('T')[0]}T${bookingData.deliveryTime}`);

          if (deliveryDateTime <= bookingDate) {
            newErrors.deliveryTime = 'Delivery time must be after the booking time';
          }
        }
        break;

      case 3: // Confirm & Pay
        // All previous validations should pass
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: string, value: any) => {
    setBookingData({ ...bookingData, [field]: value });
    setTouched({ ...touched, [field]: true });

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const showFieldError = (field: string): string => {
    return touched[field] && errors[field] ? errors[field] : '';
  };

  // Fetch suggestions for the current service
  const fetchSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:5000/api/bookings/suggestions/predictive?serviceId=${service._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.suggestions.slice(0, 3)); // Show top 3 suggestions
        }
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  // Load suggestions when component mounts
  useEffect(() => {
    fetchSuggestions();
  }, [service._id]);

  const handleNext = async () => {
    // Validate current step
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === 1) {
      setLoading(true);
      try {
        // Check availability
        const isAvailable = await checkAvailability(bookingData.bookingDate.split('T')[0], bookingData.quantity);
        if (!isAvailable) {
          setErrors({ bookingDate: 'Selected date/time is not available. Please choose another time.' });
          setTouched({ bookingDate: true });
          return;
        }

        // Calculate price
        const bookingDate = new Date(bookingData.bookingDate);
        const now = new Date();
        const daysBefore = Math.ceil((bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const price = calculatePrice(bookingData.quantity, daysBefore);
        setCalculatedPrice(price);
      } catch (error) {
        console.error('Error checking availability:', error);
        setErrors({ general: 'Failed to check availability. Please try again.' });
        return;
      } finally {
        setLoading(false);
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Clear general errors when moving to next step
      setErrors({ ...errors, general: '' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await onComplete(bookingData);
      // Clear saved booking data on successful completion
      localStorage.removeItem(`booking_wizard_${service._id}`);
    } catch (error) {
      console.error('Error completing booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-xl font-semibold mb-4">{service.name}</h3>
              <p className="text-gray-600 mb-4">{service.description}</p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="font-semibold">{service.duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className="font-semibold capitalize">{service.category}</span>
                </div>
                <div className="flex justify-between">
                  <span>Base Price:</span>
                  <span className="font-semibold text-green-600">₱{service.basePrice}</span>
                </div>
                {service.quantity && (
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className={`font-semibold ${service.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {service.quantity} units
                    </span>
                  </div>
                )}
              </div>

              {service.category === 'equipment' && (
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="quantity">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    max={service.quantity || 10}
                    value={bookingData.quantity}
                    onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 1)}
                    onBlur={() => setTouched({ ...touched, quantity: true })}
                    className={`input-field w-full max-w-xs ${showFieldError('quantity') ? 'border-red-500 focus:border-red-500' : ''}`}
                    aria-describedby={showFieldError('quantity') ? 'quantity-error' : undefined}
                    aria-invalid={!!showFieldError('quantity')}
                  />
                  {showFieldError('quantity') && (
                    <p id="quantity-error" className="text-sm text-red-600 mt-1" role="alert">
                      {showFieldError('quantity')}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="text-xs text-[var(--muted)]">Pax: {service.quantity}</span>
                  </p>
                </div>
              )}

              {/* Smart Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                        <span>💡</span>
                        Smart Suggestions
                      </h4>
                      <button
                        onClick={() => setShowSuggestions(!showSuggestions)}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        {showSuggestions ? 'Hide' : 'Show'} suggestions
                      </button>
                    </div>

                    {showSuggestions && (
                      <div className="space-y-3">
                        <p className="text-sm text-blue-700">
                          Based on what other customers added to similar bookings:
                        </p>
                        <div className="grid gap-3">
                          {suggestions.map((suggestion, index) => (
                            <div key={suggestion.service._id} className="bg-white border border-blue-200 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-800">
                                      {suggestion.service.name}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      suggestion.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                                      suggestion.confidence >= 0.6 ? 'bg-blue-100 text-blue-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {Math.round(suggestion.confidence * 100)}% match
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 line-clamp-2">
                                    {suggestion.service.description}
                                  </p>
                                  <p className="text-sm font-semibold text-blue-600 mt-1">
                                    ₱{suggestion.service.basePrice.toFixed(2)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    // Could add logic to add to cart or navigate to service
                                    alert(`Consider adding ${suggestion.service.name} to your booking!`);
                                  }}
                                  className="ml-3 btn-primary text-xs px-3 py-1"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          💡 Tip: Adding complementary services can enhance your event experience
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-xl font-semibold mb-4">Select Date & Time</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="booking-date">
                    Preferred Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingData.bookingDate ? bookingData.bookingDate.split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value;
                      if (date) {
                        // Set default time to 9 AM if no time selected
                        const dateTime = `${date}T09:00:00`;
                        handleFieldChange('bookingDate', dateTime);
                      }
                    }}
                    onBlur={() => setTouched({ ...touched, bookingDate: true })}
                    className={`input-field w-full ${showFieldError('bookingDate') ? 'border-red-500 focus:border-red-500' : ''}`}
                    aria-describedby={showFieldError('bookingDate') ? 'booking-date-error' : undefined}
                    aria-invalid={!!showFieldError('bookingDate')}
                  />
                  {showFieldError('bookingDate') && (
                    <p id="booking-date-error" className="text-sm text-red-600 mt-1" role="alert">
                      {showFieldError('bookingDate')}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Select your preferred booking date
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="booking-time">
                    Preferred Time <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="booking-time"
                    value={bookingData.bookingDate ? bookingData.bookingDate.split('T')[1]?.split(':')[0] || '09' : '09'}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const date = bookingData.bookingDate.split('T')[0];
                      const dateTime = `${date}T${hour}:00:00`;
                      handleFieldChange('bookingDate', dateTime);
                    }}
                    onBlur={() => setTouched({ ...touched, bookingDate: true })}
                    className={`input-field w-full ${showFieldError('bookingDate') ? 'border-red-500 focus:border-red-500' : ''}`}
                    aria-describedby={showFieldError('bookingDate') ? 'booking-date-error' : undefined}
                    aria-invalid={!!showFieldError('bookingDate')}
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = i + 8; // 8 AM to 8 PM
                      const displayHour = hour <= 12 ? hour : hour - 12;
                      const ampm = hour < 12 ? 'AM' : 'PM';
                      return (
                        <option key={hour} value={hour.toString().padStart(2, '0')}>
                          {displayHour}:00 {ampm}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose your preferred time slot
                  </p>
                </div>

                {availabilityChecked && availabilityStatus && (
                  <div className={`p-4 rounded-lg ${
                    availabilityStatus.available
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={availabilityStatus.available ? 'text-green-600' : 'text-red-600'}>
                        {availabilityStatus.available ? '✓' : '✗'}
                      </span>
                      <span className={`text-sm font-medium ${
                        availabilityStatus.available ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {availabilityStatus.available ? 'Available' : 'Not Available'}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${
                      availabilityStatus.available ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {availabilityStatus.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-xl font-semibold mb-4">Additional Options</h3>

              <div className="space-y-4">
                {service.category === 'equipment' && (
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="delivery-time">
                      Delivery Time (Optional)
                    </label>
                    <select
                      id="delivery-time"
                      value={bookingData.deliveryTime}
                      onChange={(e) => handleFieldChange('deliveryTime', e.target.value)}
                      onBlur={() => setTouched({ ...touched, deliveryTime: true })}
                      className={`input-field w-full ${showFieldError('deliveryTime') ? 'border-red-500 focus:border-red-500' : ''}`}
                      aria-describedby={showFieldError('deliveryTime') ? 'delivery-time-error' : undefined}
                      aria-invalid={!!showFieldError('deliveryTime')}
                    >
                      <option value="">No delivery needed</option>
                      {Array.from({ length: 8 }, (_, i) => {
                        const hour = i + 9; // 9 AM to 5 PM
                        const displayHour = hour <= 12 ? hour : hour - 12;
                        const ampm = hour < 12 ? 'AM' : 'PM';
                        const timeString = `${hour.toString().padStart(2, '0')}:00`;
                        return (
                          <option key={timeString} value={timeString}>
                            {displayHour}:00 {ampm}
                          </option>
                        );
                      })}
                    </select>
                    {showFieldError('deliveryTime') && (
                      <p id="delivery-time-error" className="text-sm text-red-600 mt-1" role="alert">
                        {showFieldError('deliveryTime')}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      Delivery availability will be confirmed in the next step
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Special Notes (Optional)</label>
                  <textarea
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    className="input-field w-full"
                    rows={3}
                    placeholder="Any special requests or notes for this booking..."
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="text-xl font-semibold mb-4">Booking Summary</h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span>Service:</span>
                  <span className="font-semibold">{service.name}</span>
                </div>

                {service.category === 'equipment' && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Quantity:</span>
                    <span className="font-semibold">{bookingData.quantity}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 border-b">
                  <span>Date & Time:</span>
                  <span className="font-semibold">
                    {new Date(bookingData.bookingDate).toLocaleDateString()} at{' '}
                    {new Date(bookingData.bookingDate).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {bookingData.deliveryTime && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Delivery Time:</span>
                    <span className="font-semibold">{bookingData.deliveryTime}</span>
                  </div>
                )}

                {bookingData.notes && (
                  <div className="py-2 border-b">
                    <span className="font-medium">Notes:</span>
                    <p className="text-gray-600 mt-1">{bookingData.notes}</p>
                  </div>
                )}

                <div className="flex justify-between items-center py-4 border-t-2 border-gray-300 text-lg font-bold">
                  <span>Total Price:</span>
                  <span className="text-green-600">₱{calculatedPrice}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Ready to Book?</h4>
              <p className="text-sm text-blue-700">
                By proceeding, you'll be directed to secure payment. Your booking will be confirmed once payment is processed.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* General Error Display */}
      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 font-medium">{errors.general}</span>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mb-8">
        {/* Auto-save Status */}
        <div className="flex justify-end mb-2">
          <div className={`flex items-center text-sm ${autoSaveStatus === 'idle' ? 'text-gray-500' : autoSaveStatus === 'saving' ? 'text-blue-600' : autoSaveStatus === 'saved' ? 'text-green-600' : 'text-red-600'}`}>
            {autoSaveStatus === 'saving' && (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            )}
            {autoSaveStatus === 'error' && (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Save failed
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : step.current
                  ? 'border-blue-500 text-blue-500'
                  : 'border-gray-300 text-gray-400'
              }`}>
                {step.completed ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${step.current ? 'text-blue-600' : step.completed ? 'text-green-600' : 'text-gray-500'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  step.completed ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          onClick={currentStep > 0 ? handlePrevious : onCancel}
          variant="outline"
          disabled={loading}
          aria-label={currentStep > 0 ? 'Go to previous step' : 'Cancel booking process'}
        >
          {currentStep > 0 ? 'Previous' : 'Cancel'}
        </Button>

        <div className="text-sm text-gray-500" aria-live="polite">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}
        </div>

        <Button
          onClick={currentStep === steps.length - 1 ? handleComplete : handleNext}
          loading={loading}
          disabled={loading}
          aria-label={currentStep === steps.length - 1 ? 'Complete booking and proceed to payment' : 'Go to next step'}
        >
          {currentStep === steps.length - 1 ? 'Complete Booking' : 'Next'}
        </Button>
      </div>
    </div>
  );
}