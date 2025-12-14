'use client';

import { useState, useEffect } from 'react';

interface AvailabilityData {
  date: string;
  status: 'available' | 'partially-booked' | 'fully-booked';
  availableCount: number;
  totalCount: number;
}

interface AvailabilityCalendarProps {
  className?: string;
}

export default function AvailabilityCalendar({ className = '' }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilityData, setAvailabilityData] = useState<Map<string, AvailabilityData>>(new Map());
  const [loading, setLoading] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const fetchAvailabilityForMonth = async (date: Date) => {
    setLoading(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth();

      // Get all dates in the month
      const dates = [];
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dates.push(dateStr);
      }

      // Fetch availability for each date
      const availabilityMap = new Map<string, AvailabilityData>();

      for (const dateStr of dates) {
        try {
          const response = await fetch(`http://localhost:5000/api/services?date=${dateStr}&serviceType=equipment&serviceType=supply`);
          const data = await response.json();

          if (data.success && data.services) {
            const totalEquipment = data.services.filter((s: any) =>
              s.serviceType === 'equipment' || s.serviceType === 'supply'
            );

            const availableEquipment = totalEquipment.filter((s: any) =>
              s.availableQuantity > 0 || (s.quantity === undefined && s.isAvailable)
            );

            let status: 'available' | 'partially-booked' | 'fully-booked';
            if (availableEquipment.length === 0) {
              status = 'fully-booked';
            } else if (availableEquipment.length < totalEquipment.length) {
              status = 'partially-booked';
            } else {
              status = 'available';
            }

            availabilityMap.set(dateStr, {
              date: dateStr,
              status,
              availableCount: availableEquipment.length,
              totalCount: totalEquipment.length
            });
          }
        } catch (error) {
          console.error(`Error fetching availability for ${dateStr}:`, error);
        }
      }

      setAvailabilityData(availabilityMap);
    } catch (error) {
      console.error('Error fetching availability data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailabilityForMonth(currentMonth);
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getAvailabilityForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availabilityData.get(dateStr);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'partially-booked':
        return 'bg-yellow-500';
      case 'fully-booked':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'partially-booked':
        return 'Limited';
      case 'fully-booked':
        return 'Booked';
      default:
        return 'Unknown';
    }
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  // Create calendar grid
  const calendarDays = [];
  const totalCells = 42; // 6 weeks * 7 days

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Fill remaining cells
  while (calendarDays.length < totalCells) {
    calendarDays.push(null);
  }

  const today = new Date();
  const isToday = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === today.toDateString();
  };

  const isPastDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < todayStart;
  };

  return (
    <div className={`card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          disabled={loading}
          className="p-2 hover:bg-[var(--primary)]/10 text-[var(--foreground)] hover:text-[var(--primary)] rounded-xl transition-all duration-300 interactive-scale focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="text-xl font-bold text-[var(--foreground)] text-gradient-primary">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <p className="text-sm text-[var(--muted)] mt-1">Equipment Availability</p>
        </div>

        <button
          onClick={handleNextMonth}
          disabled={loading}
          className="p-2 hover:bg-[var(--primary)]/10 text-[var(--foreground)] hover:text-[var(--primary)] rounded-xl transition-all duration-300 interactive-scale focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <span className="ml-3 text-[var(--muted)]">Loading availability...</span>
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-semibold text-[var(--muted)] py-3 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={index} className="h-12"></div>;
          }

          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const availability = getAvailabilityForDate(date);
          const pastDate = isPastDate(day);
          const todayDate = isToday(day);

          return (
            <div
              key={index}
              className={`
                h-12 w-12 text-sm font-semibold rounded-xl transition-all duration-300 relative group flex flex-col items-center justify-center
                ${pastDate
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-200 hover:shadow-md'
                }
              `}
              title={availability ? `${getStatusText(availability.status)} (${availability.availableCount}/${availability.totalCount})` : 'No data'}
            >
              <span className={`relative z-10 ${todayDate ? 'font-bold text-[var(--primary)]' : ''}`}>
                {day}
              </span>
              {!pastDate && availability && (
                <div className={`w-2 h-2 rounded-full mt-1 ${getStatusColor(availability.status)}`}></div>
              )}
              {todayDate && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-green-700 font-medium">Available</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span className="text-yellow-700 font-medium">Limited</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-red-700 font-medium">Booked</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <span className="text-gray-600 font-medium">No Data</span>
        </div>
      </div>

      {/* Info text */}
      <div className="mt-4 text-center">
        <p className="text-xs text-[var(--muted)]">
          Hover over dates to see detailed availability information
        </p>
      </div>
    </div>
  );
}