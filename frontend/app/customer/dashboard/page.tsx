'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../components/SocketProvider';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Booking {
  id: string;
  serviceId: {
    name: string;
  };
  bookingDate: string;
  status: string;
  totalPrice: number;
}

interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  quantity?: number;
  availableQuantity?: number;
}


export default function CustomerDashboard() {
  const router = useRouter();
  const { socket } = useSocket();
  const [user, setUser] = useState<User | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [locationRestricted, setLocationRestricted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dailyBookings, setDailyBookings] = useState<Booking[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Location-based access control
  useEffect(() => {
    const checkUserLocation = () => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by this browser');
        setLocationRestricted(true);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });

          // Check if user is within serviceable area (example: within 50km of business location)
          // Business location coordinates (example: Manila, Philippines)
          const businessLat = 14.5995;
          const businessLng = 120.9842;

          const distance = calculateDistance(latitude, longitude, businessLat, businessLng);
          const maxDistance = 100; // 100km radius

          if (distance > maxDistance) {
            setLocationRestricted(true);
            setLocationError(`Service not available in your area. Distance: ${distance.toFixed(1)}km`);
          } else {
            setLocationRestricted(false);
            setLocationError('');
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Unable to determine your location. Please enable location services.');
          setLocationRestricted(true);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    };

    checkUserLocation();
  }, []);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    // Filter bookings for the selected date
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookingsForDate = recentBookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDate);
      return bookingDate >= dayStart && bookingDate <= dayEnd;
    });
    setDailyBookings(bookingsForDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const getBookingsForDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return recentBookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDate);
      return bookingDate >= dayStart && bookingDate <= dayEnd;
    });
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const calendarDays = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      calendarDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="btn-secondary px-3 py-1"
            >
              ←
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="btn-secondary px-3 py-1"
            >
              →
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm text-[var(--muted)]">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));
            const dayBookings = getBookingsForDate(date);
            const hasBookings = dayBookings.length > 0;

            return (
              <button
                key={index}
                onClick={() => !isPastDate && handleDateClick(date)}
                disabled={isPastDate}
                className={`p-3 text-sm border rounded-lg transition-colors min-h-[80px] ${
                  isPastDate
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : isCurrentMonth
                      ? isSelected
                        ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]'
                        : isToday
                          ? 'bg-[var(--secondary)]/10 border-[var(--secondary)] text-[var(--secondary)]'
                          : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                <div className="text-right mb-1">{date.getDate()}</div>
                {!isPastDate && (
                  <div className="text-xs">
                    {hasBookings ? (
                      (() => {
                        const confirmedBookings = dayBookings.filter(b => b.status === 'confirmed').length;
                        const pendingBookings = dayBookings.filter(b => b.status !== 'confirmed').length;

                        return (
                          <>
                            {confirmedBookings > 0 && (
                              <div className="bg-[var(--primary)] text-white rounded-full px-2 py-1 text-center mb-1">
                                {confirmedBookings} reserved
                              </div>
                            )}
                            {pendingBookings > 0 && (
                              <div className="bg-[var(--accent)] text-white rounded-full px-2 py-1 text-center">
                                {pendingBookings} open
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <div className="bg-[var(--secondary)] text-white rounded-full px-2 py-1 text-center">
                        open
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Daily Bookings Display */}
        {selectedDate && (
          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold mb-4">
              Bookings for {selectedDate.toLocaleDateString()}
            </h3>
            {dailyBookings.length > 0 ? (
              <div className="space-y-3">
                {dailyBookings.map(booking => (
                  <div key={booking.id} className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-secondary)]">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm text-[var(--muted)]">Equipment:</span>
                        <p className="font-medium">{booking.serviceId?.name || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-[var(--muted)]">Time:</span>
                        <p className="font-medium">{new Date(booking.bookingDate).toLocaleTimeString()}</p>
                      </div>
                      <div>
                        <span className="text-sm text-[var(--muted)]">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--muted)] text-center py-8">No bookings for this date</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Real-time updates for featured services
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      console.log('Dashboard inventory updated:', data);
      setFeaturedServices(prev =>
        prev.map(service =>
          service._id === data.serviceId
            ? { ...service, quantity: data.availableQuantity, availableQuantity: data.availableQuantity }
            : service
        )
      );
    };

    const handleServiceUpdate = (data: any) => {
      console.log('Dashboard service updated:', data);
      setFeaturedServices(prev =>
        prev.map(service =>
          service._id === data.serviceId
            ? {
                ...service,
                quantity: data.quantity,
                availableQuantity: data.availableQuantity
              }
            : service
        )
      );
    };

    socket.on('inventory-updated', handleInventoryUpdate);
    socket.on('service-updated', handleServiceUpdate);

    return () => {
      socket.off('inventory-updated', handleInventoryUpdate);
      socket.off('service-updated', handleServiceUpdate);
    };
  }, [socket]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [userRes, bookingsRes, servicesRes] = await Promise.all([
          fetch('http://localhost:5000/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:5000/api/bookings', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:5000/api/services?limit=8&sortBy=name&sortOrder=asc', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (userRes.status === 401 || bookingsRes.status === 401) {
          // Token expired or invalid, redirect to login
          localStorage.clear();
          router.push('/login');
          return;
        }

        const userData = await userRes.json();
        const bookingsData = await bookingsRes.json();

        if (userData.success) {
          setUser(userData.user);
        }

        if (bookingsData.success && bookingsData.bookings) {
          const bookings = bookingsData.bookings;
          const upcoming = bookings.filter((b: any) => b.status === 'confirmed');
          const completed = bookings.filter((b: any) => b.status === 'completed');

          setStats({
            totalBookings: bookings.length,
            upcomingBookings: upcoming.length,
            completedBookings: completed.length,
          });

          // Transform bookings to match the expected interface
          const transformedBookings = bookings.slice(0, 5).map((booking: any) => ({
            id: booking._id,
            serviceId: booking.serviceId,
            bookingDate: booking.bookingDate,
            status: booking.status,
            totalPrice: booking.totalPrice,
          }));

          setRecentBookings(transformedBookings);
        }

        if (servicesRes.status === 401) {
          // Token expired, don't log as error for services
          return;
        }

        const servicesData = await servicesRes.json();
        if (servicesData.success && servicesData.services) {
          // Transform services to match the expected interface
          const transformedServices = servicesData.services.slice(0, 8).map((service: any) => ({
            _id: service._id,
            name: service.name,
            description: service.description,
            price: service.price,
            image: service.image,
            category: service.category,
            quantity: service.quantity,
            availableQuantity: service.availableQuantity,
          }));

          setFeaturedServices(transformedServices);
        }

      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3">

      {/* Welcome Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
              Welcome back, {user?.name}! 👋
            </h1>
            <p className="text-[var(--muted)]">Manage your bookings and discover equipment</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-xs text-[var(--muted)]">Member since</div>
            <div className="font-semibold text-[var(--foreground)]">
              {user ? new Date().getFullYear() : '2024'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">

        {renderCalendar()}
      </div>

      {/* Location Restriction Warning */}
      {locationRestricted && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Service Unavailable</h3>
              <p className="text-sm text-red-700">{locationError}</p>
            </div>
          </div>
        </div>
      )}




      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {locationRestricted ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 opacity-60 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--surface-secondary)] rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--muted)]">Browse Equipment</h3>
                <p className="text-[var(--muted)] text-sm">Service not available in your area</p>
              </div>
            </div>
          </div>
        ) : (
          <Link href="/customer/services" className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 hover:shadow-md hover:border-[var(--primary)] transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--primary-50)] rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Browse Equipment</h3>
                <p className="text-[var(--muted)] text-sm">Find and rent equipment for your events</p>
              </div>
            </div>
          </Link>
        )}

        <Link href="/customer/bookings" className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 hover:shadow-md hover:border-[var(--secondary)] transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--secondary)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">My Reservations</h3>
              <p className="text-[var(--muted)] text-sm">View and manage your reservations</p>
            </div>
          </div>
        </Link>

        <Link href="/customer/profile" className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 hover:shadow-md hover:border-[var(--accent)] transition-all duration-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--foreground)]">Profile</h3>
              <p className="text-[var(--muted)] text-sm">Update your account information</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Featured Equipment Carousel */}
      {featuredServices.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Featured Equipment</h2>
            <Link href="/customer/services" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          </div>

          <div className="relative overflow-hidden">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {featuredServices.map((service) => (
                <div
                  key={service._id}
                  className="flex-shrink-0 w-64 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
                    {service.image ? (
                      <img
                        src={service.image.startsWith('/uploads/') ? `http://localhost:5000${service.image}` : service.image}
                        alt={service.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/256x144?text=Equipment';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-2xl text-gray-400">
                          {service.category === 'party' ? '🎉' :
                           service.category === 'wedding' ? '💒' :
                           service.category === 'corporate' ? '🏢' :
                           service.category === 'equipment' ? '🎪' :
                           service.category === 'birthday' ? '🎂' :
                           service.category === 'funeral' ? '⚰️' : '⚙️'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{service.name}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{service.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-500">Available:</span>
                        <span className={`text-lg font-bold ${(service.availableQuantity ?? service.quantity ?? 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {service.availableQuantity ?? service.quantity ?? 0}
                        </span>
                      </div>
                      <Link
                        href={`/customer/services`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}




    </div>
  );
}
