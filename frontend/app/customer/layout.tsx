'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'customer') {
      router.push('/login');
      return;
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-[var(--border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-[var(--primary)]">
            TRIXTECH
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-6 items-center">
            <Link href="/customer/dashboard" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Dashboard
            </Link>
            <Link href="/customer/services" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Services
            </Link>
            <Link href="/customer/bookings" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Bookings
            </Link>

            {/* User Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
              >
                <span>👤</span>
                <svg className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-[var(--border)] z-50">
                  <div className="py-1">
                    <Link
                      href="/customer/profile"
                      className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-gray-100 hover:text-[var(--primary)] transition-colors"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        router.push('/');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--accent)] hover:bg-gray-100 hover:text-[var(--primary)] transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-[var(--border)]">
            <div className="px-4 py-2 space-y-2">
              <Link
                href="/customer/dashboard"
                className="block px-3 py-2 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-gray-50 rounded transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/customer/services"
                className="block px-3 py-2 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-gray-50 rounded transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Services
              </Link>
              <Link
                href="/customer/bookings"
                className="block px-3 py-2 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-gray-50 rounded transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Bookings
              </Link>
              <div className="border-t border-gray-200 my-2"></div>
              <Link
                href="/customer/profile"
                className="block px-3 py-2 text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-gray-50 rounded transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  localStorage.clear();
                  router.push('/');
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-[var(--accent)] hover:text-[var(--primary)] hover:bg-gray-50 rounded transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {/* Footer */}
      <footer className="bg-[var(--foreground)] text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 TRIXTECH. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
