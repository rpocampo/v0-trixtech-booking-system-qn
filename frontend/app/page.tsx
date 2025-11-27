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
      <nav className="bg-white/95 backdrop-blur-lg border-b border-[var(--border)] sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <Link
            href={isLoggedIn ? (localStorage.getItem('role') === 'admin' ? '/admin/dashboard' : '/customer/dashboard') : '/'}
            className="text-3xl font-black text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text hover:scale-105 transition-transform duration-200"
          >
            TRIXTECH
          </Link>
          <div className="flex gap-6 items-center">
            {!isLoggedIn ? (
              <>
                <Link href="/login" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-all duration-300 font-medium px-4 py-2 rounded-lg hover:bg-[var(--primary-50)]">
                  Sign In
                </Link>
                <Link href="/register" className="btn-primary">
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link href="/customer/dashboard" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-all duration-300 font-medium px-4 py-2 rounded-lg hover:bg-[var(--primary-50)]">
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    localStorage.clear();
                    setIsLoggedIn(false);
                    router.push('/');
                  }}
                  className="text-[var(--accent)] hover:text-[var(--primary)] transition-all duration-300 font-medium px-4 py-2 rounded-lg hover:bg-[var(--accent-50)]"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 bg-gradient-to-br from-[var(--primary)] via-[var(--primary-light)] to-[var(--accent)] text-white py-32 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="animate-fade-in">
            <h1 className="text-6xl lg:text-7xl font-black mb-8 leading-tight">
              Welcome to <span className="text-transparent bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text">TRIXTECH</span>
            </h1>
            <p className="text-xl lg:text-2xl mb-12 max-w-3xl mx-auto leading-relaxed opacity-90">
              Your one-stop solution for events, supplies, and services. Book amazing services with ease and experience the future of event management.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              {!isLoggedIn ? (
                <>
                  <Link href="/register" className="bg-white text-[var(--primary)] px-10 py-4 rounded-2xl font-bold hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/25">
                    Sign Up Free
                  </Link>
                  <Link href="/login" className="border-3 border-white text-white px-10 py-4 rounded-2xl font-bold hover:bg-white hover:text-[var(--primary)] hover:scale-105 transition-all duration-300 backdrop-blur-sm">
                    Sign In
                  </Link>
                </>
              ) : (
                <Link href="/customer/services" className="bg-white text-[var(--primary)] px-10 py-4 rounded-2xl font-bold hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/25">
                  Browse Services
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-gradient-to-b from-gray-50 to-white relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-50)]/30 to-[var(--accent-50)]/30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black text-[var(--foreground)] mb-6">
              Why Choose <span className="text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text">TRIXTECH</span>?
            </h2>
            <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto">
              Experience the difference with our cutting-edge platform designed for modern event management
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                icon: '⚡',
                title: 'Lightning Fast Booking',
                desc: 'Book services in under 2 minutes with our streamlined process and smart recommendations'
              },
              {
                icon: '🎯',
                title: 'Curated Excellence',
                desc: 'Access premium services from verified professionals and trusted partners worldwide'
              },
              {
                icon: '🛡️',
                title: 'Secure & Reliable',
                desc: 'Bank-level security with 99.9% uptime and guaranteed service delivery'
              },
            ].map((feature, i) => (
              <div key={i} className="card p-8 text-center group hover:scale-105 transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-4 text-[var(--primary)] group-hover:text-[var(--accent)] transition-colors">{feature.title}</h3>
                <p className="text-[var(--muted)] text-lg leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[var(--foreground)] to-gray-900 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="mb-8">
            <div className="text-4xl font-black text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text mb-4">
              TRIXTECH
            </div>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Revolutionizing event management with cutting-edge technology and unparalleled service excellence.
            </p>
          </div>
          <div className="border-t border-gray-700 pt-8">
            <p className="text-gray-400">&copy; 2025 TRIXTECH. All rights reserved. | Made with ❤️ for amazing events</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
