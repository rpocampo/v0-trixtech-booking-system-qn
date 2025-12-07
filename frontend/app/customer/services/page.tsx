'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  availableQuantity?: number;
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
   const router = useRouter();
   const searchParams = useSearchParams();
   const { socket } = useSocket();
   const { addToCart, isInCart, getItemQuantity } = useCart();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Check URL parameters first
    const urlDate = searchParams.get('date');
    if (urlDate) {
      return urlDate;
    }
    // Check if user has previously selected a date
    const savedDate = localStorage.getItem('selectedReservationDate');
    if (savedDate) {
      return savedDate;
    }
    // Default to today if no saved date
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [availabilityData, setAvailabilityData] = useState<{[key: string]: {available: boolean, availableQuantity: number, reason?: string}}>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
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
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [locationAllowed, setLocationAllowed] = useState<boolean>(() => {
    // Check if location permission has been previously granted
    return localStorage.getItem('locationPermissionGranted') === 'true';
  });
  const [showLocationModal, setShowLocationModal] = useState<boolean>(() => {
    // Only show modal if no permission decision has been saved
    return !localStorage.getItem('locationPermissionDecision');
  });

  const fetchServices = useCallback(async (filterParams = filters) => {
    try {
      const queryParams = new URLSearchParams();

      // Add filter parameters
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value);
        }
      });

      // Add selected date for availability checking
      if (selectedDate) {
        queryParams.append('date', selectedDate);
      }

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
  }, [selectedDate, filters]);


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
    // Check if item is available for the selected date
    const availableQty = service.availableQuantity ?? service.quantity ?? 0;
    if (availableQty <= 0) {
      alert('This equipment is not available for the selected date.');
      return;
    }

    // Check if trying to add more than available
    const currentQtyInCart = getItemQuantity(service._id);
    if (currentQtyInCart >= availableQty) {
      alert(`You can only add up to ${availableQty} of this item for the selected date.`);
      return;
    }

    addToCart({
      id: service._id,
      name: service.name,
      price: service.price,
      serviceType: service.serviceType,
      category: service.category,
      image: service.image,
      maxOrder: service.maxOrder,
      availableQuantity: availableQty,
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

  // Filter and sort services by category
  useEffect(() => {
    let filtered = services;

    if (selectedCategory === 'all') {
      // Define category priority order (events first, then equipment)
      const categoryOrder = ['wedding', 'corporate', 'birthday', 'funeral', 'party', 'equipment'];

      // Sort services by category priority
      filtered = [...services].sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a.category);
        const bIndex = categoryOrder.indexOf(b.category);
        const aPriority = aIndex === -1 ? categoryOrder.length : aIndex;
        const bPriority = bIndex === -1 ? categoryOrder.length : bIndex;
        return aPriority - bPriority;
      });
    } else {
      // Map frontend category names to backend category names
      const backendCategory = selectedCategory === 'graduation' ? 'graduation party' : selectedCategory;
      filtered = services.filter(service => service.category === backendCategory);
    }

    setFilteredServices(filtered);
  }, [services, selectedCategory]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      console.log('Inventory updated:', data);
      setUpdating(true);

      // Refetch services with current date to get updated availability
      fetchServices();

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleServiceUpdate = (data: any) => {
      console.log('Service updated:', data);
      setUpdating(true);

      // Refetch services with current date to get updated availability
      fetchServices();

      setTimeout(() => setUpdating(false), 2000);
    };

    socket.on('inventory-updated', handleInventoryUpdate);
    socket.on('service-updated', handleServiceUpdate);

    return () => {
      socket.off('inventory-updated', handleInventoryUpdate);
      socket.off('service-updated', handleServiceUpdate);
    };
  }, [socket, fetchServices]); // Add fetchServices as dependency

  if (loading) return (
    <div className="animate-fade-in w-full min-h-screen flex flex-col">
      {/* Hero Section Skeleton */}
      <div className="text-center mb-4 sm:mb-6 px-2 sm:px-4 lg:px-6">
        <div className="h-8 sm:h-10 lg:h-12 bg-gray-200 rounded-lg mb-4 animate-pulse mx-auto max-w-md"></div>
        <div className="h-4 sm:h-5 bg-gray-200 rounded mb-2 animate-pulse mx-auto max-w-lg"></div>
        <div className="h-4 sm:h-5 bg-gray-200 rounded animate-pulse mx-auto max-w-md"></div>
      </div>

      {/* Search/Filter Bar Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 mx-2 sm:mx-4 lg:mx-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 w-full lg:w-auto">
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
          <div className="flex gap-2 flex-wrap w-full lg:w-auto">
            <div className="h-12 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Category Filter Skeleton */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3 sm:mb-4 px-2 sm:px-4 lg:px-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-10 w-20 sm:w-24 bg-gray-200 rounded-full animate-pulse"></div>
        ))}
      </div>

      {/* Services Grid Skeleton */}
      <div className="w-full min-h-screen flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 w-full px-2 sm:px-4 lg:px-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
              {/* Image skeleton */}
              <div className="aspect-[4/3] sm:aspect-[16/9] bg-gray-200"></div>
              {/* Content skeleton */}
              <div className="p-4 sm:p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="mt-4 h-10 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Location permission and checking
  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      setLocationAllowed(false);
      setShowLocationModal(false);
      // Save permission decision
      localStorage.setItem('locationPermissionDecision', 'denied');
      localStorage.setItem('locationPermissionGranted', 'false');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setLocationAllowed(true);
        setShowLocationModal(false);
        // Save permission decision
        localStorage.setItem('locationPermissionDecision', 'granted');
        localStorage.setItem('locationPermissionGranted', 'true');
        // Check if location is within serviceable area (example: within 50km of business location)
        checkLocationProximity(latitude, longitude);
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationError('Unable to access your location. Please enable location services.');
        setLocationAllowed(false);
        setShowLocationModal(false);
        // Save permission decision
        localStorage.setItem('locationPermissionDecision', 'denied');
        localStorage.setItem('locationPermissionGranted', 'false');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const checkLocationProximity = (lat: number, lng: number) => {
    // Example business location (Manila, Philippines - adjust as needed)
    const businessLat = 14.5995;
    const businessLng = 120.9842;

    const distance = calculateDistance(lat, lng, businessLat, businessLng);

    // Allow bookings within 30km of business location
    if (distance > 30) {
      alert(`You are ${distance.toFixed(1)}km away from our service area. Equipment delivery may not be available in your location. Please contact us for special arrangements.`);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const skipLocationCheck = () => {
    setLocationAllowed(false);
    setShowLocationModal(false);
    // Save permission decision
    localStorage.setItem('locationPermissionDecision', 'skipped');
    localStorage.setItem('locationPermissionGranted', 'false');
    alert('Location services are recommended for accurate delivery estimates. You can continue browsing, but delivery availability cannot be guaranteed.');
  };

  // Location Modal
  if (showLocationModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">📍</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Location Access</h2>
              <p className="text-gray-600">Allow location access to ensure equipment delivery is available in your area.</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={requestLocationPermission}
                className="w-full btn-primary py-3"
              >
                Allow Location Access
              </button>

              <button
                onClick={skipLocationCheck}
                className="w-full btn-secondary py-3"
              >
                Skip for Now
              </button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Why we need your location:</strong> To verify that equipment delivery services are available in your area and provide accurate delivery estimates.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="animate-fade-in w-full min-h-screen flex flex-col">
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Inventory updated!</span>
        </div>
      )}

      {/* Location and Date Status */}
      <div className="space-y-4 mb-6 px-2 sm:px-4 lg:px-6">
        {/* Location Status */}
        <div className={`border rounded-lg p-4 flex items-center justify-between ${
          locationAllowed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{locationAllowed ? '📍' : '⚠️'}</span>
            <div>
              <p className={`text-sm font-medium ${locationAllowed ? 'text-green-600' : 'text-yellow-600'}`}>
                {locationAllowed ? 'Location Access Granted' : 'Location Access Limited'}
              </p>
              <p className={`text-sm ${locationAllowed ? 'text-green-700' : 'text-yellow-700'}`}>
                {locationAllowed
                  ? 'Delivery availability verified for your area'
                  : locationError || 'Location services not enabled - delivery availability cannot be guaranteed'
                }
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {!locationAllowed && (
              <button
                onClick={() => setShowLocationModal(true)}
                className="text-yellow-600 hover:text-yellow-800 underline text-sm"
              >
                Enable Location
              </button>
            )}
            <button
              onClick={() => {
                localStorage.removeItem('locationPermissionDecision');
                localStorage.removeItem('locationPermissionGranted');
                setLocationAllowed(false);
                setShowLocationModal(true);
              }}
              className="text-gray-600 hover:text-gray-800 underline text-xs"
            >
              Change Settings
            </button>
          </div>
        </div>

      </div>

      {/* Hero Section */}
      <header className="text-center mb-4 sm:mb-6 px-2 sm:px-4 lg:px-6" role="banner">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent leading-tight">
          Available Equipments
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto leading-relaxed px-2">
          Discover our comprehensive range of equipment rentals designed to make your special occasions unforgettable
        </p>
      </header>

      {/* Search/Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 mx-2 sm:mx-4 lg:mx-6">
        {/* Selected Date Display */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <span>📅</span>
            <span className="font-medium">Selected Date: {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">Equipment availability shown for this date</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center">
           {/* Search Input */}
           <div className="flex-1 w-full lg:w-auto">
             <input
               type="text"
               placeholder="Search equipment..."
               value={pendingFilters.search}
               onChange={(e) => setPendingFilters(prev => ({ ...prev, search: e.target.value }))}
               className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
               autoComplete="off"
             />
           </div>

           {/* Quick Filters */}
           <div className="flex gap-2 flex-wrap w-full lg:w-auto">
             <button
               onClick={() => setShowFilters(!showFilters)}
               className="flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200 active:scale-95 flex-1 lg:flex-none"
             >
               <span>🔍</span>
               <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'More Filters'}</span>
               <span className="sm:hidden">{showFilters ? 'Hide' : 'Filters'}</span>
             </button>
           </div>
         </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                <select
                  value={pendingFilters.category}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
                >
                  <option value="">All Categories</option>
                  <option value="equipment">Equipment</option>
                  <option value="corporate">Corporate</option>
                  <option value="wedding">Wedding</option>
                  <option value="birthday">Birthday</option>
                  <option value="funeral">Funeral</option>
                  <option value="graduation party">Graduation Party</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Price</label>
                <input
                  type="number"
                  placeholder="0"
                  value={pendingFilters.minPrice}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Price</label>
                <input
                  type="number"
                  placeholder="No limit"
                  value={pendingFilters.maxPrice}
                  onChange={(e) => setPendingFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex gap-2">
                  <select
                    value={pendingFilters.sortBy}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="flex-1 px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
                  >
                    <option value="name">Name</option>
                    <option value="price">Price</option>
                    <option value="category">Category</option>
                  </select>
                  <select
                    value={pendingFilters.sortOrder}
                    onChange={(e) => setPendingFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                    className="w-20 px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
                  >
                    <option value="asc">↑</option>
                    <option value="desc">↓</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={clearFilters}
                className="text-red-600 hover:text-red-800 font-medium"
              >
                Clear All Filters
              </button>

              <button
                onClick={applyFilters}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
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
          <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No Equipments Available</h3>
          <p className="text-[var(--muted)]">We're currently updating our equipments. Please check back soon!</p>
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3 sm:mb-4 px-2 sm:px-4 lg:px-6">
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

          {/* Services Grid - Maximized Screen Usage */}
          <div className="w-full min-h-screen flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 w-full" role="main" aria-label="Equipment listings">
              {filteredServices.map((service, index) => (
                <article
                  key={service._id}
                  className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden border border-gray-200 ${
                    (service.availableQuantity ?? service.quantity ?? 0) <= 0 ? 'opacity-60 grayscale' : ''
                  }`}
                  role="article"
                  aria-labelledby={`service-${service._id}-title`}
                  aria-describedby={`service-${service._id}-description`}
                >
                {/* Service Image */}
                <div className="relative overflow-hidden aspect-[4/3] sm:aspect-[16/9]">
                  {service.image ? (
                    <img
                      src={service.image.startsWith('/uploads/') ? `http://localhost:5000${service.image}` : service.image}
                      alt={service.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x240?text=Service+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <div className="text-3xl sm:text-4xl text-gray-400">
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
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center justify-center ${
                      service.serviceType === 'service' ? 'bg-blue-500 text-white' :
                      service.serviceType === 'equipment' ? 'bg-green-500 text-white' :
                      'bg-purple-500 text-white'
                    }`}>
                      {service.serviceType === 'service' ? 'event' : service.serviceType}
                    </span>
                    <span className="px-2 py-1 bg-white text-gray-700 text-xs font-semibold rounded-full capitalize shadow-sm">
                      {service.category.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Availability Badge */}
                  {(service.serviceType === 'equipment' || service.serviceType === 'supply') && (service.availableQuantity !== undefined || service.quantity !== undefined) && (
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full shadow-sm ${
                        (service.availableQuantity ?? service.quantity ?? 0) > 5 ? 'bg-green-500 text-white' :
                        (service.availableQuantity ?? service.quantity ?? 0) > 0 ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {(service.availableQuantity ?? service.quantity ?? 0) > 0
                          ? `${service.availableQuantity ?? service.quantity ?? 0} remaining`
                          : 'Unavailable'
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Service Content */}
                <div className="p-4 sm:p-6">
                  <h3 id={`service-${service._id}-title`} className="text-base sm:text-lg font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight">
                    {service.name}
                  </h3>

                  <p id={`service-${service._id}-description`} className="text-gray-600 text-xs sm:text-sm mb-4 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Service Details */}
                  <div className="space-y-2 mb-4">
                    {(service.serviceType === 'equipment' || service.serviceType === 'supply') && (service.availableQuantity ?? service.quantity) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <span>📦</span>
                          <span>Available</span>
                        </span>
                        <span className="font-medium text-gray-900">{service.availableQuantity ?? service.quantity} units</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <span>💰</span>
                        <span>Price</span>
                      </span>
                      <span className="text-xl font-bold text-blue-600">₱{isNaN(service.price) ? '0.00' : service.price.toFixed(2)}</span>
                    </div>

                    {service.location && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <span>📍</span>
                          <span>Location</span>
                        </span>
                        <span className="font-medium text-gray-900 capitalize">{service.location === 'both' ? 'indoor/outdoor' : service.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => viewServiceDetails(service)}
                      className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200"
                    >
                      View Details
                    </button>
                    {isInCart(service._id) ? (
                      <div className="flex gap-2">
                        <button
                          disabled
                          className="flex-1 bg-green-50 text-green-600 border border-green-200 py-2 px-4 rounded-lg font-medium cursor-not-allowed"
                        >
                          ✓ In Cart
                        </button>
                        <Link
                          href="/customer/cart"
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 text-center"
                        >
                          View Cart
                        </Link>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(service)}
                        disabled={(service.availableQuantity ?? service.quantity ?? 0) <= 0}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${
                          (service.availableQuantity ?? service.quantity ?? 0) <= 0
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {(service.availableQuantity ?? service.quantity ?? 0) <= 0 ? 'Unavailable' : 'Add to Reservation'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-6 sm:mt-8 text-center px-2 sm:px-4 lg:px-6">
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
                    <h4 className="text-xl font-semibold mb-4">Equipment Information</h4>
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
                          <span className="font-medium capitalize">{selectedService.location === 'both' ? 'indoor/outdoor' : selectedService.location}</span>
                        </div>
                      )}
                      {selectedService.serviceType === 'service' && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Duration:</span>
                          <span className="font-medium">1 day</span>
                        </div>
                      )}
                      {(selectedService.serviceType === 'equipment' || selectedService.serviceType === 'supply') && (selectedService.availableQuantity ?? selectedService.quantity ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Available Quantity:</span>
                          <span className={`font-medium ${(selectedService.availableQuantity ?? selectedService.quantity ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedService.availableQuantity ?? selectedService.quantity ?? 0} units
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
                  Reserve This Equipment
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
