'use client';

import { useState } from 'react';

interface CalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
}

export default function Calendar({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
  disabledDates = [],
  className = ''
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
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

  const isDateDisabled = (date: Date) => {
    // Check min date
    if (minDate && date < minDate) return true;

    // Check max date
    if (maxDate && date > maxDate) return true;

    // Check disabled dates
    return disabledDates.some(disabledDate =>
      date.toDateString() === disabledDate.toDateString()
    );
  };

  const isDateSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const selectedDateTime = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (!isDateDisabled(selectedDateTime)) {
      onDateSelect(selectedDateTime);
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

  return (
    <div className={`card p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-[var(--primary)]/10 text-[var(--foreground)] hover:text-[var(--primary)] rounded-xl transition-all duration-300 interactive-scale focus-ring"
          type="button"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-xl font-bold text-[var(--foreground)] text-gradient-primary">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-[var(--primary)]/10 text-[var(--foreground)] hover:text-[var(--primary)] rounded-xl transition-all duration-300 interactive-scale focus-ring"
          type="button"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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
          const disabled = isDateDisabled(date);
          const selected = isDateSelected(date);
          const isTodayDate = isToday(date);

          return (
            <button
              key={index}
              onClick={() => handleDateClick(day)}
              disabled={disabled}
              className={`
                h-12 w-12 text-sm font-semibold rounded-xl transition-all duration-300 relative group focus-ring
                ${disabled
                  ? 'text-[var(--muted)] cursor-not-allowed bg-transparent'
                  : selected
                    ? 'bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white shadow-lg shadow-[var(--primary)]/30 hover:shadow-xl hover:shadow-[var(--primary)]/40 hover:-translate-y-0.5'
                    : isTodayDate
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-2 border-[var(--primary)]/30 hover:bg-[var(--primary)]/20 hover:border-[var(--primary)]/50'
                      : 'text-[var(--foreground)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] hover:shadow-md'
                }
              `}
              type="button"
              aria-label={`Select ${date.toLocaleDateString()}`}
            >
              <span className="relative z-10">{day}</span>
              {isTodayDate && !selected && (
                <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-[var(--primary)] rounded-full animate-pulse"></div>
              )}
              {selected && (
                <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Enhanced Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)]/10 rounded-lg">
          <div className="w-3 h-3 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] rounded-md"></div>
          <span className="text-[var(--foreground)] font-medium">Selected</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)]/5 rounded-lg">
          <div className="w-3 h-3 bg-[var(--primary)]/20 border border-[var(--primary)]/40 rounded-md"></div>
          <span className="text-[var(--foreground)] font-medium">Today</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-hover)] rounded-lg">
          <div className="w-3 h-3 bg-transparent border border-[var(--border)] rounded-md"></div>
          <span className="text-[var(--muted)] font-medium">Available</span>
        </div>
      </div>
    </div>
  );
}