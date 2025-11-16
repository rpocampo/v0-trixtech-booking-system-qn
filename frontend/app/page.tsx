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
      <nav className="bg-white border-b border-[var(--border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-[var(--primary)]">TRIXTECH</div>
          <div className="flex gap-4">
            {!isLoggedIn ? (
              <>
                <Link href="/login" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
                  Login
                </Link>
                <Link href="/register" className="btn-primary">
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link href="/customer/dashboard" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    localStorage.clear();
                    setIsLoggedIn(false);
                    router.push('/');
                  }}
                  className="text-[var(--accent)] hover:text-[var(--primary)] transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">Welcome to TRIXTECH</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Your one-stop solution for events, supplies, and services. Book amazing services with ease.
          </p>
          <div className="flex gap-4 justify-center">
            {!isLoggedIn ? (
              <>
                <Link href="/register" className="bg-white text-[var(--primary)] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                  Get Started
                </Link>
                <Link href="/login" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-[var(--primary)] transition-colors">
                  Sign In
                </Link>
              </>
            ) : (
              <Link href="/customer/services" className="bg-white text-[var(--primary)] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Browse Services
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose TRIXTECH?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Easy Booking', desc: 'Quick and simple booking process' },
              { title: 'Wide Range', desc: 'Various services to choose from' },
              { title: 'Trusted Service', desc: 'Professional and reliable service providers' },
            ].map((feature, i) => (
              <div key={i} className="card p-6 text-center">
                <h3 className="text-xl font-semibold mb-3 text-[var(--primary)]">{feature.title}</h3>
                <p className="text-[var(--muted)]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--foreground)] text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 TRIXTECH. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
