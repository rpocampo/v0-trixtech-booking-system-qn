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

interface PredictiveSuggestion {
  service: Service;
  confidence: number;
  frequency: number;
  averageQuantity: number;
  reasons: string[];
}

export default function SuggestionsPage() {
  const router = useRouter();
  const [predictiveSuggestions, setPredictiveSuggestions] = useState<PredictiveSuggestion[]>([]);
  const [loadingPredictive, setLoadingPredictive] = useState(true);
  const [predictiveFilters, setPredictiveFilters] = useState({
    category: '',
    priceRange: '',
    minConfidence: '',
  });

  useEffect(() => {
    fetchPredictiveSuggestions();
  }, []);


  const fetchPredictiveSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/bookings/suggestions/predictive', {
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


  const filteredPredictiveSuggestions = predictiveSuggestions.filter(suggestion => {
    const service = suggestion.service;
    const price = service.basePrice;

    if (predictiveFilters.category && service.category !== predictiveFilters.category) return false;
    if (predictiveFilters.priceRange && price) {
      if (predictiveFilters.priceRange === 'low' && price > 1000) return false;
      if (predictiveFilters.priceRange === 'medium' && (price <= 1000 || price > 5000)) return false;
      if (predictiveFilters.priceRange === 'high' && price <= 5000) return false;
    }
    if (predictiveFilters.minConfidence) {
      const minConf = parseFloat(predictiveFilters.minConfidence);
      if (suggestion.confidence < minConf) return false;
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
      case 'wedding': return '💒';
      case 'corporate': return '🏢';
      case 'equipment': return '🎪';
      case 'birthday': return '🎂';
      case 'funeral': return '⚰️';
      default: return '⚙️';
    }
  };

  if (loadingPredictive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding modified bookings from other customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Modified Bookings</h1>
        <p className="text-gray-600 text-lg">See what other customers added to their bookings</p>
      </div>


      {/* Predictive Analytics Suggestions */}
      {predictiveSuggestions.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 text-purple-800 mb-6">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold">📊 Modified Bookings from Other Customers</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Services that other customers frequently added to their bookings
          </p>

          {/* Filters for Predictive Suggestions */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-purple-800 mb-4">Filter Suggestions</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={predictiveFilters.category}
                  onChange={(e) => setPredictiveFilters({ ...predictiveFilters, category: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Categories</option>
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
                  value={predictiveFilters.priceRange}
                  onChange={(e) => setPredictiveFilters({ ...predictiveFilters, priceRange: e.target.value })}
                  className="input-field"
                >
                  <option value="">All Prices</option>
                  <option value="low">₱0 – ₱1,000</option>
                  <option value="medium">₱1,001 – ₱5,000</option>
                  <option value="high">₱5,001+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Confidence</label>
                <select
                  value={predictiveFilters.minConfidence}
                  onChange={(e) => setPredictiveFilters({ ...predictiveFilters, minConfidence: e.target.value })}
                  className="input-field"
                >
                  <option value="">Any Confidence</option>
                  <option value="0.8">High (80%+)</option>
                  <option value="0.6">Medium (60%+)</option>
                  <option value="0.4">Low (40%+)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPredictiveFilters({ category: '', priceRange: '', minConfidence: '' })}
                className="btn-secondary"
              >
                Clear Filters
              </button>
              <span className="text-sm text-gray-600 self-center">
                Showing {filteredPredictiveSuggestions.length} of {predictiveSuggestions.length} suggestions
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPredictiveSuggestions.map((suggestion, index) => (
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

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{suggestion.service.name}</h4>
                    <p className="text-xs text-gray-600 capitalize">{suggestion.service.category.replace('-', ' ')}</p>
                  </div>

                  <p className="text-xs text-gray-700 line-clamp-2">{suggestion.service.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-purple-600">₱{suggestion.service.basePrice.toFixed(2)}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      suggestion.service.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {suggestion.service.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>

                  {/* Service Details */}
                  <div className="bg-gray-50 border border-gray-200 rounded p-2 space-y-1">
                    {suggestion.service.quantity && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Stock:</span>
                        <span className="font-medium">{suggestion.service.quantity} available</span>
                      </div>
                    )}
                    {suggestion.service.leadTime && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Lead Time:</span>
                        <span className="font-medium">{suggestion.service.leadTime} hours</span>
                      </div>
                    )}
                    {suggestion.service.minOrder && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Min Order:</span>
                        <span className="font-medium">{suggestion.service.minOrder}</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  {suggestion.service.features && suggestion.service.features.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-700">Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.service.features.slice(0, 2).map((feature, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white border border-purple-200 rounded p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">📊</span>
                      <div>
                        <p className="text-xs font-medium text-purple-800">Why suggested:</p>
                        <p className="text-xs text-purple-700">
                          Added by {suggestion.frequency} customer{suggestion.frequency > 1 ? 's' : ''} to similar bookings
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          Avg. quantity: {suggestion.averageQuantity.toFixed(1)}
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

    </div>
  );
}