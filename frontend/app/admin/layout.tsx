'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

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
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--foreground)] text-white p-6 sticky top-0 h-screen overflow-y-auto">
        <Link href="/" className="text-2xl font-bold mb-8 block">
          TRIXTECH Admin
        </Link>

        <nav className="space-y-4">
          <Link href="/admin/dashboard" className="block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/services" className="block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors">
            Services
          </Link>
          <Link href="/admin/bookings" className="block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors">
            Bookings
          </Link>
          <Link href="/admin/customers" className="block px-4 py-2 rounded hover:bg-[var(--primary)] transition-colors">
            Customers
          </Link>
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/');
            }}
            className="w-full text-left px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
