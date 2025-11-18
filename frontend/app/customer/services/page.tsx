'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '../../../components/SocketProvider';

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

export default function Services() {
  const { socket } = useSocket();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState({
    serviceType: '',
    eventType: '',
    location: '',
    category: '',
    search: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [pendingFilters, setPendingFilters] = useState({
    serviceType: '',
    eventType: '',
    location: '',
    category: '',
    search: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);

  const fetchServices = async (filterParams = filters) => {
    try {
      const queryParams = new URLSearchParams();

      // Add filter parameters
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(`http://localhost:5000/api/services?${queryParams}`);
      const data = await response.json();
      if (data.success) {
        setServices(data.services);
        setFilteredServices(data.services);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      serviceType: '',
      eventType: '',
      location: '',
      category: '',
      search: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'name',
      sortOrder: 'asc',
    };
    setFilters(clearedFilters);
    setPendingFilters(clearedFilters);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      fetchServices();
    }
  }, [filters]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      console.log('Inventory updated:', data);
      setUpdating(true);

      // Update the specific service's quantity
      setServices(prev =>
        prev.map(service =>
          service._id === data.serviceId
            ? { ...service, quantity: data.availableQuantity }
            : service
        )
      );

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleServiceUpdate = (data: any) => {
      console.log('Service updated:', data);
      setUpdating(true);

      // Update the service details
      setServices(prev =>
        prev.map(service =>
          service._id === data.serviceId
            ? {
                ...service,
                quantity: data.quantity,
                isAvailable: data.isAvailable
              }
            : service
        )
      );

      setTimeout(() => setUpdating(false), 2000);
    };

    socket.on('inventory-updated', handleInventoryUpdate);
    socket.on('service-updated', handleServiceUpdate);

    return () => {
      socket.off('inventory-updated', handleInventoryUpdate);
      socket.off('service-updated', handleServiceUpdate);
    };
  }, [socket]);

  if (loading) return <div>Loading services...</div>;

  return (
    <div className="animate-fade-in">
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Inventory updated!</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
          Our Services
        </h1>
        <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto">
          Discover our comprehensive range of event services designed to make your special occasions unforgettable
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          {/* Search Input */}
          <div className="flex-1 w-full lg:w-auto">
            <input
              type="text"
              placeholder="Search services..."
              value={pendingFilters.search}
              onChange={(e) => setPendingFilters(prev => ({ ...prev, search: e.target.value }))}
              className="input-field w-full"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={pendingFilters.serviceType}
              onChange={(e) => setPendingFilters(prev => ({ ...prev, serviceType: e.target.value }))}
              className="input-field min-w-[120px]"
            >
              <option value="">All Types</option>
              <option value="service">Services</option>
              <option value="equipment">Equipment</option>
              <option value="supply">Supplies</option>
            </select>

            <select
              value={pendingFilters.eventType}
              onChange={(e) => setPendingFilters(prev => ({ ...prev, eventType: e.target.value }))}
              className="input-field min-w-[120px]"
            >
              <option value="">All Events</option>
              <option value="wedding">Wedding</option>
              <option value="corporate">Corporate</option>
              <option value="birthday">Birthday</option>
              <option value="graduation">Graduation</option>
              <option value="party">Party</option>
            </select>

            <select
              value={pendingFilters.location}
              onChange={(e) => setPendingFilters(prev => ({ ...prev, location: e.target.value }))}
              className="input-field min-w-[120px]"
            >
              <option value="">All Locations</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center gap-2"
            >
              <span>🔍</span>
              {showFilters ? 'Hide Filters' : 'More Filters'}
            </button>

            <button
              onClick={applyFilters}
              className="btn-primary flex items-center gap-2"
            >
              <span>✓</span>
              Apply Filters
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={pendingFilters.category}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">All Categories</option>
                  <option value="event-planning">Event Planning</option>
                  <option value="catering">Catering</option>
                  <option value="photography">Photography</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="decoration">Decoration</option>
                  <option value="setup-teardown">Setup/Teardown</option>
                  <option value="furniture">Furniture</option>
                  <option value="lighting">Lighting</option>
                  <option value="sound-system">Sound System</option>
                  <option value="tents-canopies">Tents & Canopies</option>
                  <option value="linens-tableware">Linens & Tableware</option>
                  <option value="party-supplies">Party Supplies</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Min Price</label>
                <input
                  type="number"
                  placeholder="0"
                  value={pendingFilters.minPrice}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Price</label>
                <input
                  type="number"
                  placeholder="No limit"
                  value={pendingFilters.maxPrice}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <select
                  value={pendingFilters.sortBy}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="category">Category</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={clearFilters}
                className="text-red-600 hover:text-red-800 hover:underline"
              >
                Clear All Filters
              </button>

              <button
                onClick={applyFilters}
                className="btn-primary"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <div className="card p-12 text-center animate-fade-in">
          <div className="text-6xl mb-4">🎪</div>
          <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No Services Available</h3>
          <p className="text-[var(--muted)]">We're currently updating our services. Please check back soon!</p>
        </div>
      ) : (
        <>
          {/* Category Filter (if needed in future) */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {['all', ...Array.from(new Set(services.map(s => s.category)))].map((category) => (
              <button
                key={category}
                className="px-4 py-2 rounded-full bg-[var(--surface-secondary)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-white transition-all duration-200 capitalize"
              >
                {category}
              </button>
            ))}
          </div>

          {/* Services Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredServices.map((service, index) => (
              <div
                key={service._id}
                className="service-card group animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Service Image */}
                <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-[var(--primary-50)] to-[var(--accent)]/10">
                  {service.image ? (
                    <img
                      src={service.image.startsWith('/uploads/') ? `http://localhost:5000${service.image}` : service.image}
                      alt={service.name}
                      className="service-image w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x240?text=Service+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20">
                      <div className="text-4xl opacity-50">
                        {service.category === 'party' ? '🎉' :
                         service.category === 'wedding' ? '💒' :
                         service.category === 'corporate' ? '🏢' :
                         service.category === 'equipment' ? '🎪' :
                         service.category === 'cleaning' ? '🧹' : '⚙️'}
                      </div>
                    </div>
                  )}

                  {/* Service Type Badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      service.serviceType === 'service' ? 'bg-blue-500 text-white' :
                      service.serviceType === 'equipment' ? 'bg-green-500 text-white' :
                      'bg-purple-500 text-white'
                    }`}>
                      {service.serviceType}
                    </span>
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-[var(--primary)] text-xs font-semibold rounded-full capitalize">
                      {service.category.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Availability Badge */}
                  {(service.serviceType === 'equipment' || service.serviceType === 'supply') && service.quantity !== undefined && (
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        service.quantity > 5 ? 'bg-green-500 text-white' :
                        service.quantity > 0 ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {service.quantity > 0 ? `${service.quantity} available` : 'Out of stock'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Service Content */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-[var(--foreground)] mb-2 group-hover:text-[var(--primary)] transition-colors">
                    {service.name}
                  </h3>

                  <p className="text-[var(--muted)] text-sm mb-4 line-clamp-2 flex-1">
                    {service.description}
                  </p>

                  {/* Service Details */}
                  <div className="space-y-3 mb-6">
                    {service.serviceType === 'service' && service.duration && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--muted)] flex items-center gap-1">
                          <span>⏱️</span> Duration
                        </span>
                        <span className="font-semibold text-[var(--foreground)]">{service.duration} min</span>
                      </div>
                    )}

                    {(service.serviceType === 'equipment' || service.serviceType === 'supply') && service.quantity && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--muted)] flex items-center gap-1">
                          <span>📦</span> Available
                        </span>
                        <span className="font-semibold text-[var(--foreground)]">{service.quantity} units</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)] flex items-center gap-1">
                        <span>💰</span> {(service.priceType || 'flat-rate').replace('-', ' ')}
                      </span>
                      <span className="text-2xl font-bold text-[var(--primary)]">₱{service.price}</span>
                    </div>

                    {service.location && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--muted)] flex items-center gap-1">
                          <span>📍</span> Location
                        </span>
                        <span className="font-semibold text-[var(--foreground)] capitalize">{service.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Link
                      href={`/customer/services/${service._id}`}
                      className="btn-secondary flex-1 text-center"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/customer/booking/${service._id}`}
                      className="btn-primary flex-1 text-center group-hover:shadow-lg group-hover:shadow-[var(--primary)]/25 transition-all duration-300"
                    >
                      Book Now
                      <span className="ml-2 group-hover:translate-x-1 transition-transform duration-200">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <div className="card-gradient p-8 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-[var(--foreground)] mb-4">
                Need Something Custom?
              </h3>
              <p className="text-[var(--muted)] mb-6">
                Can't find exactly what you're looking for? Contact us for custom event planning services.
              </p>
              <button className="btn-secondary">
                Contact Us
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
