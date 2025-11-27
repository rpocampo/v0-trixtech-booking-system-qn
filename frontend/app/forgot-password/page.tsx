'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Button from '../../components/Button';

export default function ForgotPassword() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to send reset email');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-pink-400/30 to-purple-600/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-indigo-600/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-lg w-full max-w-md p-8 relative z-10 shadow-2xl rounded-2xl border border-white/20">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-green-500 via-blue-500 to-purple-500 rounded-2xl mb-4 shadow-lg">
              <div className="text-white text-3xl">✓</div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Check Your Email</h1>
            <p className="text-gray-600 mt-2 font-medium">Password reset instructions sent</p>
          </div>

          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                We've sent password reset instructions to <strong>{email}</strong>.
                Please check your email and follow the link to reset your password.
              </p>
            </div>

            <p className="text-gray-600 text-sm">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => setSuccess(false)}
                className="text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors"
              >
                try again
              </button>
            </p>
          </div>

          {/* Back to Login Link */}
          <div className="mt-8 text-center">
            <Link href="/login" className="text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Reset Password</h1>
          <p className="text-gray-600 mt-2 font-medium">Enter your email to receive reset instructions</p>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="you@example.com"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              We'll send a password reset link to this email
            </p>
          </div>

          <div className="mt-6">
            <Button
              type="submit"
              loading={loading}
              size="lg"
              fullWidth
              icon={loading ? undefined : '📧'}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </div>
        </form>

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}