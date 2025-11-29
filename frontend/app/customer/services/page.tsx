'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '../../../components/SocketProvider';
import { useCart } from '../../../components/CartContext';

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
  const { addToCart, isInCart, getItemQuantity } = useCart();
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
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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
    fetchServices(clearedFilters);
    setShowFilters(false); // Close the panel after clearing
  };

  const viewServiceDetails = (service: Service) => {
    setSelectedService(service);
    setShowServiceModal(true);
  };

  const handleAddToCart = (service: Service) => {
    addToCart({
      id: service._id,
      name: service.name,
      price: service.price,
      serviceType: service.serviceType,
      category: service.category,
      image: service.image,
      maxOrder: service.maxOrder,
      availableQuantity: service.quantity,
    });
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    fetchServices(filters);
  }, [filters]);

  // Real-time search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pendingFilters.search !== filters.search) {
        setFilters(prev => ({ ...prev, search: pendingFilters.search }));
      }
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [pendingFilters.search, filters.search]);

  const applyFilters = () => {
    setFilters(prev => ({
      ...prev,
      category: pendingFilters.category,
      minPrice: pendingFilters.minPrice,
      maxPrice: pendingFilters.maxPrice,
      sortBy: pendingFilters.sortBy,
      sortOrder: pendingFilters.sortOrder,
    }));
    setShowFilters(false); // Close the panel after applying
  };

  // Filter services by category
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredServices(services);
    } else {
      setFilteredServices(services.filter(service => service.category === selectedCategory));
    }
  }, [services, selectedCategory]);

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
      <div className="text-center mb-8 sm:mb-12 px-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">
          Our Services
        </h1>
        <p className="text-lg sm:text-xl text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center gap-2"
            >
              <span>🔍</span>
              {showFilters ? 'Hide Filters' : 'More Filters'}
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Type</label>
                <select
                  value={pendingFilters.category}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">All Categories</option>
                  <option value="equipment">Equipment</option>
                  <option value="corporate">Corporate</option>
                  <option value="wedding">Wedding</option>
                  <option value="birthday">Birthday</option>
                  <option value="funeral">Funeral</option>
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
                <div className="flex gap-2">
                  <select
                    value={pendingFilters.sortBy}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="input-field flex-1"
                  >
                    <option value="name">Name</option>
                    <option value="price">Price</option>
                    <option value="category">Category</option>
                  </select>
                  <select
                    value={pendingFilters.sortOrder}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                    className="input-field w-20"
                  >
                    <option value="asc">↑</option>
                    <option value="desc">↓</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
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
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 px-4">
            {['all', 'equipment', 'corporate', 'wedding', 'birthday', 'funeral'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 sm:px-4 py-2 rounded-full transition-all duration-200 capitalize text-sm sm:text-base font-medium ${
                  selectedCategory === category
                    ? 'bg-[var(--primary)] text-white shadow-md'
                    : 'bg-[var(--surface-secondary)] text-[var(--muted)] hover:bg-[var(--primary)] hover:text-white hover:shadow-sm'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Services Grid - Full Width Responsive Carousel */}
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
              {filteredServices.map((service, index) => (
                <div
                  key={service._id}
                  className="service-card group animate-fade-in w-full min-h-[350px] min-w-[280px]"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                {/* Service Image */}
                <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-[var(--primary-50)] to-[var(--accent)]/10">
                  {service.image ? (
                    <img
                      src={service.image.startsWith('/uploads/') ? `http://localhost:5000${service.image}` : service.image}
                      alt={service.name}
                      className="service-image w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x240?text=Service+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20">
                      <div className="text-4xl sm:text-5xl opacity-50">
                        {service.category === 'party' ? '🎉' :
                         service.category === 'wedding' ? '💒' :
                         service.category === 'corporate' ? '🏢' :
                         service.category === 'equipment' ? '🎪' :
                         service.category === 'birthday' ? '🎂' :
                         service.category === 'funeral' ? '⚰️' : '⚙️'}
                      </div>
                    </div>
                  )}

                  {/* Service Type Badge */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      service.serviceType === 'service' ? 'bg-blue-500 text-white' :
                      service.serviceType === 'equipment' ? 'bg-green-500 text-white' :
                      'bg-purple-500 text-white'
                    }`}>
                      {service.serviceType}
                    </span>
                    <span className="px-2 py-1 bg-white/95 backdrop-blur-sm text-[var(--primary)] text-xs font-semibold rounded-full capitalize shadow-sm">
                      {service.category.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Availability Badge */}
                  {(service.serviceType === 'equipment' || service.serviceType === 'supply') && service.quantity !== undefined && (
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full shadow-sm ${
                        service.quantity > 5 ? 'bg-green-500 text-white' :
                        service.quantity > 0 ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {service.quantity > 0 ? `${service.quantity} left` : 'Out of stock'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Service Content */}
                <div className="p-4 sm:p-6 flex flex-col flex-1 min-h-[200px]">
                  <h3 className="text-lg sm:text-xl font-bold text-[var(--foreground)] mb-2 group-hover:text-[var(--primary)] transition-colors line-clamp-2">
                    {service.name}
                  </h3>

                  <p className="text-[var(--muted)] text-sm mb-4 line-clamp-3 flex-1 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Service Details */}
                  <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                    {service.serviceType === 'service' && (
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-[var(--muted)] flex items-center gap-1 flex-1 min-w-0">
                          <span>⏱️</span>
                          <span className="truncate">Duration</span>
                        </span>
                        <span className="font-semibold text-[var(--foreground)] flex-shrink-0 ml-2">1 day</span>
                      </div>
                    )}

                    {(service.serviceType === 'equipment' || service.serviceType === 'supply') && service.quantity && (
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-[var(--muted)] flex items-center gap-1 flex-1 min-w-0">
                          <span>📦</span>
                          <span className="truncate">Available</span>
                        </span>
                        <span className="font-semibold text-[var(--foreground)] flex-shrink-0 ml-2">{service.quantity} units</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-[var(--muted)] flex items-center gap-1 flex-1 min-w-0">
                        <span>💰</span>
                        <span className="truncate">{(service.priceType || 'flat-rate').replace('-', ' ')}</span>
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-[var(--primary)] flex-shrink-0 ml-2">₱{isNaN(service.price) ? '0.00' : service.price.toFixed(2)}</span>
                    </div>

                    {service.location && (
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-[var(--muted)] flex items-center gap-1 flex-1 min-w-0">
                          <span>📍</span>
                          <span className="truncate">Location</span>
                        </span>
                        <span className="font-semibold text-[var(--foreground)] flex-shrink-0 ml-2 capitalize">{service.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col md:flex-row gap-3 mt-auto">
                    <button
                      onClick={() => viewServiceDetails(service)}
                      className="btn-secondary flex-1 text-center text-sm py-3 sm:py-4"
                    >
                      View Details
                    </button>
                    {isInCart(service._id) ? (
                      <div className="flex flex-col md:flex-row gap-3 flex-1">
                        <button
                          onClick={() => handleAddToCart(service)}
                          className="btn-secondary flex-1 text-center text-green-600 border-green-200 hover:bg-green-50 text-sm py-3 sm:py-4"
                        >
                          + Add More
                        </button>
                        <Link
                          href="/customer/cart"
                          className="btn-primary flex-1 text-center group-hover:shadow-lg group-hover:shadow-[var(--primary)]/25 transition-all duration-300 text-sm py-3 sm:py-4"
                        >
                          View Cart ({getItemQuantity(service._id)})
                        </Link>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(service)}
                        className="btn-primary flex-1 text-center group-hover:shadow-lg group-hover:shadow-[var(--primary)]/25 transition-all duration-300 text-sm py-3 sm:py-4"
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

          {/* Call to Action */}
          <div className="mt-12 sm:mt-16 text-center px-4">
            <div className="card-gradient p-6 sm:p-8 max-w-2xl mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-3 sm:mb-4">
                Need Something Custom?
              </h3>
              <p className="text-[var(--muted)] mb-4 sm:mb-6 text-sm sm:text-base leading-relaxed">
                Can't find exactly what you're looking for? Contact us for custom event planning services.
              </p>
              <button className="btn-secondary text-sm sm:text-base px-6 py-3">
                Contact Us
              </button>
            </div>
          </div>
        </>
      )}

      {/* Service Details Modal */}
      {showServiceModal && selectedService && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-modal-title"
          aria-describedby="service-modal-description"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <h3 id="service-modal-title" className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--foreground)] pr-4 line-clamp-2">{selectedService.name}</h3>
                <button
                  onClick={() => setShowServiceModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl sm:text-3xl flex-shrink-0"
                >
                  ×
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Service Image */}
                <div className="space-y-3 sm:space-y-4">
                  {selectedService.image ? (
                    <img
                      src={selectedService.image.startsWith('/uploads/') ? `http://localhost:5000${selectedService.image}` : selectedService.image}
                      alt={selectedService.name}
                      className="w-full h-48 sm:h-56 lg:h-64 object-cover rounded-lg"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Service+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 sm:h-56 lg:h-64 bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 rounded-lg flex items-center justify-center">
                      <div className="text-4xl sm:text-5xl lg:text-6xl opacity-50">
                        {selectedService.category === 'party' ? '🎉' :
                         selectedService.category === 'wedding' ? '💒' :
                         selectedService.category === 'corporate' ? '🏢' :
                         selectedService.category === 'equipment' ? '🎪' :
                         selectedService.category === 'birthday' ? '🎂' :
                         selectedService.category === 'funeral' ? '⚰️' : '⚙️'}
                      </div>
                    </div>
                  )}

                  {/* Gallery Images */}
                  {selectedService.gallery && selectedService.gallery.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedService.gallery.slice(0, 3).map((image, index) => (
                        <img
                          key={index}
                          src={image.startsWith('/uploads/') ? `http://localhost:5000${image}` : image}
                          alt={`${selectedService.name} ${index + 1}`}
                          className="w-full h-16 sm:h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/150x100?text=Image';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Service Details */}
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="card p-6">
                    <h4 className="text-xl font-semibold mb-4">Service Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Category:</span>
                        <span className="font-medium capitalize">{selectedService.category.replace('-', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Type:</span>
                        <span className="font-medium capitalize">{selectedService.serviceType}</span>
                      </div>
                      {selectedService.location && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Location:</span>
                          <span className="font-medium capitalize">{selectedService.location}</span>
                        </div>
                      )}
                      {selectedService.serviceType === 'service' && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Duration:</span>
                          <span className="font-medium">1 day</span>
                        </div>
                      )}
                      {(selectedService.serviceType === 'equipment' || selectedService.serviceType === 'supply') && selectedService.quantity && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Available Quantity:</span>
                          <span className={`font-medium ${selectedService.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedService.quantity} units
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="card p-6">
                    <h4 className="text-xl font-semibold mb-4">Pricing</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted)]">Price:</span>
                        <span className="text-3xl font-bold text-[var(--primary)]">₱{isNaN(selectedService.price) ? '0.00' : selectedService.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Price Type:</span>
                        <span className="font-medium capitalize">{(selectedService.priceType || 'flat-rate').replace('-', ' ')}</span>
                      </div>
                      {selectedService.minOrder && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Minimum Order:</span>
                          <span className="font-medium">{selectedService.minOrder}</span>
                        </div>
                      )}
                      {selectedService.maxOrder && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Number of Guests:</span>
                          <span className="font-medium">{selectedService.maxOrder}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div id="service-modal-description" className="card p-6">
                    <h4 className="text-xl font-semibold mb-4">Description</h4>
                    <p className="text-[var(--muted)] leading-relaxed">{selectedService.description}</p>
                    {selectedService.shortDescription && selectedService.shortDescription !== selectedService.description && (
                      <p className="text-[var(--muted)] leading-relaxed mt-3 text-sm">
                        {selectedService.shortDescription}
                      </p>
                    )}
                  </div>

                  {/* Features & Included Items */}
                  {(selectedService.features && selectedService.features.length > 0) ||
                   (selectedService.includedItems && selectedService.includedItems.length > 0) && (
                    <div className="card p-6">
                      <h4 className="text-xl font-semibold mb-4">What's Included</h4>
                      <div className="space-y-4">
                        {selectedService.features && selectedService.features.length > 0 && (
                          <div>
                            <h5 className="font-medium mb-2">Features:</h5>
                            <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                              {selectedService.features.map((feature, index) => (
                                <li key={index}>{feature}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedService.includedItems && selectedService.includedItems.length > 0 && (
                          <div>
                            <h5 className="font-medium mb-2">Included Items:</h5>
                            <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                              {selectedService.includedItems.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Requirements */}
                  {selectedService.requirements && selectedService.requirements.length > 0 && (
                    <div className="card p-6">
                      <h4 className="text-xl font-semibold mb-4">Requirements</h4>
                      <ul className="list-disc list-inside text-[var(--muted)] space-y-1">
                        {selectedService.requirements.map((requirement, index) => (
                          <li key={index}>{requirement}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Event Types */}
                  {selectedService.eventTypes && selectedService.eventTypes.length > 0 && (
                    <div className="card p-6">
                      <h4 className="text-xl font-semibold mb-4">Suitable For</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedService.eventTypes.map((eventType, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-sm font-medium capitalize"
                          >
                            {eventType}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedService.tags && selectedService.tags.length > 0 && (
                    <div className="card p-6">
                      <h4 className="text-xl font-semibold mb-4">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedService.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowServiceModal(false)}
                  className="btn-secondary flex-1 order-2 sm:order-1 text-sm sm:text-base py-3"
                >
                  Close
                </button>
                <Link
                  href={`/customer/booking/${selectedService._id}`}
                  className="btn-primary flex-1 text-center order-1 sm:order-2 text-sm sm:text-base py-3"
                  onClick={() => setShowServiceModal(false)}
                >
                  Book This Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
