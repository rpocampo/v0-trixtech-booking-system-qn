'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PackageSuggestion {
  _id: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  basePrice: number;
  totalPrice: number;
  inclusions: Array<{
    name: string;
    quantity: number;
    category: string;
    description?: string;
    price: number;
  }>;
  addOns?: Array<{
    name: string;
    quantity: number;
    category: string;
    description?: string;
    price: number;
    isPopular?: boolean;
  }>;
  deliveryIncluded: boolean;
  deliveryFee?: number;
  minGuests?: number;
  maxGuests?: number;
  duration?: number;
  isPopular?: boolean;
  relevanceScore?: number;
  availability?: {
    available: boolean;
    reason?: string;
  };
}

interface EventType {
  id: string;
  name: string;
  slug: string;
  recommendedCategories: string[];
}

interface PackageSuggestionsProps {
  eventType?: EventType;
  guestCount?: number;
  selectedServices?: Array<{ id: string; name: string; category: string }>;
  budget?: number;
  deliveryNeeded?: boolean;
  maxSuggestions?: number;
  onPackageSelect?: (packageId: string) => void;
  className?: string;
}

export default function PackageSuggestions({
  eventType,
  guestCount,
  selectedServices = [],
  budget,
  deliveryNeeded = false,
  maxSuggestions = 3,
  onPackageSelect,
  className = ''
}: PackageSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch package suggestions
  const fetchSuggestions = async () => {
    if (!eventType && selectedServices.length === 0) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        eventType: eventType?.slug || '',
        guestCount: guestCount?.toString() || '',
        selectedServices: JSON.stringify(selectedServices.map(s => ({ id: s.id }))),
        budget: budget?.toString() || '',
        deliveryNeeded: deliveryNeeded.toString(),
        maxSuggestions: maxSuggestions.toString()
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/packages/suggest?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch package suggestions');
      }
    } catch (err) {
      setError('Network error while fetching suggestions');
      console.error('Error fetching package suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch suggestions when criteria change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchSuggestions();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(debounceTimer);
  }, [eventType?.slug, guestCount, selectedServices.length, budget, deliveryNeeded, maxSuggestions]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Finding perfect packages for you...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    if (eventType || selectedServices.length > 0) {
      return (
        <div className={`text-center py-8 ${className}`}>
          <p className="text-gray-600">No packages found matching your criteria.</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your event type or guest count.</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">Recommended Packages</h3>
        <p className="text-sm text-gray-600 mt-1">
          Based on your selections, here are our best package recommendations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((pkg) => (
          <div
            key={pkg._id}
            className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white"
          >
            {/* Package Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{pkg.name}</h4>
                {pkg.isPopular && (
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full mt-1">
                    Popular
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--primary)]">
                  ₱{pkg.totalPrice.toLocaleString()}
                </div>
                {pkg.basePrice !== pkg.totalPrice && (
                  <div className="text-sm text-gray-500 line-through">
                    ₱{pkg.basePrice.toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Package Description */}
            <p className="text-sm text-gray-600 mb-4">{pkg.shortDescription || pkg.description}</p>

            {/* Guest Count & Duration */}
            {(pkg.minGuests || pkg.maxGuests || pkg.duration) && (
              <div className="flex flex-wrap gap-2 mb-4 text-xs text-gray-500">
                {pkg.minGuests && pkg.maxGuests && (
                  <span>👥 {pkg.minGuests}-{pkg.maxGuests} guests</span>
                )}
                {pkg.duration && (
                  <span>⏱️ {pkg.duration} hours</span>
                )}
                {pkg.deliveryIncluded && (
                  <span>🚚 Delivery included</span>
                )}
              </div>
            )}

            {/* Inclusions */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-900 mb-2">What's Included:</h5>
              <ul className="space-y-1">
                {pkg.inclusions.slice(0, 4).map((item, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 flex-shrink-0"></span>
                    {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                  </li>
                ))}
                {pkg.inclusions.length > 4 && (
                  <li className="text-sm text-gray-500">
                    +{pkg.inclusions.length - 4} more items
                  </li>
                )}
              </ul>
            </div>

            {/* Add-ons Preview */}
            {pkg.addOns && pkg.addOns.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Popular Add-ons:</h5>
                <div className="space-y-1">
                  {pkg.addOns.filter(addon => addon.isPopular).slice(0, 2).map((addon, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center justify-between">
                      <span>{addon.name}</span>
                      <span className="text-[var(--primary)] font-medium">+₱{addon.price.toLocaleString()}</span>
                    </li>
                  ))}
                </div>
              </div>
            )}

            {/* Availability Warning */}
            {pkg.availability && !pkg.availability.available && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ {pkg.availability.reason}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onPackageSelect?.(pkg._id)}
                className="flex-1 bg-[var(--primary)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors"
              >
                Select Package
              </button>
              <Link
                href={`/customer/services?package=${pkg._id}`}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Show More Link */}
      {suggestions.length >= maxSuggestions && (
        <div className="text-center">
          <Link
            href="/customer/packages"
            className="text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium"
          >
            View all packages →
          </Link>
        </div>
      )}
    </div>
  );
}
