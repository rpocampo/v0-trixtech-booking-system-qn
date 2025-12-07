'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroImages = [
    'Birthday.jpg',
    'Corporate.jpg',
    'Wedding.jpg'
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    setIsLoggedIn(!!token);

    if (token && role === 'admin') {
      router.push('/admin/dashboard');
    }
  }, [router]);

  // Auto-play carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, [heroImages.length]);

  const goToPrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  const goToNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroImages.length);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={isLoggedIn ? (localStorage.getItem('role') === 'admin' ? '/admin/dashboard' : '/customer/dashboard') : '/'}
            className="flex items-center hover:opacity-80 transition-opacity duration-200"
          >
            <img
              src="/logo.png"
              alt="TRIXTECH"
              className="h-12 w-12"
            />
            <span className="text-2xl font-bold text-blue-600 ml-2">TRIXTECH</span>
          </Link>
          <div className="flex gap-6 items-center">
            {!isLoggedIn ? (
              <>
                <Link href="/login" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                  Sign In
                </Link>
                <Link href="/register" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200">
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link href="/customer/dashboard" className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium">
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    localStorage.clear();
                    setIsLoggedIn(false);
                    router.push('/');
                  }}
                  className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Carousel */}
      <section className="relative text-white overflow-hidden h-[600px] w-full max-w-[1920px] mx-auto">
        {/* Carousel */}
        <div className="relative h-full">
          {heroImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={image}
                alt={`Hero image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient if image fails to load
                  const img = e.currentTarget as HTMLImageElement;
                  const fallback = img.nextElementSibling as HTMLDivElement;
                  if (img && fallback) {
                    img.style.display = 'none';
                    fallback.style.display = 'block';
                  }
                }}
              />
              {/* Fallback gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 hidden"></div>
            </div>
          ))}

          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* Content Overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight text-white drop-shadow-lg">
                Premium Equipment for Every Event
              </h1>
              <p className="text-xl lg:text-2xl text-white/90 mb-8 leading-relaxed max-w-3xl mx-auto drop-shadow-md">
                Transform your events with our curated collection of professional-grade equipment.
                From sound systems to lighting, we deliver excellence you can trust.
              </p>

              {/* CTA Button */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => router.push(isLoggedIn ? '/customer/services' : '/register')}
                  className="bg-white text-blue-600 hover:bg-gray-50 font-bold px-8 py-4 text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 rounded-xl"
                >
                  Reserve Now
                </button>
                {!isLoggedIn && (
                  <Link href="/login" className="text-white/90 hover:text-white transition-colors duration-200 font-semibold text-lg drop-shadow-md">
                    Already have an account? Sign In →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <button
          onClick={goToPrevSlide}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-all duration-300 backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToNextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-all duration-300 backdrop-blur-sm"
          aria-label="Next slide"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Scroll Indicator */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 animate-bounce z-20">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/70 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* System Description */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              Professional Event Equipment Made Simple
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-12">
              TRIXTECH revolutionizes event planning by providing seamless access to premium equipment rentals.
              Our intelligent platform connects event organizers with verified suppliers, ensuring reliable delivery
              and exceptional quality for every occasion.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Lightning Fast</h3>
                <p className="text-gray-600">Book and confirm equipment in minutes with our streamlined process</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Quality Assured</h3>
                <p className="text-gray-600">Every piece of equipment is inspected and maintained to perfection</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Expert Support</h3>
                <p className="text-gray-600">Our team of event specialists is here to help every step of the way</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold text-white mb-4">
                TRIXTECH
              </h3>
              <p className="text-gray-300 text-base leading-relaxed mb-6">
                Your trusted partner for exceptional event experiences. We provide high-quality equipment rental services
                for weddings, corporate events, concerts, and special occasions.
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">T</span>
                </div>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">R</span>
                </div>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">X</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-white text-lg">Quick Links</h4>
              <ul className="space-y-3 text-gray-300">
                <li><Link href="/customer/services" className="hover:text-white transition-colors duration-200">Browse Equipment</Link></li>
                <li><Link href="/customer/bookings" className="hover:text-white transition-colors duration-200">My Reservations</Link></li>
                <li><Link href="/customer/profile" className="hover:text-white transition-colors duration-200">Profile</Link></li>
                <li><Link href="/customer/packages" className="hover:text-white transition-colors duration-200">Packages</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-white text-lg">Support</h4>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  09127607860
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  support@trixtech.com
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm mb-4 md:mb-0">
                &copy; 2025 TRIXTECH. All rights reserved.
              </p>
              <div className="flex space-x-6 text-sm text-gray-400">
                <button className="hover:text-white transition-colors duration-200">Privacy Policy</button>
                <button className="hover:text-white transition-colors duration-200">Terms of Service</button>
                <button className="hover:text-white transition-colors duration-200">Contact Us</button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
