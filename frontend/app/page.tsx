'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    setIsLoggedIn(!!token);

    if (token && role === 'admin') {
      router.push('/admin/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={isLoggedIn ? (localStorage.getItem('role') === 'admin' ? '/admin/dashboard' : '/customer/dashboard') : '/'}
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.png"
              alt="TRIXTECH"
              className="h-12 w-12"
            />
            <span className="text-2xl font-bold text-blue-600 ml-2">TRIXTECH</span>
          </Link>
          <div className="flex gap-8 items-center">
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

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-blue-800 text-white py-24 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Find the Perfect Equipment for Your Event
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
              Discover and book premium event equipment with ease. From sound systems to lighting, we have everything you need.
            </p>
          </div>


          {/* Quick Actions */}
          <div className="text-center mt-8">
            {!isLoggedIn ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors duration-200">
                  Get Started
                </Link>
                <Link href="/login" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors duration-200">
                  Sign In
                </Link>
              </div>
            ) : (
              <Link href="/customer/services" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors duration-200">
                Browse Equipment
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose TRIXTECH?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Experience the difference with our cutting-edge platform designed for modern event management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '⚡',
                title: 'Lightning Fast Booking',
                desc: 'Book equipment in under 2 minutes with our streamlined process and smart recommendations'
              },
              {
                icon: '🎯',
                title: 'Curated Excellence',
                desc: 'Access premium equipment from verified suppliers and trusted partners worldwide'
              },
              {
                icon: '🛡️',
                title: 'Secure & Reliable',
                desc: 'Bank-level security with 99.9% uptime and guaranteed equipment delivery'
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 p-8 text-center border border-gray-200"
              >
                <div className="text-5xl mb-6 text-blue-600">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="text-xl font-bold text-white mb-4">
                TRIXTECH
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Your trusted partner for exceptional event experiences. We provide high-quality equipment rental services for all your special occasions.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Quick Links</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><Link href="/customer/services" className="hover:text-white transition-colors">Browse Equipment</Link></li>
                <li><Link href="/customer/bookings" className="hover:text-white transition-colors">My Reservations</Link></li>
                <li><Link href="/customer/profile" className="hover:text-white transition-colors">Profile</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Support</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>Contact: 09127607860</li>
                <li><button className="hover:text-white transition-colors">Privacy Policy</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              &copy; 2025 TRIXTECH. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
