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

          <div className="flex gap-6 items-center">
            <Link href="/customer/dashboard" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Dashboard
            </Link>
            <Link href="/customer/services" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Services
            </Link>
            <Link href="/customer/bookings" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Bookings
            </Link>
            <Link href="/customer/profile" className="text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
              Profile
            </Link>
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/');
              }}
              className="text-[var(--accent)] hover:text-[var(--primary)] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
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
