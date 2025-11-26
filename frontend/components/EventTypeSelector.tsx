'use client';

import { useState, useEffect } from 'react';

interface EventType {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: string;
  icon: string;
  typicalGuestCount: {
    min: number;
    max: number;
    suggested: number;
  };
  typicalDuration: number;
  recommendedCategories: string[];
  tags: string[];
  seasonalNotes?: string;
}

interface EventTypeSelectorProps {
  selectedEventType?: string;
  onEventTypeSelect: (eventType: EventType | null) => void;
  guestCount?: number;
  className?: string;
}

export default function EventTypeSelector({
  selectedEventType,
  onEventTypeSelect,
  guestCount,
  className = ''
}: EventTypeSelectorProps) {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch event types
  const fetchEventTypes = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/event-types`);

      if (response.ok) {
        const data = await response.json();
        setEventTypes(data.eventTypes || []);
      } else {
        setError('Failed to load event types');
      }
    } catch (err) {
      setError('Network error while loading event types');
      console.error('Error fetching event types:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEventTypes();
  }, []);

  const handleEventTypeSelect = (eventType: EventType) => {
    if (selectedEventType === eventType.id) {
      // Deselect if already selected
      onEventTypeSelect(null);
    } else {
      onEventTypeSelect(eventType);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Loading event types...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchEventTypes}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">What type of event are you planning?</h3>
        <p className="text-sm text-gray-600 mt-1">
          Select an event type to get personalized recommendations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {eventTypes.map((eventType) => (
          <div
            key={eventType.id}
            onClick={() => handleEventTypeSelect(eventType)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedEventType === eventType.id
                ? 'border-[var(--primary)] bg-[var(--primary)] bg-opacity-5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl flex-shrink-0">{eventType.icon}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-medium text-gray-900 truncate">
                  {eventType.name}
                </h4>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {eventType.shortDescription || eventType.description}
                </p>

                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                    👥 {eventType.typicalGuestCount.suggested} guests
                  </span>
                  <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                    ⏱️ {eventType.typicalDuration} hours
                  </span>
                </div>

                {guestCount && (
                  <div className="mt-2">
                    {guestCount < eventType.typicalGuestCount.min && (
                      <p className="text-xs text-orange-600">
                        ⚠️ Minimum {eventType.typicalGuestCount.min} guests recommended
                      </p>
                    )}
                    {guestCount > eventType.typicalGuestCount.max && (
                      <p className="text-xs text-orange-600">
                        ⚠️ Maximum {eventType.typicalGuestCount.max} guests supported
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Recommended: {eventType.recommendedCategories.slice(0, 3).join(', ')}
                    {eventType.recommendedCategories.length > 3 && '...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedEventType && (
        <div className="text-center">
          <button
            onClick={() => onEventTypeSelect(null)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
