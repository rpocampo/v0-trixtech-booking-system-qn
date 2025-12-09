'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to home after 10 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-yellow-400/10 to-orange-500/10 rounded-full blur-2xl animate-bounce"></div>
      </div>

      {/* Card */}
      <div className="bg-white/95 backdrop-blur-lg w-full max-w-md p-8 relative z-10 shadow-2xl rounded-2xl border border-white/20 text-center">
        {/* Icon */}
        <div className="mb-6">
          <div className="inline-block p-6 bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 rounded-3xl shadow-lg">
            <div className="text-white text-6xl">😵</div>
          </div>
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-4">
          Oops! Page Not Found
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          Don't worry, we'll get you back on track!
        </p>

        <div className="space-y-4">
          <Link
            href="/"
            className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-2xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
          >
            🏠 Go Home
          </Link>

          <button
            onClick={() => router.back()}
            className="block w-full border-2 border-purple-600 text-purple-600 px-6 py-3 rounded-2xl font-semibold hover:bg-purple-600 hover:text-white transition-all duration-300"
          >
            ← Go Back
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Auto-redirecting to home in 10 seconds...
        </p>
      </div>
    </div>
  );
}