'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  serviceType: string;
  basePrice: number;
  price: number;
  image?: string;
  eventTypes: string[];
  isAvailable: boolean;
  quantity?: number;
  minOrder?: number;
  leadTime?: number;
  deliveryRequired?: boolean;
  deliveryFee?: number;
  features?: string[];
  tags?: string[];
}

interface Recommendation {
  service: Service;
  reason: string;
  score: number;
  isAvailable: boolean;
  availableQuantity?: number;
}

interface PredictiveSuggestion {
  service: Service;
  confidence: number;
  frequency: number;
  averageQuantity: number;
  reasons: string[];
}

export default function SuggestionsPage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [predictiveSuggestions, setPredictiveSuggestions] = useState<PredictiveSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPredictive, setLoadingPredictive] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    priceRange: '',
  });
  const [userPreferences, setUserPreferences] = useState({
    eventType: '',
    budget: '',
    guestCount: '',
  });

  useEffect(() => {
    fetchRecommendations();
    fetchPredictiveSuggestions();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // First get all services
      const servicesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!servicesResponse.ok) {
        throw new Error('Failed to fetch services');
      }

      const servicesData = await servicesResponse.json();
      const services = servicesData.services || [];

      // Generate recommendations based on various factors
      const recommendations = generateRecommendations(services);
      setRecommendations(recommendations);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictiveSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/bookings/suggestions/predictive`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPredictiveSuggestions(data.suggestions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching predictive suggestions:', error);
    } finally {
      setLoadingPredictive(false);
    }
  };

  const generateRecommendations = (services: Service[]): Recommendation[] => {
    const recommendations: Recommendation[] = [];

    services.forEach(service => {
      let score = 0;
      let reasons: string[] = [];

      // Base scoring
      if (service.isAvailable) {
        score += 20;
        reasons.push('Available for booking');
      }

      // Category preferences
      if (service.category === 'party' || service.category === 'wedding') {
        score += 15;
        reasons.push('Popular for events');
      }

      // Price scoring
      if (service.basePrice <= 1000) {
        score += 10;
        reasons.push('Budget-friendly option');
      } else if (service.basePrice <= 5000) {
        score += 15;
        reasons.push('Good value for money');
      }

      // Quantity availability
      if (service.quantity && service.quantity > 10) {
        score += 10;
        reasons.push('High stock availability');
      }

      // Features scoring
      if (service.features && service.features.length > 0) {
        score += 5;
        reasons.push('Includes additional features');
      }

      // Delivery scoring
      if (!service.deliveryRequired) {
        score += 8;
        reasons.push('No delivery required');
      }

      // Lead time scoring
      if (!service.leadTime || service.leadTime <= 24) {
        score += 10;
        reasons.push('Quick setup available');
      }

      if (score > 30) { // Only include services with decent scores
        recommendations.push({
          service,
          reason: reasons.join(', '),
          score,
          isAvailable: service.isAvailable,
          availableQuantity: service.quantity,
        });
      }
    });

    // Sort by score (highest first)
    return recommendations.sort((a, b) => b.score - a.score);
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (filters.category && rec.service.category !== filters.category) return false;
    if (filters.priceRange) {
      const price = rec.service.basePrice;
      if (filters.priceRange === 'low' && price > 1000) return false;
      if (filters.priceRange === 'medium' && (price <= 1000 || price > 5000)) return false;
      if (filters.priceRange === 'high' && price <= 5000) return false;
    }
    return true;
  });

  const getPriceRangeLabel = (price: number) => {
    if (price <= 1000) return '₱0 – ₱1,000';
    if (price <= 5000) return '₱1,001 – ₱5,000';
    return '₱5,001+';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'party': return '🎉';
      case 'wedding': return '💒';
      case 'corporate': return '🏢';
      case 'equipment': return '🎪';
      case 'birthday': return '🎂';
      case 'funeral': return '⚰️';
      default: return '⚙️';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding perfect recommendations for you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🎯 Suggestions</h1>
        <p className="text-gray-600 text-lg">Discover services perfectly matched to your needs</p>
      </div>

      {/* Filters */}
      <div className="card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Preferences</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Event Type</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field"
            >
              <option value="">All Categories</option>
              <option value="party">Party</option>
              <option value="wedding">Wedding</option>
              <option value="corporate">Corporate</option>
              <option value="equipment">Equipment</option>
              <option value="birthday">Birthday</option>
              <option value="funeral">Funeral</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Price Range</label>
            <select
              value={filters.priceRange}
              onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
              className="input-field"
            >
              <option value="">All Prices</option>
              <option value="low">₱0 – ₱1,000</option>
              <option value="medium">₱1,001 – ₱5,000</option>
              <option value="high">₱5,001+</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setFilters({ category: '', priceRange: '' })}
            className="btn-secondary"
          >
            Clear Filters
          </button>
          <span className="text-sm text-gray-600 self-center">
            Showing {filteredRecommendations.length} of {recommendations.length} recommendations
          </span>
        </div>
      </div>

      {/* Recommendations Grid */}
      {filteredRecommendations.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No recommendations found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your filters to see more options.</p>
          <button
            onClick={() => setFilters({ category: '', priceRange: '' })}
            className="btn-primary"
          >
            Show All Recommendations
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecommendations.map((rec, index) => (
            <div key={rec.service._id} className="card p-6 hover:shadow-lg transition-shadow">
              {/* Recommendation Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(rec.service.category)}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    rec.score >= 70 ? 'bg-green-100 text-green-800' :
                    rec.score >= 50 ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {rec.score >= 70 ? 'Highly Recommended' :
                     rec.score >= 50 ? 'Recommended' : 'Good Match'}
                  </span>
                </div>
                <span className="text-sm text-gray-500">#{index + 1}</span>
              </div>

              {/* Service Image */}
              <div className="w-full h-48 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg mb-4 flex items-center justify-center text-4xl">
                {rec.service.image ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${rec.service.image}`}
                    alt={rec.service.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = getCategoryIcon(rec.service.category);
                    }}
                  />
                ) : (
                  getCategoryIcon(rec.service.category)
                )}
              </div>

              {/* Service Details */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{rec.service.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{rec.service.category.replace('-', ' ')}</p>
                </div>

                <p className="text-sm text-gray-700 line-clamp-2">{rec.service.description}</p>

                {/* Price and Availability */}
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-indigo-600">₱{rec.service.basePrice.toFixed(2)}</div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    rec.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {rec.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                {/* Recommendation Reason */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">💡</span>
                    <div>
                      <p className="text-sm font-medium text-blue-800 mb-1">Why we recommend this:</p>
                      <p className="text-xs text-blue-700">{rec.reason}</p>
                    </div>
                  </div>
                </div>

                {/* Service Features */}
                {rec.service.features && rec.service.features.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {rec.service.features.slice(0, 3).map((feature, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/customer/services/${rec.service._id}`}
                    className="flex-1 btn-secondary text-center"
                  >
                    View Details
                  </Link>
                  {rec.isAvailable && (
                    <button
                      onClick={() => {
                        // Add to cart logic would go here
                        alert(`Added ${rec.service.name} to cart!`);
                      }}
                      className="flex-1 btn-primary"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Predictive Analytics Suggestions */}
      {predictiveSuggestions.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 text-purple-800 mb-6">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold">🎯 Smart Suggestions</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Based on what other customers frequently add to their bookings
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictiveSuggestions.map((suggestion, index) => (
              <div key={suggestion.service._id} className="border border-purple-200 rounded-lg p-4 bg-purple-50 hover:bg-purple-100 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(suggestion.service.category)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      suggestion.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                      suggestion.confidence >= 0.6 ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {suggestion.confidence >= 0.8 ? 'Highly Recommended' :
                       suggestion.confidence >= 0.6 ? 'Recommended' : 'Suggested'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">#{index + 1}</span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-800 text-sm">{suggestion.service.name}</h4>
                  <p className="text-xs text-gray-600 capitalize">{suggestion.service.category.replace('-', ' ')}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-purple-600">₱{suggestion.service.basePrice.toFixed(2)}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      suggestion.service.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {suggestion.service.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>

                  <div className="bg-white border border-purple-200 rounded p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">📊</span>
                      <div>
                        <p className="text-xs font-medium text-purple-800">Why suggested:</p>
                        <p className="text-xs text-purple-700">
                          Added by {suggestion.frequency} customer{suggestion.frequency > 1 ? 's' : ''} to similar bookings
                        </p>
                        {suggestion.reasons && suggestion.reasons.length > 0 && (
                          <p className="text-xs text-purple-600 mt-1">
                            {suggestion.reasons[0]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/customer/services/${suggestion.service._id}`}
                      className="flex-1 btn-secondary text-xs py-1.5 text-center"
                    >
                      View Details
                    </Link>
                    {suggestion.service.isAvailable && (
                      <button
                        onClick={() => {
                          // Add to cart logic
                          alert(`Added ${suggestion.service.name} to cart!`);
                        }}
                        className="flex-1 btn-primary text-xs py-1.5"
                      >
                        Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Preferences Section */}
      <div className="card p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">🎛️ Customize Your Recommendations</h2>
        <p className="text-gray-600 mb-4">
          Help us provide better recommendations by sharing your preferences.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Event Type</label>
            <select
              value={userPreferences.eventType}
              onChange={(e) => setUserPreferences({ ...userPreferences, eventType: e.target.value })}
              className="input-field"
            >
              <option value="">Any Event</option>
              <option value="birthday">Birthday Party</option>
              <option value="wedding">Wedding</option>
              <option value="corporate">Corporate Event</option>
              <option value="graduation">Graduation</option>
              <option value="anniversary">Anniversary</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Budget Range</label>
            <select
              value={userPreferences.budget}
              onChange={(e) => setUserPreferences({ ...userPreferences, budget: e.target.value })}
              className="input-field"
            >
              <option value="">Any Budget</option>
              <option value="low">₱0-500</option>
              <option value="medium">₱501-2000</option>
              <option value="high">₱2001+</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Guest Count</label>
            <select
              value={userPreferences.guestCount}
              onChange={(e) => setUserPreferences({ ...userPreferences, guestCount: e.target.value })}
              className="input-field"
            >
              <option value="">Any Size</option>
              <option value="small">1-50 guests</option>
              <option value="medium">51-200 guests</option>
              <option value="large">201+ guests</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={() => {
              // In a real implementation, this would update user preferences
              alert('Preferences saved! Recommendations will be updated.');
            }}
            className="btn-primary"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
