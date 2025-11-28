'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from './Button';

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

  // Save booking data to localStorage whenever it changes
  useEffect(() => {
    const dataToSave = {
      serviceId: service._id,
      currentStep,
      bookingData,
      timestamp: Date.now()
    };
    localStorage.setItem(`booking_wizard_${service._id}`, JSON.stringify(dataToSave));
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

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate date and time selection
      if (!bookingData.bookingDate) {
        alert('Please select a date and time');
        return;
      }

      // Check availability
      const isAvailable = await checkAvailability(bookingData.bookingDate.split('T')[0], bookingData.quantity);
      if (!isAvailable) {
        alert('Selected date/time is not available. Please choose another time.');
        return;
      }

      // Calculate price
      const bookingDate = new Date(bookingData.bookingDate);
      const now = new Date();
      const daysBefore = Math.ceil((bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const price = calculatePrice(bookingData.quantity, daysBefore);
      setCalculatedPrice(price);
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
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
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={service.quantity || 10}
                    value={bookingData.quantity}
                    onChange={(e) => setBookingData({ ...bookingData, quantity: parseInt(e.target.value) || 1 })}
                    className="input-field w-full max-w-xs"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum available: {service.quantity} units
                  </p>
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
                  <label className="block text-sm font-medium mb-2">Preferred Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingData.bookingDate ? bookingData.bookingDate.split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value;
                      if (date) {
                        // Set default time to 9 AM if no time selected
                        const dateTime = `${date}T09:00:00`;
                        setBookingData({ ...bookingData, bookingDate: dateTime });
                      }
                    }}
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Preferred Time</label>
                  <select
                    value={bookingData.bookingDate ? bookingData.bookingDate.split('T')[1]?.split(':')[0] || '09' : '09'}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const date = bookingData.bookingDate.split('T')[0];
                      const dateTime = `${date}T${hour}:00:00`;
                      setBookingData({ ...bookingData, bookingDate: dateTime });
                    }}
                    className="input-field w-full"
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
                    <label className="block text-sm font-medium mb-2">Delivery Time (Optional)</label>
                    <select
                      value={bookingData.deliveryTime}
                      onChange={(e) => setBookingData({ ...bookingData, deliveryTime: e.target.value })}
                      className="input-field w-full"
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
      {/* Progress Indicator */}
      <div className="mb-8">
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
        >
          {currentStep > 0 ? 'Previous' : 'Cancel'}
        </Button>

        <div className="text-sm text-gray-500">
          Step {currentStep + 1} of {steps.length}
        </div>

        <Button
          onClick={currentStep === steps.length - 1 ? handleComplete : handleNext}
          loading={loading}
          disabled={loading}
        >
          {currentStep === steps.length - 1 ? 'Complete Booking' : 'Next'}
        </Button>
      </div>
    </div>
  );
}