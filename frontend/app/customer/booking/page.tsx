'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '../../../components/Button';
import Calendar from '../../../components/Calendar';

interface Equipment {
  _id: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  serviceType: string;
  eventTypes?: string[];
  price: number;
  priceType: string;
  duration?: number;
  quantity?: number;
  location?: string;
  tags?: string[];
  features?: string[];
  includedItems?: string[];
  requirements?: string[];
  image?: string;
  gallery?: string[];
  minOrder?: number;
  maxOrder?: number;
  leadTime?: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  serviceType: string;
  category: string;
  image?: string;
  maxOrder?: number;
  availableQuantity?: number;
  quantity: number;
}

type BookingStep = 'equipments' | 'datetime' | 'details' | 'review' | 'payment';

export default function BookingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<BookingStep>('equipments');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<CartItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [bookingDetails, setBookingDetails] = useState({
    eventType: '',
    guestCount: 1,
    specialRequests: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState<any>(null);
  const [calendarAvailability, setCalendarAvailability] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});

  const steps = [
    { id: 'equipments', label: 'Select Equipments', icon: '🎯' },
    { id: 'datetime', label: 'Date & Time', icon: '📅' },
    { id: 'details', label: 'Event Details', icon: '📝' },
    { id: 'review', label: 'Review & Confirm', icon: '✅' },
    { id: 'payment', label: 'Payment', icon: '💳' },
  ];

  useEffect(() => {
    fetchEquipments();
  }, []);

  useEffect(() => {
    calculateTotalPrice();
  }, [selectedEquipments]);

  // Fetch calendar availability when entering datetime step or when equipments change
  useEffect(() => {
    if (currentStep === 'datetime' && selectedEquipments.length > 0) {
      const currentDate = new Date();
      fetchCalendarAvailability(currentDate.getMonth(), currentDate.getFullYear());
    }
  }, [currentStep, selectedEquipments]);

  const fetchEquipments = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/services?sortBy=name&sortOrder=asc');
      const data = await response.json();
      if (data.success) {
        setEquipments(data.services);
      }
    } catch (error) {
      console.error('Failed to fetch equipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPrice = () => {
    const total = selectedEquipments.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotalPrice(total);
  };

  const addEquipmentToReservation = (equipment: Equipment) => {
    const existingItem = selectedEquipments.find(item => item.id === equipment._id);
    if (existingItem) {
      if (existingItem.quantity < (equipment.maxOrder || equipment.quantity || 10)) {
        setSelectedEquipments(prev =>
          prev.map(item =>
            item.id === equipment._id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      }
    } else {
      setSelectedEquipments(prev => [...prev, {
        id: equipment._id,
        name: equipment.name,
        price: equipment.price,
        serviceType: equipment.serviceType,
        category: equipment.category,
        image: equipment.image,
        maxOrder: equipment.maxOrder,
        availableQuantity: equipment.quantity,
        quantity: 1,
      }]);
    }
  };

  const removeEquipmentFromReservation = (equipmentId: string) => {
    setSelectedEquipments(prev => prev.filter(item => item.id !== equipmentId));
  };

  const updateEquipmentQuantity = (equipmentId: string, quantity: number) => {
    if (quantity <= 0) {
      removeEquipmentFromReservation(equipmentId);
      return;
    }

    setSelectedEquipments(prev =>
      prev.map(item =>
        item.id === equipmentId
          ? { ...item, quantity: Math.min(quantity, item.maxOrder || item.availableQuantity || 10) }
          : item
      )
    );
  };

  const fetchCalendarAvailability = async (month: number, year: number) => {
    if (selectedEquipments.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get all dates in the month
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const availabilityPromises = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];

        // Check availability for all selected equipments on this date
        const equipmentPromises = selectedEquipments.map(async (item) => {
          try {
            const response = await fetch(
              `http://localhost:5000/api/bookings/check-availability/${item.id}?date=${dateString}&quantity=${item.quantity}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            return { equipmentId: item.id, date: dateString, ...data };
          } catch (error) {
            return { equipmentId: item.id, date: dateString, available: false, reason: 'Error checking availability' };
          }
        });

        availabilityPromises.push(...equipmentPromises);
      }

      const results = await Promise.all(availabilityPromises);

      // Aggregate availability by date
      const dateAvailability: { [key: string]: any } = {};
      results.forEach(result => {
        if (!dateAvailability[result.date]) {
          dateAvailability[result.date] = {
            date: result.date,
            available: true,
            totalQuantity: 0,
            availableQuantity: 0,
            equipments: []
          };
        }

        dateAvailability[result.date].equipments.push(result);
        dateAvailability[result.date].available = dateAvailability[result.date].available && result.available;

        if (result.availableQuantity !== undefined) {
          dateAvailability[result.date].availableQuantity += result.availableQuantity;
          dateAvailability[result.date].totalQuantity += result.totalQuantity || result.availableQuantity;
        }
      });

      const calendarData = Object.values(dateAvailability);
      setCalendarAvailability(calendarData);
    } catch (error) {
      console.error('Error fetching calendar availability:', error);
    }
  };

  const checkAvailability = async () => {
    if (!selectedDate || !selectedTime || selectedEquipments.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const dateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      dateTime.setHours(parseInt(hours), parseInt(minutes));

      // Check availability for all selected equipments
      const availabilityPromises = selectedEquipments.map(async (item) => {
        const response = await fetch(
          `http://localhost:5000/api/bookings/check-availability/${item.id}?date=${dateTime.toISOString().split('T')[0]}&quantity=${item.quantity}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();
        return { equipmentId: item.id, ...data };
      });

      const results = await Promise.all(availabilityPromises);
      setAvailability(results);
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  const nextStep = () => {
    if (!validateCurrentStep()) {
      return;
    }

    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as BookingStep);
    }
  };

  const prevStep = () => {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as BookingStep);
    }
  };

  const canGoBack = () => {
    return currentStep !== 'equipments';
  };

  const validateCurrentStep = () => {
    const errors: {[key: string]: string} = {};
    setFieldErrors({});

    switch (currentStep) {
      case 'equipments':
        if (selectedEquipments.length === 0) {
          setError('Please select at least one equipment to continue');
          return false;
        }
        break;

      case 'datetime':
        if (!selectedDate) {
          errors.date = 'Please select a date';
        }
        if (!selectedTime) {
          errors.time = 'Please select a time';
        }
        if (!availability || !availability.every((a: any) => a.available)) {
          setError('Please check availability and ensure all selected services are available');
          return false;
        }
        break;

      case 'details':
        if (!bookingDetails.eventType) {
          errors.eventType = 'Please select an event type';
        }
        if (!bookingDetails.contactName.trim()) {
          errors.contactName = 'Please enter your full name';
        }
        if (!bookingDetails.contactEmail.trim()) {
          errors.contactEmail = 'Please enter your email address';
        } else if (!/\S+@\S+\.\S+/.test(bookingDetails.contactEmail)) {
          errors.contactEmail = 'Please enter a valid email address';
        }
        if (bookingDetails.guestCount < 1) {
          errors.guestCount = 'Number of guests must be at least 1';
        }
        break;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please correct the errors below');
      return false;
    }

    setError('');
    return true;
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 'equipments':
        return selectedEquipments.length > 0;
      case 'datetime':
        return selectedDate && selectedTime && availability?.every((a: any) => a.available);
      case 'details':
        return bookingDetails.eventType && bookingDetails.contactName && bookingDetails.contactEmail;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
          const isAccessible = index <= steps.findIndex(s => s.id === currentStep);

          return (
            <div key={step.id} className="flex items-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200
                ${isCompleted ? 'bg-green-500 border-green-500 text-white' :
                  isActive ? 'bg-[var(--primary)] border-[var(--primary)] text-white' :
                  isAccessible ? 'border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white' :
                  'border-gray-300 text-gray-400'}
              `}>
                {isCompleted ? '✓' : step.icon}
              </div>
              <span className={`
                ml-2 text-sm font-medium transition-colors duration-200
                ${isActive ? 'text-[var(--primary)]' :
                  isCompleted ? 'text-green-600' :
                  isAccessible ? 'text-gray-700' : 'text-gray-400'}
              `}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`
                  w-12 h-0.5 mx-4 transition-colors duration-200
                  ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderEquipmentsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Select Your Equipments</h2>
        <p className="text-[var(--muted)]">Choose the equipments you need for your event</p>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading equipments...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipments.map((equipment) => (
            <div key={equipment._id} className="card p-6 group hover:shadow-lg transition-shadow duration-200">
              {equipment.image && (
                <img
                  src={equipment.image.startsWith('/uploads/') ? `http://localhost:5000${equipment.image}` : equipment.image}
                  alt={equipment.name}
                  className="w-full h-32 object-cover rounded-lg mb-4"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Equipment+Image';
                  }}
                />
              )}

              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 group-hover:text-[var(--primary)] transition-colors">
                  {equipment.name}
                </h3>
                <p className="text-[var(--muted)] text-sm mb-3 line-clamp-2">
                  {equipment.shortDescription || equipment.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-[var(--primary)]">₱{equipment.price}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    equipment.serviceType === 'service' ? 'bg-blue-100 text-blue-800' :
                    equipment.serviceType === 'equipment' ? 'bg-green-100 text-green-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {equipment.serviceType}
                  </span>
                </div>

                {selectedEquipments.find(item => item.id === equipment._id) ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateEquipmentQuantity(equipment._id,
                          selectedEquipments.find(item => item.id === equipment._id)!.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="font-medium">
                        {selectedEquipments.find(item => item.id === equipment._id)?.quantity}
                      </span>
                      <button
                        onClick={() => updateEquipmentQuantity(equipment._id,
                          selectedEquipments.find(item => item.id === equipment._id)!.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeEquipmentFromReservation(equipment._id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addEquipmentToReservation(equipment)}
                    className="w-full btn-primary"
                  >
                    Add to Reservation
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Equipments Summary */}
      {selectedEquipments.length > 0 && (
        <div className="card p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold mb-4 text-blue-900">Selected Equipments ({selectedEquipments.length})</h3>
          <div className="space-y-3">
            {selectedEquipments.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b border-blue-200 last:border-b-0">
                <div>
                  <span className="font-medium text-blue-900">{item.name}</span>
                  <span className="text-sm text-blue-700 ml-2">×{item.quantity}</span>
                </div>
                <span className="font-semibold text-blue-900">₱{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-blue-300">
              <span className="font-bold text-blue-900">Total</span>
              <span className="font-bold text-blue-900 text-xl">₱{totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDateTimeStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Select Date & Time</h2>
        <p className="text-[var(--muted)]">Choose when you want your services</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Calendar */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Select Date</h3>
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              setSelectedDate(date);
              // Fetch availability for the new month if needed
              fetchCalendarAvailability(date.getMonth(), date.getFullYear());
            }}
            minDate={new Date()}
            availabilityData={calendarAvailability}
            className="w-full"
          />
        </div>

        {/* Time Selection */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Select Time</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedTime === time
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                      : 'border-gray-200 hover:border-[var(--primary)] hover:bg-[var(--primary)]/10'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>

            {selectedDate && selectedTime && (
              <button
                onClick={checkAvailability}
                className="w-full btn-primary"
              >
                Check Availability
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Availability Status */}
      {availability && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Availability Check</h3>
          <div className="space-y-3">
            {availability.map((item: any) => (
              <div key={item.equipmentId} className={`p-4 rounded-lg ${
                item.available ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${item.available ? 'text-green-600' : 'text-red-600'}`}>
                    {item.available ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">
                      {selectedEquipments.find(s => s.id === item.equipmentId)?.name}
                    </div>
                    <div className={`text-sm ${item.available ? 'text-green-700' : 'text-red-700'}`}>
                      {item.available ? 'Available' : item.reason || 'Not available'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Event Details</h2>
        <p className="text-[var(--muted)]">Tell us more about your event</p>
      </div>

      <div className="card p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Event Type *</label>
            <select
              value={bookingDetails.eventType}
              onChange={(e) => {
                setBookingDetails(prev => ({ ...prev, eventType: e.target.value }));
                if (fieldErrors.eventType) {
                  setFieldErrors(prev => ({ ...prev, eventType: '' }));
                }
              }}
              className={`input-field w-full ${fieldErrors.eventType ? 'border-red-500 focus:border-red-500' : ''}`}
              required
              aria-invalid={!!fieldErrors.eventType}
              aria-describedby={fieldErrors.eventType ? 'eventType-error' : undefined}
            >
              <option value="">Select event type</option>
              <option value="wedding">Wedding</option>
              <option value="birthday">Birthday</option>
              <option value="corporate">Corporate Event</option>
              <option value="graduation">Graduation</option>
              <option value="party">Party</option>
              <option value="other">Other</option>
            </select>
            {fieldErrors.eventType && (
              <p id="eventType-error" className="text-red-500 text-sm mt-1">{fieldErrors.eventType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Number of Guests</label>
            <input
              type="number"
              min="1"
              value={bookingDetails.guestCount}
              onChange={(e) => {
                setBookingDetails(prev => ({ ...prev, guestCount: parseInt(e.target.value) || 1 }));
                if (fieldErrors.guestCount) {
                  setFieldErrors(prev => ({ ...prev, guestCount: '' }));
                }
              }}
              className={`input-field w-full ${fieldErrors.guestCount ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {fieldErrors.guestCount && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.guestCount}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Special Requests</label>
          <textarea
            value={bookingDetails.specialRequests}
            onChange={(e) => setBookingDetails(prev => ({ ...prev, specialRequests: e.target.value }))}
            className="input-field w-full"
            rows={3}
            placeholder="Any special requirements or notes..."
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Contact Information</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name *</label>
              <input
                type="text"
                value={bookingDetails.contactName}
                onChange={(e) => {
                  setBookingDetails(prev => ({ ...prev, contactName: e.target.value }));
                  if (fieldErrors.contactName) {
                    setFieldErrors(prev => ({ ...prev, contactName: '' }));
                  }
                }}
                className={`input-field w-full ${fieldErrors.contactName ? 'border-red-500 focus:border-red-500' : ''}`}
                required
              />
              {fieldErrors.contactName && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.contactName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                value={bookingDetails.contactPhone}
                onChange={(e) => setBookingDetails(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Email Address *</label>
            <input
              type="email"
              value={bookingDetails.contactEmail}
              onChange={(e) => {
                setBookingDetails(prev => ({ ...prev, contactEmail: e.target.value }));
                if (fieldErrors.contactEmail) {
                  setFieldErrors(prev => ({ ...prev, contactEmail: '' }));
                }
              }}
              className={`input-field w-full ${fieldErrors.contactEmail ? 'border-red-500 focus:border-red-500' : ''}`}
              required
            />
            {fieldErrors.contactEmail && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.contactEmail}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Review Your Booking</h2>
        <p className="text-[var(--muted)]">Please review all details before confirming</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Services Summary */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 text-lg">Selected Services</h3>
          <div className="space-y-4">
            {selectedEquipments.map((item) => (
              <div key={item.id} className="flex justify-between items-start py-3 border-b last:border-b-0">
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-[var(--muted)]">Quantity: {item.quantity}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">₱{(item.price * item.quantity).toLocaleString()}</div>
                  <div className="text-sm text-[var(--muted)]">₱{item.price} each</div>
                </div>
              </div>
            ))}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total Amount</span>
                <span className="text-[var(--primary)]">₱{totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4 text-lg">Date & Time</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Date:</span>
                <span className="font-medium">{selectedDate?.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Time:</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4 text-lg">Event Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Event Type:</span>
                <span className="font-medium capitalize">{bookingDetails.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Guests:</span>
                <span className="font-medium">{bookingDetails.guestCount}</span>
              </div>
              {bookingDetails.specialRequests && (
                <div>
                  <span className="text-[var(--muted)] block mb-1">Special Requests:</span>
                  <span className="font-medium">{bookingDetails.specialRequests}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4 text-lg">Contact Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Name:</span>
                <span className="font-medium">{bookingDetails.contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Email:</span>
                <span className="font-medium">{bookingDetails.contactEmail}</span>
              </div>
              {bookingDetails.contactPhone && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Phone:</span>
                  <span className="font-medium">{bookingDetails.contactPhone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="card p-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
        <p className="text-[var(--muted)] mb-6">
          Your booking has been successfully submitted. You will receive a confirmation email shortly.
        </p>
        <div className="space-y-3">
          <Link href="/customer/bookings" className="block w-full btn-primary">
            View My Bookings
          </Link>
          <Link href="/customer/services" className="block w-full btn-secondary">
            Book More Services
          </Link>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'equipments':
        return renderEquipmentsStep();
      case 'datetime':
        return renderDateTimeStep();
      case 'details':
        return renderDetailsStep();
      case 'review':
        return renderReviewStep();
      case 'payment':
        return renderPaymentStep();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reserve Your Event Equipments</h1>
          <p className="text-lg text-gray-600">Create unforgettable memories with our professional equipments</p>
        </div>

        {/* Progress Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        {currentStep !== 'payment' && (
          <div className="flex justify-between items-center">
            <Button
              onClick={prevStep}
              variant="outline"
              disabled={!canGoBack()}
            >
              Previous
            </Button>

            <div className="flex items-center gap-4">
              {currentStep === 'review' && (
                <div className="text-sm text-gray-600">
                  Total: <span className="font-bold text-[var(--primary)]">₱{totalPrice.toLocaleString()}</span>
                </div>
              )}

              <Button
                onClick={nextStep}
                disabled={!canProceedToNext() || submitting}
                loading={submitting}
              >
                {currentStep === 'review' ? 'Confirm Booking' : 'Next'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}