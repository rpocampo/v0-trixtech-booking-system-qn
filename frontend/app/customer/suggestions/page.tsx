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

interface PackageSuggestion {
  mainService: Service;
  addons: PredictiveSuggestion[];
  totalPrice: number;
  confidence: number;
  frequency: number;
}

export default function SuggestionsPage() {
  const router = useRouter();
  const [packageSuggestions, setPackageSuggestions] = useState<PackageSuggestion[]>([]);
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
          setPackageSuggestions(data.suggestions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching predictive suggestions:', error);
    } finally {
      setLoadingPredictive(false);
    }
  };


  const filteredPackageSuggestions = packageSuggestions.filter(pkg => {
    const service = pkg.mainService;
    const price = pkg.totalPrice;

    if (predictiveFilters.category && service.category !== predictiveFilters.category) return false;
    if (predictiveFilters.priceRange && price) {
      if (predictiveFilters.priceRange === 'low' && price > 1000) return false;
      if (predictiveFilters.priceRange === 'medium' && (price <= 1000 || price > 5000)) return false;
      if (predictiveFilters.priceRange === 'high' && price <= 5000) return false;
    }
    if (predictiveFilters.minConfidence) {
      const minConf = parseFloat(predictiveFilters.minConfidence);
      if (pkg.confidence < minConf) return false;
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


      {/* Package Suggestions */}
      {packageSuggestions.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 text-purple-800 mb-6">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold">📦 Modified Packages from Other Customers</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Complete packages with equipment add-ons that other customers frequently booked together
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
                Showing {filteredPackageSuggestions.length} of {packageSuggestions.length} packages
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-1 lg:grid-cols-1 gap-6">
            {filteredPackageSuggestions.map((pkg, index) => (
              <div key={pkg.mainService._id} className="border border-purple-200 rounded-lg p-6 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 transition-all duration-300 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCategoryIcon(pkg.mainService.category)}</span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{pkg.mainService.name} Package</h3>
                      <p className="text-sm text-gray-600 capitalize">{pkg.mainService.category.replace('-', ' ')} • Modified Package</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pkg.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                      pkg.confidence >= 0.6 ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {pkg.confidence >= 0.8 ? 'Highly Recommended' :
                       pkg.confidence >= 0.6 ? 'Recommended' : 'Suggested'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Package #{index + 1}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Main Service */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-purple-700">🏠 Main Service:</span>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800">{pkg.mainService.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{pkg.mainService.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-lg font-bold text-purple-600">₱{pkg.mainService.basePrice.toFixed(2)}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          pkg.mainService.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {pkg.mainService.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Equipment Add-ons */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-indigo-700">🎪 Equipment Add-ons:</span>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                        {pkg.addons.length} items
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {pkg.addons.map((addon, addonIndex) => (
                        <div key={addon.service._id} className="bg-white border border-indigo-200 rounded p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-800 text-sm">{addon.service.name}</h5>
                              <p className="text-xs text-gray-600">Qty: {addon.averageQuantity.toFixed(1)} • ₱{(addon.service.basePrice * addon.averageQuantity).toFixed(2)}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${
                              addon.service.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {addon.service.isAvailable ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Package Total and Analytics */}
                <div className="mt-6 pt-4 border-t border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-2xl font-bold text-purple-700">Package Total: ₱{pkg.totalPrice.toFixed(2)}</span>
                      <p className="text-xs text-gray-600 mt-1">
                        Main service: ₱{pkg.mainService.basePrice.toFixed(2)} +
                        Add-ons: ₱{(pkg.totalPrice - pkg.mainService.basePrice).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white border border-purple-200 rounded p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">📊</span>
                        <div>
                          <p className="text-xs font-medium text-purple-800">Package Analytics:</p>
                          <p className="text-xs text-purple-700">
                            Booked together by {pkg.frequency} customer{pkg.frequency > 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-purple-600 mt-1">
                            Confidence: {(pkg.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/customer/services/${pkg.mainService._id}`}
                      className="flex-1 btn-secondary text-sm py-2 text-center"
                    >
                      View Main Service
                    </Link>
                    {pkg.mainService.isAvailable && (
                      <button
                        onClick={() => {
                          // Add package to cart logic
                          alert(`Added ${pkg.mainService.name} Package to cart with ${pkg.addons.length} equipment add-ons!`);
                        }}
                        className="flex-1 btn-primary text-sm py-2"
                      >
                        Add Package to Cart
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