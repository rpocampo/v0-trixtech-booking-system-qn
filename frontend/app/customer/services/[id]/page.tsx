'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Service {
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

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.id as string;
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    const fetchService = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/services/${serviceId}`);
        const data = await response.json();
        if (data.success) {
          setService(data.service);
          setSelectedImage(data.service.image || data.service.gallery?.[0] || '');
        }
      } catch (error) {
        console.error('Failed to fetch service:', error);
      } finally {
        setLoading(false);
      }
    };

    if (serviceId) {
      fetchService();
    }
  }, [serviceId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
  </div>;

  if (!service) return <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4">Service Not Found</h2>
      <Link href="/customer/services" className="btn-primary">Back to Services</Link>
    </div>
  </div>;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button */}
      <button onClick={() => router.back()} className="text-[var(--primary)] hover:underline mb-6 flex items-center gap-2">
        ← Back to Services
      </button>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
            {selectedImage ? (
              <img
                src={selectedImage.startsWith('/uploads/') ? `http://localhost:5000${selectedImage}` : selectedImage}
                alt={service.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/600x600?text=Service+Image';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20">
                <div className="text-6xl opacity-50">
                  {service.category === 'event-planning' ? '📋' :
                   service.category === 'catering' ? '🍽️' :
                   service.category === 'furniture' ? '🪑' :
                   service.category === 'lighting' ? '💡' : '⚙️'}
                </div>
              </div>
            )}
          </div>

          {/* Gallery Thumbnails */}
          {service.gallery && service.gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {service.gallery.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(image)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                    selectedImage === image ? 'border-[var(--primary)]' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={image.startsWith('/uploads/') ? `http://localhost:5000${image}` : image}
                    alt={`${service.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/80x80?text=Img';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Service Details */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                service.serviceType === 'service' ? 'bg-blue-500 text-white' :
                service.serviceType === 'equipment' ? 'bg-green-500 text-white' :
                'bg-purple-500 text-white'
              }`}>
                {service.serviceType}
              </span>
              <span className="px-3 py-1 bg-[var(--primary)] text-white text-xs font-semibold rounded-full capitalize">
                {service.category.replace('-', ' ')}
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-2">{service.name}</h1>
            {service.shortDescription && (
              <p className="text-xl text-[var(--muted)]">{service.shortDescription}</p>
            )}
          </div>

          {/* Pricing */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-bold text-[var(--primary)]">₱{service.price}</span>
            <span className="text-sm text-[var(--muted)] capitalize">{(service.priceType || 'flat-rate').replace('-', ' ')}</span>
          </div>

            {/* Service Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {service.serviceType === 'service' && service.duration && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Duration:</span>
                  <span className="font-semibold">{service.duration} minutes</span>
                </div>
              )}

              {(service.serviceType === 'equipment' || service.serviceType === 'supply') && service.quantity && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Available:</span>
                  <span className={`font-semibold ${service.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {service.quantity} units
                  </span>
                </div>
              )}

              {service.location && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Location:</span>
                  <span className="font-semibold capitalize">{service.location === 'both' ? 'indoor/outdoor' : service.location}</span>
                </div>
              )}

              {service.leadTime && (
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Lead Time:</span>
                  <span className="font-semibold">{service.leadTime} hours</span>
                </div>
              )}
            </div>
          </div>

          {/* Book Now Button */}
          <Link
            href={`/customer/booking/${service._id}`}
            className="btn-primary w-full text-center text-lg py-4"
          >
            Book This Service
          </Link>

          {/* Event Types */}
          {service.eventTypes && service.eventTypes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Suitable for:</h3>
              <div className="flex flex-wrap gap-2">
                {service.eventTypes.map((eventType) => (
                  <span key={eventType} className="px-3 py-1 bg-[var(--surface-secondary)] text-[var(--muted)] rounded-full text-sm capitalize">
                    {eventType}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {service.tags && service.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Description */}
      <div className="mt-12 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h2 className="text-2xl font-bold mb-4">Description</h2>
            <p className="text-[var(--muted)] leading-relaxed">{service.description}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Features */}
          {service.features && service.features.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Features</h3>
              <ul className="space-y-2">
                {service.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Service Inclusions */}
          {service.includedItems && service.includedItems.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Service Inclusions</h3>
              <ul className="space-y-2">
                {service.includedItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-1">•</span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Requirements */}
          {service.requirements && service.requirements.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Requirements</h3>
              <ul className="space-y-2">
                {service.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-orange-500 mt-1">!</span>
                    <span className="text-sm">{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}