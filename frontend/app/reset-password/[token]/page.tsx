'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Button from '../../../components/Button';

export default function ResetPassword() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    // Verify token on page load
    const verifyToken = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/verify-reset-token/${token}`);

        if (response.ok) {
          setTokenValid(true);
        } else {
          setError('Invalid or expired reset link. Please request a new one.');
        }
      } catch (err) {
        setError('Failed to verify reset link. Please try again.');
      } finally {
        setVerifying(false);
      }
    };

    if (token) {
      verifyToken();
    }
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordErrors = validatePassword(formData.password);
    if (passwordErrors.length > 0) {
      setError(passwordErrors.join('. '));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to reset password');
        return;
      }

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?message=password-reset-success');
      }, 3000);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-lg w-full max-w-md p-8 rounded-2xl shadow-2xl border border-white/20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-400/30 to-purple-600/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-indigo-600/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-lg w-full max-w-md p-8 relative z-10 shadow-2xl rounded-2xl border border-white/20">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 rounded-2xl mb-4 shadow-lg">
              <div className="text-white text-3xl font-bold">⚠️</div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">Invalid Link</h1>
            <p className="text-gray-600 mt-2 font-medium">This password reset link is not valid</p>
          </div>

          <div className="text-center space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">
                {error || 'This link may have expired or already been used. Please request a new password reset.'}
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="mt-8 space-y-3">
            <Link
              href="/forgot-password"
              className="w-full block text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              Request New Reset Link
            </Link>
            <div className="text-center">
              <Link href="/login" className="text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors">
                ← Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-green-400/30 to-purple-600/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-indigo-600/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-lg w-full max-w-md p-8 relative z-10 shadow-2xl rounded-2xl border border-white/20">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-green-500 via-blue-500 to-purple-500 rounded-2xl mb-4 shadow-lg">
              <div className="text-white text-3xl">✓</div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Password Reset!</h1>
            <p className="text-gray-600 mt-2 font-medium">Your password has been successfully updated</p>
          </div>

          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
            </div>

            <p className="text-gray-600 text-sm">
              Redirecting to login page in a few seconds...
            </p>
          </div>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="w-full block text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              Continue to Login
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
            <div className="text-white text-3xl font-bold">🔑</div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">New Password</h1>
          <p className="text-gray-600 mt-2 font-medium">Enter your new password below</p>
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
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">New Password</label>
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

          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="input-field pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Password Requirements:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className={formData.password.length >= 8 ? 'text-green-600' : ''}>• At least 8 characters</li>
              <li className={/(?=.*[a-z])/.test(formData.password) ? 'text-green-600' : ''}>• One lowercase letter</li>
              <li className={/(?=.*[A-Z])/.test(formData.password) ? 'text-green-600' : ''}>• One uppercase letter</li>
              <li className={/(?=.*\d)/.test(formData.password) ? 'text-green-600' : ''}>• One number</li>
              <li className={formData.password === formData.confirmPassword && formData.password ? 'text-green-600' : ''}>• Passwords match</li>
            </ul>
          </div>

          <div className="mt-6">
            <Button
              type="submit"
              loading={loading}
              size="lg"
              fullWidth
              icon={loading ? undefined : '🔑'}
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
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