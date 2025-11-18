'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import NotificationBell from '../../components/NotificationBell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'admin') {
      router.push('/login');
      return;
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-[var(--foreground)] text-white p-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          TRIXTECH Admin
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell variant="dark" position="sidebar" />
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md hover:bg-[var(--primary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[var(--foreground)] text-white border-t border-gray-700">
          <nav className="px-4 py-2 space-y-2">
            <Link
              href="/admin/dashboard"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/services"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href="/admin/bookings"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Bookings
            </Link>
            <Link
              href="/admin/customers"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Customers
            </Link>
            <Link
              href="/admin/reports"
              className="block px-3 py-2 rounded hover:bg-[var(--primary)] transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Reports
            </Link>
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/');
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden md:block bg-[var(--foreground)] text-white sticky top-0 h-screen overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && (
              <Link href="/" className="text-2xl font-bold">
                TRIXTECH Admin
              </Link>
            )}
            <div className="flex items-center gap-2">
              <NotificationBell variant="dark" position="sidebar" />
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 rounded hover:bg-[var(--primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
                </svg>
              </button>
            </div>
          </div>

          <nav className="space-y-4">
            <Link href="/admin/dashboard" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '🏠' : 'Dashboard'}
            </Link>
            <Link href="/admin/services" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '⚙️' : 'Services'}
            </Link>
            <Link href="/admin/bookings" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '📅' : 'Bookings'}
            </Link>
            <Link href="/admin/customers" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '👥' : 'Customers'}
            </Link>
            <Link href="/admin/reports" className={`block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}>
              {isSidebarCollapsed ? '📊' : 'Reports'}
            </Link>
            <button
              onClick={() => {
                localStorage.clear();
                router.push('/');
              }}
              className={`w-full text-left px-4 py-2 rounded hover:bg-red-600 transition-colors ${isSidebarCollapsed ? 'px-2 text-center' : ''}`}
            >
              {isSidebarCollapsed ? '🚪' : 'Logout'}
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
