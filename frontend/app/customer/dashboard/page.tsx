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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());

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

          // Check if user is within serviceable area (within 30km of Balayan, Batangas)
          // Business location coordinates (Balayan, Batangas, Philippines)
          const businessLat = 13.9371;
          const businessLng = 120.7330;

          const distance = calculateDistance(latitude, longitude, businessLat, businessLng);
          const maxDistance = 100; // 100km radius

          if (distance > maxDistance) {
            setLocationRestricted(true);
            setLocationError(`Delivery is only available within 100km from Balayan, Batangas. Distance: ${distance.toFixed(1)}km`);
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
    // Store selected date and redirect to equipment browsing
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    localStorage.setItem('selectedReservationDate', dateStr);
    router.push(`/customer/services?date=${dateStr}`);
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

  // Fetch booked dates for the current month
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1; // JS months are 0-indexed

        const response = await fetch(`http://localhost:5000/api/bookings/calendar?year=${year}&month=${month}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Create a set of booked date strings (YYYY-MM-DD format)
            const booked = new Set<string>();
            data.bookedDates.forEach((dateStr: string) => {
              booked.add(dateStr);
            });
            setBookedDates(booked);
          }
        }
      } catch (error) {
        console.error('Failed to fetch booked dates:', error);
      }
    };

    fetchBookedDates();
  }, [currentMonth]);

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
      <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-3xl p-8 shadow-xl">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Select Reservation Date
            </h2>
            <p className="text-gray-600 mt-2 text-lg">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigateMonth('prev')}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 font-semibold text-gray-700 hover:text-blue-600 transition-all duration-200 hover:shadow-md active:scale-95"
              aria-label="Previous month"
            >
              ← Previous
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 font-semibold text-gray-700 hover:text-blue-600 transition-all duration-200 hover:shadow-md active:scale-95"
              aria-label="Next month"
            >
              Next →
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
            const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const isBooked = bookedDates.has(dateStr);

            return (
              <button
                  key={index}
                  onClick={() => !isPastDate && handleDateClick(date)}
                  disabled={isPastDate}
                  className={`p-3 text-sm border rounded-lg transition-colors min-h-[60px] ${
                    isPastDate
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                      : isCurrentMonth
                        ? isToday
                          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-blue-300'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <div className="text-right mb-1">{date.getDate()}</div>
                  {!isPastDate && (
                    <div className="text-xs">
                      {isBooked ? (
                        <div className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-center">
                          Busy
                        </div>
                      ) : (
                        <div className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-center">
                          Available
                        </div>
                      )}
                    </div>
                  )}
                </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 shadow-sm">
            <div className="w-3 h-3 bg-gradient-to-r from-green-100 to-green-50 border border-green-200 rounded-full"></div>
            <span className="text-gray-700 font-medium">Available</span>
          </div>
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 shadow-sm">
            <div className="w-3 h-3 bg-gradient-to-r from-red-100 to-red-50 border border-red-200 rounded-full"></div>
            <span className="text-gray-700 font-medium">Busy</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200/50 rounded-2xl shadow-sm">
          <div className="flex items-center justify-center gap-3">
            <div className="text-2xl">📅</div>
            <p className="text-blue-800 text-center font-medium">
              Click on an available date to browse equipment for that day
            </p>
          </div>
        </div>

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
          fetch('http://localhost:5000/api/services?limit=9&sortBy=name&sortOrder=asc', {
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
          const transformedServices = servicesData.services.slice(0, 9).map((service: any) => ({
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

      {/* Calendar Section */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8 overflow-hidden">
        {renderCalendar()}
      </div>

      {/* Location Restriction Warning */}
      {locationRestricted && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-2xl p-6 mb-8 shadow-lg animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-red-900 mb-2 text-lg">Service Unavailable</h3>
              <p className="text-red-700 font-medium">{locationError}</p>
            </div>
          </div>
        </div>
      )}




      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {locationRestricted ? (
          <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 opacity-60 cursor-not-allowed shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-400">Browse Equipment</h3>
                <p className="text-gray-400 text-sm">Service not available in your area</p>
              </div>
            </div>
          </div>
        ) : (
          <Link href="/customer/services" className="group bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Browse Equipment</h3>
                <p className="text-gray-600 text-sm">Find and rent premium equipment for your events</p>
              </div>
            </div>
          </Link>
        )}

        <Link href="/customer/bookings" className="group bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-cyan-300 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors">My Reservations</h3>
              <p className="text-gray-600 text-sm">View and manage your bookings</p>
            </div>
          </div>
        </Link>

        <Link href="/customer/profile" className="group bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-purple-300 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">Profile</h3>
              <p className="text-gray-600 text-sm">Update your account information</p>
            </div>
          </div>
        </Link>
      </div>





    </div>
  );
}
