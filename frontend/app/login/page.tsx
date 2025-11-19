'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Button from '../../components/Button';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-pink-400/30 to-purple-600/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-indigo-600/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full blur-2xl animate-bounce"></div>
      </div>

      {/* Card */}
      <div className="bg-white/95 backdrop-blur-lg w-full max-w-md p-8 relative z-10 shadow-2xl rounded-2xl border border-white/20">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-2xl mb-4 shadow-lg transform hover:scale-105 transition-transform duration-300">
            <div className="text-white text-3xl font-bold animate-pulse">TT</div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">TRIXTECH</h1>
          <p className="text-gray-600 mt-2 font-medium">Premium Booking & Reservation System</p>
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="input-field pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors font-medium">
              Forgot Password?
            </Link>
          </div>

          <div className="mt-6">
            <Button
              type="submit"
              loading={loading}
              size="lg"
              fullWidth
              icon={loading ? undefined : '✨'}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>


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
