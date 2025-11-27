'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Recommendation {
  item: {
    _id: string;
    name: string;
    description: string;
    shortDescription?: string;
    category: string;
    basePrice: number;
    totalPrice?: number;
    image?: string;
    inclusions?: Array<{
      name: string;
      quantity: number;
    }>;
    isPopular?: boolean;
  };
  type: 'service' | 'package';
  score: number;
  reason: string;
}

interface PersonalizedRecommendationsProps {
  limit?: number;
  className?: string;
}

export default function PersonalizedRecommendations({
  limit = 6,
  className = ''
}: PersonalizedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchRecommendations();
  }, [limit]);

  const fetchRecommendations = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/recommendations/personalized?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.clear();
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch recommendations');
      }
    } catch (err) {
      setError('Network error while fetching recommendations');
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (serviceId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('http://localhost:5000/api/recommendations/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ serviceId }),
      });

      if (response.ok) {
        // Refresh recommendations to reflect the change
        fetchRecommendations();
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Finding personalized recommendations...</p>
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

  if (recommendations.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-4xl mb-4 opacity-50">🎯</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No recommendations yet</h3>
        <p className="text-gray-600 mb-4">Start booking services to get personalized recommendations based on your preferences!</p>
        <Link href="/customer/services" className="btn-primary">
          Browse Services
        </Link>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">Recommended for You</h3>
        <p className="text-sm text-gray-600 mt-1">
          Personalized suggestions based on your booking history and preferences
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec) => (
          <div
            key={`${rec.type}-${rec.item._id}`}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white"
          >
            {/* Item Image */}
            {rec.item.image && (
              <div className="mb-3">
                <img
                  src={rec.item.image.startsWith('/uploads/') ? `http://localhost:5000${rec.item.image}` : rec.item.image}
                  alt={rec.item.name}
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Image+Not+Available';
                  }}
                />
              </div>
            )}

            {/* Item Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">{rec.item.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    rec.type === 'package' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rec.type}
                  </span>
                  {rec.item.isPopular && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Popular
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="text-lg font-bold text-[var(--primary)]">
                  ₱{rec.item.totalPrice || rec.item.basePrice}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
              {rec.item.shortDescription || rec.item.description}
            </p>

            {/* Reason */}
            <div className="mb-3">
              <span className="text-xs text-green-600 font-medium">💡 {rec.reason}</span>
            </div>

            {/* Inclusions Preview (for packages) */}
            {rec.type === 'package' && rec.item.inclusions && rec.item.inclusions.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Includes:</p>
                <div className="flex flex-wrap gap-1">
                  {rec.item.inclusions.slice(0, 3).map((inclusion, index) => (
                    <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {inclusion.quantity > 1 ? `${inclusion.quantity}x ` : ''}{inclusion.name}
                    </span>
                  ))}
                  {rec.item.inclusions.length > 3 && (
                    <span className="text-xs text-gray-500">+{rec.item.inclusions.length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Link
                href={rec.type === 'package' ? `/customer/services?package=${rec.item._id}` : `/customer/booking/${rec.item._id}`}
                className="flex-1 bg-[var(--primary)] text-white px-3 py-2 rounded-md text-xs font-medium hover:bg-[var(--primary-dark)] transition-colors text-center"
              >
                {rec.type === 'package' ? 'View Package' : 'Book Now'}
              </Link>
              {rec.type === 'service' && (
                <button
                  onClick={() => addToFavorites(rec.item._id)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  title="Add to favorites"
                >
                  ❤️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show More Link */}
      {recommendations.length >= limit && (
        <div className="text-center">
          <Link
            href="/customer/recommendations"
            className="text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium"
          >
            View all recommendations →
          </Link>
        </div>
      )}
    </div>
  );
}