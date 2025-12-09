'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '../../../components/SocketProvider';

interface Booking {
  _id: string;
  customerId: { name: string; email: string };
  serviceId?: {
    _id: string;
    name: string;
    price: number;
    category?: string;
    includedItems?: string[];
    includedEquipment?: Array<{
      equipmentId: string;
      quantity: number;
      name: string;
    }>;
    quantity?: number;
    serviceType?: string;
    requiresDelivery?: boolean;
    maxOrder?: number;
  };
  bookingDate: string;
  status: string;
  paymentStatus: string;
  paymentType?: string;
  amountPaid?: number;
  remainingBalance?: number;
  totalPrice: number;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
  itemQuantities?: { [itemName: string]: number };
  deliveryStartTime?: string;
  deliveryEndTime?: string;
  requiresDelivery?: boolean;
  duration?: number;
  dailyRate?: number;
  appliedMultiplier?: number;
  daysBeforeCheckout?: number;
  deliveryDuration?: number;
  downPaymentPercentage?: number;
  notes?: string;
  // Package booking fields
  isPackageBooking?: boolean;
  packageId?: string;
  packageName?: string;
  includedBookings?: string[];
}

export default function AdminBookings() {
  const { socket } = useSocket();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dailyBookings, setDailyBookings] = useState<Booking[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [editFormData, setEditFormData] = useState({
    quantity: 1,
    itemQuantities: {} as { [itemName: string]: number },
  });
  const [inventoryLevels, setInventoryLevels] = useState<{ [serviceId: string]: number }>({});
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateMessageType, setUpdateMessageType] = useState<'success' | 'error' | ''>('');

  const fetchBookings = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/bookings/admin/all', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        // Token expired or invalid, don't log as error
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Real-time booking updates
  useEffect(() => {
    if (!socket) return;

    const handleNewPendingBooking = (data: any) => {
      console.log('New pending booking received:', data);
      // Refresh bookings list
      fetchBookings();
    };

    const handleNewConfirmedBooking = (data: any) => {
      console.log('New confirmed booking received:', data);
      // Refresh bookings list
      fetchBookings();
    };

    const handleBookingUpdated = (data: any) => {
      console.log('Booking updated:', data);
      // Refresh bookings list
      fetchBookings();
    };

    socket.on('new-pending-booking', handleNewPendingBooking);
    socket.on('new-confirmed-booking', handleNewConfirmedBooking);
    socket.on('booking-updated', handleBookingUpdated);

    return () => {
      socket.off('new-pending-booking', handleNewPendingBooking);
      socket.off('new-confirmed-booking', handleNewConfirmedBooking);
      socket.off('booking-updated', handleBookingUpdated);
    };
  }, [socket]);

  useEffect(() => {
    let filtered = bookings;

    if (filters.status) {
      filtered = filtered.filter(booking => booking.status === filters.status);
    }

    if (filters.paymentStatus) {
      filtered = filtered.filter(booking => booking.paymentStatus === filters.paymentStatus);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(booking => new Date(booking.bookingDate) >= new Date(filters.dateFrom));
    }


    setFilteredBookings(filtered);
  }, [bookings, filters]);

  const updateBooking = async (bookingId: string, status: string, paymentStatus: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, paymentStatus }),
      });

      const data = await response.json();
      if (response.ok) {
        setBookings(bookings.map((b) => (b._id === bookingId ? data.booking : b)));
      }
    } catch (error) {
      console.error('Failed to update booking:', error);
    }
  };

  const viewBooking = async (booking: Booking) => {
    setShowBookingModal(true);
    setIsEditingBooking(false);
    setUpdateMessage('');
    setUpdateMessageType('');

    try {
      const token = localStorage.getItem('token');

      // Fetch the latest booking details from the server
      const bookingResponse = await fetch(`http://localhost:5000/api/bookings/${booking._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        if (bookingData.success) {
          setSelectedBooking(bookingData.booking);

          // Initialize edit form data with fresh data
          setEditFormData({
            quantity: bookingData.booking.quantity,
            itemQuantities: bookingData.booking.itemQuantities || {},
          });
        } else {
          // Fallback to the list data if fetch fails
          setSelectedBooking(booking);
          setEditFormData({
            quantity: booking.quantity,
            itemQuantities: booking.itemQuantities || {},
          });
        }
      } else {
        // Fallback to the list data if fetch fails
        setSelectedBooking(booking);
        setEditFormData({
          quantity: booking.quantity,
          itemQuantities: booking.itemQuantities || {},
        });
      }

      // Fetch inventory levels for the service and all included equipment
      if (booking.serviceId && booking.serviceId._id) {
        // Fetch inventory for main service
        const mainServiceResponse = await fetch(`http://localhost:5000/api/services/${booking.serviceId._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mainServiceData = await mainServiceResponse.json();
        if (mainServiceData.success) {
          setInventoryLevels(prev => ({
            ...prev,
            [booking.serviceId!._id]: mainServiceData.service.quantity || 0
          }));
        }

        // Fetch inventory for included equipment items
        if (booking.serviceId.includedEquipment && booking.serviceId.includedEquipment.length > 0) {
          for (const equipment of booking.serviceId.includedEquipment) {
            try {
              const equipmentResponse = await fetch(`http://localhost:5000/api/services/${equipment.equipmentId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const equipmentData = await equipmentResponse.json();
              if (equipmentData.success) {
                setInventoryLevels(prev => ({
                  ...prev,
                  [equipment.equipmentId]: equipmentData.service.quantity || 0
                }));
              }
            } catch (equipmentError) {
              console.error('Failed to fetch equipment inventory:', equipmentError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch booking details:', error);
      // Fallback to the list data if fetch fails
      setSelectedBooking(booking);
      setEditFormData({
        quantity: booking.quantity,
        itemQuantities: booking.itemQuantities || {},
      });
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // Filter bookings for the selected date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookingsForDate = bookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDate);
      return bookingDate >= dayStart && bookingDate <= dayEnd;
    });
    setDailyBookings(bookingsForDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const startEditingBooking = () => {
    setIsEditingBooking(true);
    setUpdateMessage('');
    setUpdateMessageType('');
  };

  const cancelEditingBooking = () => {
    setIsEditingBooking(false);
    setUpdateMessage('');
    setUpdateMessageType('');
    if (selectedBooking) {
      setEditFormData({
        quantity: selectedBooking.quantity,
        itemQuantities: selectedBooking.itemQuantities || {},
      });
    }
  };

  const saveBookingChanges = async () => {
    if (!selectedBooking) return;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:5000/api/bookings/${selectedBooking._id}/update-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity: editFormData.quantity,
          itemQuantities: editFormData.itemQuantities,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the booking in the local state
        setBookings(bookings.map(b =>
          b._id === selectedBooking._id
            ? { ...b, quantity: editFormData.quantity, itemQuantities: editFormData.itemQuantities }
            : b
        ));

        // Update selected booking
        setSelectedBooking(prev => prev ? {
          ...prev,
          quantity: editFormData.quantity,
          itemQuantities: editFormData.itemQuantities
        } : null);

        setUpdateMessage('Reservation details updated successfully!');
        setUpdateMessageType('success');
        setIsEditingBooking(false);

        // Clear message after 3 seconds
        setTimeout(() => {
          setUpdateMessage('');
          setUpdateMessageType('');
        }, 3000);
      } else {
        setUpdateMessage(data.message || 'Failed to update booking details');
        setUpdateMessageType('error');
      }
    } catch (error) {
      console.error('Failed to update booking:', error);
      setUpdateMessage('Network error. Please try again.');
      setUpdateMessageType('error');
    }
  };

  const getBookingsForDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return bookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDate);
      return bookingDate >= dayStart && bookingDate <= dayEnd;
    });
  };

  const getRentalPeriod = (booking: Booking) => {
    const startDate = new Date(booking.bookingDate);

    // For equipment rentals, pickup is usually next day
    if (booking.serviceId?.category === 'equipment' ||
        booking.serviceId?.category === 'furniture' ||
        booking.serviceId?.category === 'lighting' ||
        booking.serviceId?.category === 'sound-system' ||
        booking.serviceId?.category === 'tents-canopies' ||
        booking.serviceId?.category === 'linens-tableware' ||
        booking.serviceId?.serviceType === 'equipment' ||
        booking.serviceId?.serviceType === 'supply' ||
        booking.serviceId?.requiresDelivery === true ||
        (booking.serviceId?.includedEquipment && booking.serviceId.includedEquipment.length > 0)) {
      startDate.setDate(startDate.getDate() + 1);
    }

    const endDate = new Date(startDate);
    if (booking.duration && booking.duration > 1) {
      endDate.setDate(endDate.getDate() + booking.duration - 1);
    }

    return { startDate, endDate };
  };

  const isDateInRentalPeriod = (date: Date, booking: Booking) => {
    const { startDate, endDate } = getRentalPeriod(booking);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return checkDate >= startDate && checkDate <= endDate;
  };

  const getEquipmentBookingsForDate = (date: Date) => {
    return bookings.filter(booking => {
      // Only include equipment/supply rentals
      const isEquipment = booking.serviceId?.category === 'equipment' ||
        booking.serviceId?.category === 'furniture' ||
        booking.serviceId?.category === 'lighting' ||
        booking.serviceId?.category === 'sound-system' ||
        booking.serviceId?.category === 'tents-canopies' ||
        booking.serviceId?.category === 'linens-tableware' ||
        booking.serviceId?.serviceType === 'equipment' ||
        booking.serviceId?.serviceType === 'supply' ||
        booking.serviceId?.requiresDelivery === true ||
        (booking.serviceId?.includedEquipment && booking.serviceId.includedEquipment.length > 0);

      if (!isEquipment) return false;

      return isDateInRentalPeriod(date, booking);
    });
  };

  const getDayAvailabilityStatus = (date: Date) => {
    const equipmentBookings = getEquipmentBookingsForDate(date);
    const totalEquipmentBookings = equipmentBookings.length;

    if (totalEquipmentBookings === 0) return 'available';
    if (totalEquipmentBookings >= 3) return 'busy'; // High utilization
    return 'moderate'; // Some utilization
  };

  const checkForOverlappingRentals = (booking: Booking, allBookings: Booking[]) => {
    const { startDate: checkStart, endDate: checkEnd } = getRentalPeriod(booking);
    const overlaps: Booking[] = [];

    for (const otherBooking of allBookings) {
      if (otherBooking._id === booking._id) continue;

      // Only check equipment/supply rentals
      const isEquipment = otherBooking.serviceId?.category === 'equipment' ||
        otherBooking.serviceId?.category === 'furniture' ||
        otherBooking.serviceId?.category === 'lighting' ||
        otherBooking.serviceId?.category === 'sound-system' ||
        otherBooking.serviceId?.category === 'tents-canopies' ||
        otherBooking.serviceId?.category === 'linens-tableware' ||
        otherBooking.serviceId?.serviceType === 'equipment' ||
        otherBooking.serviceId?.serviceType === 'supply' ||
        otherBooking.serviceId?.requiresDelivery === true ||
        (otherBooking.serviceId?.includedEquipment && otherBooking.serviceId.includedEquipment.length > 0);

      if (!isEquipment) continue;

      const { startDate: otherStart, endDate: otherEnd } = getRentalPeriod(otherBooking);

      // Check for overlap
      if (checkStart <= otherEnd && checkEnd >= otherStart) {
        overlaps.push(otherBooking);
      }
    }

    return overlaps;
  };

  const getOverlappingBookingsForDate = (date: Date) => {
    const equipmentBookings = getEquipmentBookingsForDate(date);
    const overlaps: { booking: Booking; conflicts: Booking[] }[] = [];

    for (const booking of equipmentBookings) {
      const conflicts = checkForOverlappingRentals(booking, bookings);
      if (conflicts.length > 0) {
        overlaps.push({ booking, conflicts });
      }
    }

    return overlaps;
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const calendarDays = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      calendarDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return (
      <div className="card p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="btn-secondary px-3 py-1"
            >
              ←
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="btn-secondary px-3 py-1"
            >
              →
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm text-gray-600">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
           {calendarDays.map((date, index) => {
             const isCurrentMonth = date.getMonth() === month;
             const isToday = date.toDateString() === new Date().toDateString();
             const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
             const dayBookings = getBookingsForDate(date);
             const equipmentBookings = getEquipmentBookingsForDate(date);
             const availabilityStatus = getDayAvailabilityStatus(date);
             const overlappingBookings = getOverlappingBookingsForDate(date);
             const hasBookings = dayBookings.length > 0;
             const hasEquipmentBookings = equipmentBookings.length > 0;
             const hasOverlaps = overlappingBookings.length > 0;

             // Determine background color based on availability and overlaps
             let bgColor = '';
             if (isCurrentMonth) {
               if (hasOverlaps) {
                 bgColor = 'bg-red-100 border-red-400 text-red-900'; // Highlight overlaps
               } else if (isSelected) {
                 bgColor = 'bg-indigo-100 border-indigo-300 text-indigo-800';
               } else if (isToday) {
                 bgColor = 'bg-blue-50 border-blue-200 text-blue-800';
               } else {
                 switch (availabilityStatus) {
                   case 'busy':
                     bgColor = 'bg-red-50 border-red-200 text-red-800';
                     break;
                   case 'moderate':
                     bgColor = 'bg-yellow-50 border-yellow-200 text-yellow-800';
                     break;
                   case 'available':
                   default:
                     bgColor = 'bg-white border-gray-200 hover:bg-gray-50';
                     break;
                 }
               }
             } else {
               bgColor = 'bg-gray-50 border-gray-100 text-gray-400';
             }

             return (
               <button
                 key={index}
                 onClick={() => handleDateClick(date)}
                 className={`p-3 text-sm border rounded-lg transition-colors min-h-[100px] ${bgColor}`}
               >
                 <div className="text-right mb-1 font-medium">{date.getDate()}</div>

                 {/* Equipment Rental Indicators */}
                 {hasEquipmentBookings && (
                   <div className="mb-2">
                     <div className="text-xs text-center">
                       {equipmentBookings.map((booking, idx) => {
                         const { startDate, endDate } = getRentalPeriod(booking);
                         const isStart = date.toDateString() === startDate.toDateString();
                         const isEnd = date.toDateString() === endDate.toDateString();
                         const isMiddle = !isStart && !isEnd && isDateInRentalPeriod(date, booking);

                         return (
                           <div
                             key={booking._id}
                             className={`inline-block mx-0.5 px-1 py-0.5 rounded text-xs font-medium ${
                               isStart ? 'bg-green-500 text-white' :
                               isEnd ? 'bg-blue-500 text-white' :
                               'bg-indigo-500 text-white'
                             }`}
                             title={`${booking.serviceId?.name || 'Equipment'} - ${booking.customerId?.name || 'Customer'}`}
                           >
                             {isStart ? '▶' : isEnd ? '◀' : '●'}
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* Regular Bookings Count */}
                 {hasBookings && (
                   <div className="text-xs">
                     <div className="bg-indigo-500 text-white rounded-full px-2 py-1 text-center">
                       {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}
                     </div>
                   </div>
                 )}

                 {/* Overlap Warning */}
                 {hasOverlaps && (
                   <div className="text-xs text-center mt-1">
                     <span className="inline-block px-1 py-0.5 bg-red-500 text-white text-xs rounded font-bold">
                       ⚠️ {overlappingBookings.length} conflict{overlappingBookings.length !== 1 ? 's' : ''}
                     </span>
                   </div>
                 )}

                 {/* Availability Indicator */}
                 {isCurrentMonth && !hasBookings && !hasEquipmentBookings && !hasOverlaps && (
                   <div className="text-xs text-center mt-1">
                     <span className={`inline-block w-2 h-2 rounded-full ${
                       availabilityStatus === 'available' ? 'bg-green-400' :
                       availabilityStatus === 'moderate' ? 'bg-yellow-400' :
                       'bg-red-400'
                     }`}></span>
                   </div>
                 )}
               </button>
             );
           })}
         </div>

        {/* Calendar Legend */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold mb-2">Calendar Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-green-400 rounded-full"></span>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full"></span>
              <span>Moderate Usage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-red-400 rounded-full"></span>
              <span>High Usage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-1 bg-red-500 text-white text-xs rounded font-bold">⚠️</span>
              <span>Conflicts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-1 bg-green-500 text-white text-xs rounded">▶</span>
              <span>Rental Start</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-1 bg-indigo-500 text-white text-xs rounded">●</span>
              <span>Rental Period</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-1 bg-blue-500 text-white text-xs rounded">◀</span>
              <span>Rental End</span>
            </div>
          </div>
        </div>

        {/* Daily Bookings Display */}
         {selectedDate && (
           <div className="mt-6 border-t pt-6">
             <h3 className="text-lg font-semibold mb-4">
               Activity for {selectedDate.toLocaleDateString()}
             </h3>

             {/* Overlap Warnings for this date */}
             {getOverlappingBookingsForDate(selectedDate).length > 0 && (
               <div className="mb-6">
                 <h4 className="font-medium mb-3 text-red-700 flex items-center gap-2">
                   <span>⚠️</span>
                   Scheduling Conflicts Detected
                 </h4>
                 <div className="space-y-3">
                   {getOverlappingBookingsForDate(selectedDate).map(({ booking, conflicts }) => (
                     <div key={booking._id} className="border rounded-lg p-4 bg-red-50 border-red-200">
                       <div className="mb-3">
                         <p className="font-medium text-red-800">
                           {booking.serviceId?.name || 'Equipment'} - {booking.customerId?.name || 'Customer'}
                         </p>
                         <p className="text-sm text-red-600">
                           Conflicts with {conflicts.length} other booking{conflicts.length !== 1 ? 's' : ''}:
                         </p>
                       </div>
                       <div className="space-y-2">
                         {conflicts.map(conflict => (
                           <div key={conflict._id} className="bg-white p-2 rounded border border-red-300">
                             <p className="text-sm">
                               <span className="font-medium">{conflict.serviceId?.name || 'Equipment'}</span> - {conflict.customerId?.name || 'Customer'}
                               <span className="text-gray-500 ml-2">
                                 ({getRentalPeriod(conflict).startDate.toLocaleDateString()} - {getRentalPeriod(conflict).endDate.toLocaleDateString()})
                               </span>
                             </p>
                           </div>
                         ))}
                       </div>
                       <div className="mt-3 text-sm text-red-700">
                         <strong>Action Required:</strong> Review and resolve scheduling conflicts to prevent double-booking.
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {/* Equipment Rentals for this date */}
             {getEquipmentBookingsForDate(selectedDate).length > 0 && (
               <div className="mb-6">
                 <h4 className="font-medium mb-3 text-indigo-700">📦 Equipment Rentals Active</h4>
                 <div className="space-y-2">
                   {getEquipmentBookingsForDate(selectedDate).map(booking => {
                     const { startDate, endDate } = getRentalPeriod(booking);
                     const isStart = selectedDate.toDateString() === startDate.toDateString();
                     const isEnd = selectedDate.toDateString() === endDate.toDateString();
                     const daysRemaining = Math.ceil((endDate.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));

                     return (
                       <div key={booking._id} className="border rounded-lg p-4 bg-indigo-50 border-indigo-200">
                         <div className="grid md:grid-cols-3 gap-4">
                           <div>
                             <span className="text-sm text-gray-600">Equipment:</span>
                             <p className="font-medium">{booking.serviceId?.name || 'Unknown'}</p>
                           </div>
                           <div>
                             <span className="text-sm text-gray-600">Customer:</span>
                             <p className="font-medium">{booking.customerId?.name || 'Unknown'}</p>
                           </div>
                           <div>
                             <span className="text-sm text-gray-600">Rental Period:</span>
                             <p className="font-medium">
                               {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                               {isStart && <span className="text-green-600 font-bold"> (START)</span>}
                               {isEnd && <span className="text-blue-600 font-bold"> (END)</span>}
                             </p>
                           </div>
                           <div>
                             <span className="text-sm text-gray-600">Status:</span>
                             <div className="flex gap-2 mt-1">
                               <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(getDisplayStatus(booking))}`}>
                                 {getDisplayStatus(booking)}
                               </span>
                               {!isEnd && daysRemaining > 0 && (
                                 <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                                   {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                                 </span>
                               )}
                             </div>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             )}

             {/* Regular Bookings for this date */}
             {dailyBookings.length > 0 ? (
               <div>
                 <h4 className="font-medium mb-3 text-gray-700">📅 Regular Bookings</h4>
                 <div className="space-y-3">
                   {dailyBookings.map(booking => (
                     <div key={booking._id} className="border rounded-lg p-4 bg-gray-50">
                       <div className="grid md:grid-cols-4 gap-4">
                         <div>
                           <span className="text-sm text-gray-600">Customer:</span>
                           <p className="font-medium">{booking.customerId?.name || 'Unknown'}</p>
                         </div>
                         <div>
                           <span className="text-sm text-gray-600">Service:</span>
                           <p className="font-medium">{booking.serviceId?.name || 'Unknown'}</p>
                         </div>
                         <div>
                           <span className="text-sm text-gray-600">Time:</span>
                           <p className="font-medium">{new Date(booking.bookingDate).toLocaleTimeString()}</p>
                         </div>
                         <div>
                           <span className="text-sm text-gray-600">Status:</span>
                           <div className="flex gap-2">
                             <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(getDisplayStatus(booking))}`}>
                               {getDisplayStatus(booking)}
                             </span>
                             <span className={`px-2 py-1 rounded text-xs font-medium ${
                               booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                               'bg-yellow-100 text-yellow-800'
                             }`}>
                               {booking.paymentStatus}
                             </span>
                           </div>
                         </div>
                       </div>
                       <div className="mt-3">
                         <div className="text-sm text-gray-600">
                           Quantity: {booking.quantity}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             ) : getEquipmentBookingsForDate(selectedDate).length === 0 ? (
               <p className="text-gray-500 text-center py-8">No activity for this date</p>
             ) : null}
           </div>
         )}
      </div>
    );
  };

  const shouldAutoComplete = (booking: Booking) => {
    try {
      // Only process confirmed rentals (equipment and supplies)
      if (booking.status !== 'confirmed') {
        return false;
      }

      // Check if service is a rental (equipment or supply)
      const service = booking.serviceId;
      if (!service || (service.serviceType !== 'equipment' && service.serviceType !== 'supply')) {
        return false;
      }

      const now = new Date();

      // Check if pick-up time has passed
      if (booking.deliveryStartTime && new Date(booking.deliveryStartTime) < now) {
        return true;
      }

      // Check if booking date + duration has passed (fallback for rentals without delivery time)
      if (booking.bookingDate && booking.duration) {
        const endDate = new Date(booking.bookingDate);
        endDate.setDate(endDate.getDate() + booking.duration);
        if (endDate < now) {
          return true;
        }
      }

      // Check if marked as finished (could be a custom field, for now assume based on notes)
      if (booking.notes && booking.notes.toLowerCase().includes('finished')) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking shouldAutoComplete:', error);
      return false;
    }
  };

  const getDisplayStatus = (booking: Booking) => {
    if (shouldAutoComplete(booking)) {
      return 'completed';
    }
    return booking.status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-gray-900 border-green-300';
      case 'pending':
        return 'bg-yellow-100 text-gray-900 border-yellow-300';
      case 'completed':
        return 'bg-blue-100 text-gray-900 border-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-gray-900 border-red-300';
      default:
        return 'bg-gray-100 text-gray-900 border-gray-300';
    }
  };

  if (loading) return <div>Loading bookings...</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Manage Reservations</h1>
      <p className="text-[var(--muted)] mb-8">View and update reservation status</p>

      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📋 List View
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'calendar'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📅 Calendar View
        </button>
      </div>

      {viewMode === 'list' && (
        <>
          {/* Filters */}
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Filter Reservations</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Status</label>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Payments</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setFilters({ status: '', paymentStatus: '', dateFrom: '', dateTo: '' })}
                className="btn-primary"
              >
                Clear Filters
              </button>
              <span className="text-sm text-[var(--muted)] self-center">
                Showing {filteredBookings.length} of {bookings.length} reservations
              </span>
            </div>
          </div>

          <div className="overflow-x-auto card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-3 text-left text-sm font-semibold">Customer</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Service</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Price</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Payment</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking._id} className="border-b border-[var(--border)]">
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-semibold">{booking.customerId?.name || 'Unknown Customer'}</p>
                        <p className="text-xs text-[var(--muted)]">{booking.customerId?.email || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {booking.isPackageBooking ? (
                        <div>
                          <p className="font-medium">{booking.packageName || 'Package Booking'}</p>
                          <p className="text-xs text-gray-500">📦 Event Package</p>
                        </div>
                      ) : (
                        booking.serviceId?.name || 'Unknown Service'
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">{new Date(booking.bookingDate).toLocaleDateString()}</td>
                    <td className="px-6 py-3 font-semibold">₱{booking.totalPrice}</td>
                    <td className="px-6 py-3">
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status} <span className="text-xs opacity-75">(Auto-managed)</span>
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-3 py-1 rounded text-sm font-semibold border ${
                        booking.paymentStatus === 'paid' ? 'bg-green-100 text-gray-900 border-green-300' :
                        'bg-yellow-100 text-gray-900 border-yellow-300'
                      }`}>
                        {booking.paymentStatus} <span className="text-xs opacity-75">(Auto-managed)</span>
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => viewBooking(booking)}
                        className="text-[var(--primary)] hover:underline text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBookings.length === 0 && bookings.length > 0 && (
            <div className="card p-8 text-center">
              <p className="text-[var(--muted)]">No bookings match the current filters</p>
            </div>
          )}

          {bookings.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-[var(--muted)]">No reservations yet</p>
            </div>
          )}

          {/* Booking Details Modal */}
          {showBookingModal && selectedBooking && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">Reservation Details</h3>
                    <div className="flex gap-2">
                      <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                        📊 Reservation details are automatically managed by the system
                      </div>
                      <button
                        onClick={() => setShowBookingModal(false)}
                        className="text-gray-500 hover:text-gray-700 text-2xl ml-2"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Update Message */}
                  {updateMessage && (
                    <div className={`p-4 rounded-lg mb-6 ${
                      updateMessageType === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {updateMessageType === 'success' ? '✅' : '❌'}
                        </span>
                        <p className="font-medium">{updateMessage}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Booking ID */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-600 mb-1">Reservation ID</h4>
                      <p className="font-mono text-sm">{selectedBooking._id}</p>
                    </div>

                    {/* Customer Information */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="card p-4">
                        <h4 className="font-semibold mb-3">Customer Information</h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-gray-600">Name:</span>
                            <p className="font-medium">{selectedBooking.customerId?.name || 'Unknown Customer'}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Email:</span>
                            <p className="font-medium">{selectedBooking.customerId?.email || 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Service/Package Information */}
                      <div className="card p-4">
                        <h4 className="font-semibold mb-3">
                          {selectedBooking.isPackageBooking ? 'Package Information' : 'Service Information'}
                        </h4>
                        <div className="space-y-2">
                          {selectedBooking.isPackageBooking ? (
                            <>
                              <div>
                                <span className="text-sm text-gray-600">Package:</span>
                                <p className="font-medium">{selectedBooking.packageName || 'Unknown Package'}</p>
                                <p className="text-xs text-blue-600 mt-1">📦 Event Package</p>
                              </div>
                              <div>
                                <span className="text-sm text-gray-600">Package ID:</span>
                                <p className="font-medium font-mono text-sm">{selectedBooking.packageId}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-sm text-gray-600">Service:</span>
                                <p className="font-medium">{selectedBooking.serviceId?.name || 'Unknown Service'}</p>
                                {selectedBooking.serviceId?.includedEquipment && selectedBooking.serviceId.includedEquipment.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Includes: {selectedBooking.serviceId.includedEquipment.map(eq => eq.name).join(', ')}
                                  </p>
                                )}
                              </div>
                              <div>
                                <span className="text-sm text-gray-600">Category:</span>
                                <p className="font-medium capitalize">{selectedBooking.serviceId?.category || 'N/A'}</p>
                              </div>
                            </>
                          )}
                          <div>
                            <span className="text-sm text-gray-600">Unit Price:</span>
                            <p className="font-medium">₱{(() => {
                              // For rentals, show daily rate if available
                              if (selectedBooking.dailyRate && selectedBooking.dailyRate > 0) {
                                return selectedBooking.dailyRate;
                              }
                              // For services with equipment, calculate from total price
                              if (selectedBooking.serviceId?.price && selectedBooking.serviceId.price > 0) {
                                return selectedBooking.serviceId.price;
                              }
                              // Fallback: calculate from total price and quantity
                              if (selectedBooking.totalPrice && selectedBooking.quantity) {
                                return (selectedBooking.totalPrice / selectedBooking.quantity).toFixed(2);
                              }
                              return '0.00';
                            })()}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Quantity:</span>
                            <p className="font-medium">{selectedBooking.quantity}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Booking Details */}
                    <div className="card p-4">
                      <h4 className="font-semibold mb-3">Booking Details</h4>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Reservation Date:</span>
                          <p className="font-medium">{new Date(selectedBooking.bookingDate).toLocaleDateString()}</p>
                          <p className="text-sm text-gray-500">{new Date(selectedBooking.bookingDate).toLocaleTimeString()}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Total Price:</span>
                          <p className="font-medium text-lg">₱{selectedBooking.totalPrice}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Created:</span>
                          <p className="font-medium">{new Date(selectedBooking.createdAt || '').toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Pick-up Date:</span>
                          <p className="font-medium">
                            {selectedBooking.requiresDelivery && selectedBooking.deliveryStartTime
                              ? new Date(selectedBooking.deliveryStartTime).toLocaleDateString()
                              : selectedBooking.serviceId?.category === 'equipment' ||
                                selectedBooking.serviceId?.category === 'furniture' ||
                                selectedBooking.serviceId?.category === 'lighting' ||
                                selectedBooking.serviceId?.category === 'sound-system' ||
                                selectedBooking.serviceId?.category === 'tents-canopies' ||
                                selectedBooking.serviceId?.category === 'linens-tableware' ||
                                selectedBooking.serviceId?.serviceType === 'equipment' ||
                                selectedBooking.serviceId?.serviceType === 'supply' ||
                                selectedBooking.serviceId?.requiresDelivery === true ||
                                (selectedBooking.serviceId?.includedEquipment && selectedBooking.serviceId.includedEquipment.length > 0)
                              ? (() => {
                                  const pickupDate = new Date(selectedBooking.bookingDate);
                                  pickupDate.setDate(pickupDate.getDate() + 1);
                                  return pickupDate.toLocaleDateString();
                                })()
                              : 'N/A'
                            }
                          </p>
                          {(selectedBooking.requiresDelivery && selectedBooking.deliveryStartTime) ||
                           (selectedBooking.serviceId?.category === 'equipment' ||
                            selectedBooking.serviceId?.category === 'furniture' ||
                            selectedBooking.serviceId?.category === 'lighting' ||
                            selectedBooking.serviceId?.category === 'sound-system' ||
                            selectedBooking.serviceId?.category === 'tents-canopies' ||
                            selectedBooking.serviceId?.category === 'linens-tableware' ||
                            selectedBooking.serviceId?.serviceType === 'equipment' ||
                            selectedBooking.serviceId?.serviceType === 'supply' ||
                            selectedBooking.serviceId?.requiresDelivery === true ||
                            (selectedBooking.serviceId?.includedEquipment && selectedBooking.serviceId.includedEquipment.length > 0)) && (
                            <p className="text-sm text-gray-500">
                              {selectedBooking.deliveryStartTime
                                ? new Date(selectedBooking.deliveryStartTime).toLocaleTimeString()
                                : new Date(selectedBooking.bookingDate).toLocaleTimeString()
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Additional Booking Details */}
                      <div className="grid md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                        {selectedBooking.duration && selectedBooking.duration > 1 && (
                          <div>
                            <span className="text-sm text-gray-600">Duration:</span>
                            <p className="font-medium">{selectedBooking.duration} days</p>
                          </div>
                        )}
                        {selectedBooking.dailyRate && selectedBooking.dailyRate > 0 && (
                          <div>
                            <span className="text-sm text-gray-600">Daily Rate:</span>
                            <p className="font-medium">₱{selectedBooking.dailyRate}</p>
                          </div>
                        )}
                        {selectedBooking.appliedMultiplier && selectedBooking.appliedMultiplier !== 1.0 && (
                          <div>
                            <span className="text-sm text-gray-600">Applied Multiplier:</span>
                            <p className="font-medium">{selectedBooking.appliedMultiplier}x</p>
                          </div>
                        )}
                        {selectedBooking.daysBeforeCheckout && selectedBooking.daysBeforeCheckout > 0 && (
                          <div>
                            <span className="text-sm text-gray-600">Days Before Event:</span>
                            <p className="font-medium">{selectedBooking.daysBeforeCheckout} days</p>
                          </div>
                        )}
                        {selectedBooking.deliveryDuration && selectedBooking.requiresDelivery && (
                          <div>
                            <span className="text-sm text-gray-600">Delivery Duration:</span>
                            <p className="font-medium">{selectedBooking.deliveryDuration} minutes</p>
                          </div>
                        )}
                        {selectedBooking.downPaymentPercentage && selectedBooking.downPaymentPercentage !== 30 && (
                          <div>
                            <span className="text-sm text-gray-600">Down Payment %:</span>
                            <p className="font-medium">{selectedBooking.downPaymentPercentage}%</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Package Included Bookings */}
                    {selectedBooking.isPackageBooking && selectedBooking.includedBookings && selectedBooking.includedBookings.length > 0 && (
                      <div className="card p-4">
                        <h4 className="font-semibold mb-3">📦 Package Contents</h4>
                        <p className="text-sm text-gray-600 mb-4">This package includes the following services:</p>
                        <div className="space-y-3">
                          {selectedBooking.includedBookings.map((bookingId, index) => (
                            <div key={bookingId} className="border rounded-lg p-3 bg-gray-50">
                              <p className="text-sm font-medium">Service #{index + 1}</p>
                              <p className="text-xs text-gray-500">Booking ID: {bookingId}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-3">
                          💡 Individual service bookings are grouped under this package for simplified management
                        </p>
                      </div>
                    )}

                    {/* Status Information */}
                    <div className="card p-4">
                      <h4 className="font-semibold mb-3">Status Information</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Reservation Status:</span>
                          <div className="mt-1">
                            <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(selectedBooking.status)}`}>
                              {selectedBooking.status} <span className="text-xs opacity-75">(Auto-managed)</span>
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Payment Status:</span>
                          <div className="mt-1">
                            <span className={`px-3 py-1 rounded text-sm font-semibold border ${
                              selectedBooking.paymentStatus === 'paid' ? 'bg-green-100 text-gray-900 border-green-300' :
                              selectedBooking.paymentStatus === 'processing' ? 'bg-blue-100 text-gray-900 border-blue-300' :
                              selectedBooking.paymentStatus === 'failed' ? 'bg-red-100 text-gray-900 border-red-300' :
                              selectedBooking.paymentStatus === 'unpaid' ? 'bg-yellow-100 text-gray-900 border-yellow-300' :
                              'bg-gray-100 text-gray-900 border-gray-300'
                            }`}>
                              {selectedBooking.paymentStatus} <span className="text-xs opacity-75">(Auto-managed)</span>
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Payment Type:</span>
                          <div className="mt-1">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
                              {selectedBooking.paymentType === 'full' ? 'Full Payment' :
                               selectedBooking.paymentType === 'test_payment' ? 'Test Payment' :
                               selectedBooking.paymentType === 'partial' ? 'Partial Payment' :
                               'Full Payment'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Editable Booking Details */}
                    <div className="card p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <span>👥</span>
                        Guest & Item Details
                        {isEditingBooking && (
                          <span className="text-sm text-blue-600 font-normal">(Editable)</span>
                        )}
                      </h4>

                      <div className="space-y-4">
                        {/* Guest Quantity */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👥</span>
                              <span className="text-sm font-medium text-blue-800">Number of Guests</span>
                            </div>
                            <span className="text-lg font-bold text-blue-600">{selectedBooking.serviceId?.maxOrder || 1}</span>
                          </div>
                        </div>

                        {/* Item Quantities Breakdown */}
                        {selectedBooking.itemQuantities && Object.keys(selectedBooking.itemQuantities).length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              <span>📦</span>
                              Item Quantities
                              <span className="text-xs text-blue-600">(Auto-managed)</span>
                            </h5>

                            {Object.entries(selectedBooking.itemQuantities).map(([itemName, quantity]) => (
                              <div key={itemName} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{itemName}</p>
                                  <span className="text-xs text-gray-500">Booked quantity</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-lg font-semibold text-[var(--primary)]">
                                    {quantity}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Included Equipment */}
                        {selectedBooking.serviceId && selectedBooking.serviceId.includedEquipment && selectedBooking.serviceId.includedEquipment.length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              <span>🔧</span>
                              Included Equipment
                              <span className="text-xs text-blue-600">(Auto-managed)</span>
                            </h5>

                            {selectedBooking.serviceId.includedEquipment.map((equipment, index) => {
                              const currentQuantity = selectedBooking.itemQuantities?.[equipment.name] || equipment.quantity;
                              const inventoryLevel = inventoryLevels[equipment.equipmentId] || 0;
                              const isLowStock = inventoryLevel <= 5 && inventoryLevel > 0;
                              const isOutOfStock = inventoryLevel <= 0;

                              return (
                                <div key={index} className={`flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200 ${isOutOfStock ? 'border-red-300 bg-red-50' : ''} ${isLowStock ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{equipment.name}</p>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className="text-xs text-gray-500">
                                        Required: {currentQuantity} item{currentQuantity !== 1 ? 's' : ''}
                                      </span>
                                      {inventoryLevel > 0 && (
                                        <span className={`text-xs flex items-center gap-1 ${
                                          isLowStock ? 'text-yellow-600' : 'text-green-600'
                                        }`}>
                                          <span>📊</span>
                                          {inventoryLevel} available
                                        </span>
                                      )}
                                      {isOutOfStock && (
                                        <span className="text-xs text-red-600 flex items-center gap-1">
                                          <span>⚠️</span>
                                          Out of stock
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-lg font-semibold text-[var(--primary)]">
                                      {currentQuantity}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* No additional details */}
                        {(!selectedBooking.itemQuantities || Object.keys(selectedBooking.itemQuantities).length === 0) &&
                         (!selectedBooking.serviceId || !selectedBooking.serviceId.includedEquipment || selectedBooking.serviceId.includedEquipment.length === 0) && (
                          <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">
                            No additional guest or item details for this booking
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="card p-4">
                    <h4 className="font-semibold mb-3">Additional Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Last Updated:</span>
                        <span className="text-sm text-gray-700">
                          {selectedBooking.updatedAt ? new Date(selectedBooking.updatedAt).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">Amount Paid:</span>
                        <span className="text-sm text-gray-700">
                          ₱{selectedBooking.amountPaid || 0}
                        </span>
                      </div>
                      {selectedBooking.remainingBalance && selectedBooking.remainingBalance > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-600">Remaining Balance:</span>
                          <span className="text-sm text-red-600 font-medium">
                            ₱{selectedBooking.remainingBalance}
                          </span>
                        </div>
                      )}
                      {selectedBooking.notes && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Notes:</span>
                          <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">{selectedBooking.notes}</p>
                        </div>
                      )}
                      {selectedBooking.itemQuantities && Object.keys(selectedBooking.itemQuantities).length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Item Breakdown:</span>
                          <div className="mt-2 space-y-1">
                            {Object.entries(selectedBooking.itemQuantities).map(([item, qty]) => (
                              <div key={item} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                <span>{item}:</span>
                                <span>{qty} item{qty !== 1 ? 's' : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        Need help managing this reservation? Contact the customer support team for assistance.
                      </div>
                      <div className="text-sm text-[var(--primary)] font-medium">
                        📞 Support: (+63) 912-760-7860| ✉️ trixtech011@gmail.com
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowBookingModal(false)}
                      className="btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === 'calendar' && renderCalendar()}
    </div>
  );
}

