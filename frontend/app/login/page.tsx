'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('userId', data.user.id);

      if (data.user.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--primary)] via-[var(--primary-light)] to-[var(--accent)] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      {/* Card */}
      <div className="card w-full max-w-md p-8 relative z-10 shadow-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] rounded-lg mb-4">
            <div className="text-white text-2xl font-bold">TT</div>
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">TRIXTECH</h1>
          <p className="text-[var(--muted)] mt-2">Booking & Reservation System</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="my-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-[var(--muted)]">Demo Credentials</span>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="space-y-3 mb-6">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-[var(--muted)] font-semibold">ADMIN</p>
            <p className="text-sm text-[var(--foreground)] font-mono">admin@trixtech.com</p>
            <p className="text-sm text-[var(--foreground)] font-mono">admin123</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-[var(--muted)] font-semibold">CUSTOMER</p>
            <p className="text-sm text-[var(--foreground)] font-mono">customer@trixtech.com</p>
            <p className="text-sm text-[var(--foreground)] font-mono">customer123</p>
          </div>
        </div>

        {/* Register Link */}
        <p className="text-center text-[var(--muted)] text-sm">
          Don't have an account?{' '}
          <Link href="/register" className="text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
