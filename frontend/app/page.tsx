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
      <nav className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-lg" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' }}>
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
                <Link href="/login" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-all duration-300 font-medium px-6 py-3 rounded-2xl hover:bg-white/60 backdrop-blur-sm">
                  Sign In
                </Link>
                <Link href="/register" className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-6 py-3 rounded-2xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300">
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link href="/customer/dashboard" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-all duration-300 font-medium px-6 py-3 rounded-2xl hover:bg-white/60 backdrop-blur-sm">
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    localStorage.clear();
                    setIsLoggedIn(false);
                    router.push('/');
                  }}
                  className="text-[var(--accent)] hover:text-[var(--primary)] transition-all duration-300 font-medium px-6 py-3 rounded-2xl hover:bg-white/60 backdrop-blur-sm"
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
        {/* Floating Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-subtle-float"></div>
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-white rounded-full blur-3xl animate-subtle-float" style={{ animationDelay: '5s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white rounded-full blur-3xl animate-subtle-float" style={{ animationDelay: '10s' }}></div>
        </div>

        {/* Additional Floating Icons */}
        <div className="absolute top-16 right-16 text-white/20 text-6xl animate-subtle-float" style={{ animationDelay: '2s' }}>⚡</div>
        <div className="absolute bottom-16 left-16 text-white/20 text-5xl animate-subtle-float" style={{ animationDelay: '7s' }}>🎯</div>
        <div className="absolute top-1/3 right-1/4 text-white/15 text-4xl animate-subtle-float" style={{ animationDelay: '12s' }}>🛡️</div>

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
                  <Link href="/register" className="bg-white/90 backdrop-blur-md text-[var(--primary)] px-10 py-4 rounded-3xl font-bold hover:bg-white hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/25 border border-white/20">
                    Sign Up Free
                  </Link>
                  <Link href="/login" className="border-2 border-white/80 text-white px-10 py-4 rounded-3xl font-bold hover:bg-white/10 hover:text-white hover:scale-105 transition-all duration-300 backdrop-blur-sm">
                    Sign In
                  </Link>
                </>
              ) : (
                <Link href="/customer/services" className="bg-white/90 backdrop-blur-md text-[var(--primary)] px-10 py-4 rounded-3xl font-bold hover:bg-white hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/25 border border-white/20">
                  Browse Services
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-50)]/20 to-[var(--accent-50)]/20"></div>

        {/* Floating Background Elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/10 rounded-full blur-xl animate-subtle-float"></div>
        <div className="absolute bottom-20 right-20 w-32 h-32 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--primary)]/10 rounded-full blur-xl animate-subtle-float" style={{ animationDelay: '8s' }}></div>

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
              <div
                key={i}
                className="group hover:scale-105 transition-all duration-500 animate-fade-in relative"
                style={{
                  animationDelay: `${i * 150}ms`,
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '24px',
                  boxShadow: '20px 20px 40px rgba(0, 0, 0, 0.1), -20px -20px 40px rgba(255, 255, 255, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
                  padding: '2rem',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Neumorphic highlight */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-4 text-[var(--primary)] group-hover:text-[var(--accent)] transition-colors relative z-10">{feature.title}</h3>
                <p className="text-[var(--muted)] text-lg leading-relaxed relative z-10">{feature.desc}</p>

                {/* Floating accent */}
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[var(--foreground)] to-gray-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>

        {/* Floating Elements in Footer */}
        <div className="absolute top-10 right-10 w-16 h-16 bg-white/5 rounded-full blur-lg animate-subtle-float"></div>
        <div className="absolute bottom-10 left-10 w-24 h-24 bg-[var(--primary)]/10 rounded-full blur-lg animate-subtle-float" style={{ animationDelay: '6s' }}></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="mb-12">
            <div className="text-5xl font-black text-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text mb-6">
              TRIXTECH
            </div>
            <p className="text-gray-300 text-xl max-w-3xl mx-auto leading-relaxed">
              Revolutionizing event management with cutting-edge technology and unparalleled service excellence.
            </p>
          </div>
          <div className="border-t border-gray-700/50 pt-12">
            <p className="text-gray-400 text-lg">&copy; 2025 TRIXTECH. All rights reserved. | Made with ❤️ for amazing events</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
