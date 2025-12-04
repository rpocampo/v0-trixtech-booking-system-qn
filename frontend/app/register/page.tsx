'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import OTPInput from '../../components/OTPInput';

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState<'register' | 'verify'>('register');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // First, send OTP for email verification
      const otpResponse = await fetch('http://localhost:5000/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          purpose: 'account_creation',
          metadata: {
            name: formData.name,
            password: formData.password, // Will be hashed on server
          },
        }),
      });

      const otpData = await otpResponse.json();

      if (!otpResponse.ok) {
        setError(otpData.message || 'Failed to send verification code');
        return;
      }

      // Move to verification step
      setCurrentStep('verify');
      startResendCountdown();

    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setOtpError('');
    setOtpLoading(true);

    try {
      // Verify OTP
      const verifyResponse = await fetch('http://localhost:5000/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          otp,
          purpose: 'account_creation',
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setOtpError(verifyData.message || 'Invalid verification code');
        return;
      }

      // OTP verified, now complete registration
      const registerResponse = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          emailVerified: true, // Mark email as verified
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setOtpError(registerData.message || 'Registration failed');
        return;
      }

      // Registration successful
      localStorage.setItem('token', registerData.token);
      localStorage.setItem('role', registerData.user.role);
      localStorage.setItem('userId', registerData.user.id);
      localStorage.setItem('trixtech_user', JSON.stringify(registerData.user));
      router.push('/customer/dashboard');

    } catch (err) {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendDisabled) return;

    setOtpError('');
    setResendDisabled(true);

    try {
      const response = await fetch('http://localhost:5000/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          purpose: 'account_creation',
          metadata: {
            name: formData.name,
            password: formData.password,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOtpError(data.message || 'Failed to resend verification code');
        setResendDisabled(false);
        return;
      }

      startResendCountdown();

    } catch (err) {
      setOtpError('Failed to resend code. Please try again.');
      setResendDisabled(false);
    }
  };

  const startResendCountdown = () => {
    setResendDisabled(true);
    setResendCountdown(60); // 60 seconds countdown

    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-teal-600 to-blue-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-blue-600/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-green-400/30 to-teal-600/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full blur-2xl animate-bounce"></div>
      </div>
      <div className="bg-white/80 backdrop-blur-2xl w-full max-w-md p-8 relative z-10 shadow-2xl rounded-2xl border border-white/30">
        <h1 className="text-3xl font-bold text-center mb-2 text-[var(--primary)]">TRIXTECH</h1>
        <p className="text-center text-[var(--muted)] mb-6">
          {currentStep === 'register' ? 'Create your account' : 'Verify your email'}
        </p>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

        {currentStep === 'register' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Full Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
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
            <label className="block text-sm font-medium mb-2">Confirm Password</label>
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

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Sending verification code...
                  </div>
                ) : (
                  'Send Verification Code 📧'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-800 text-sm">
                  We've sent a 6-digit verification code to <strong>{formData.email}</strong>.
                  Please check your email and enter the code below.
                </p>
              </div>

              <OTPInput
                onComplete={handleOTPComplete}
                error={otpError}
                loading={otpLoading}
              />

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleResendOTP}
                  disabled={resendDisabled || otpLoading}
                  className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {resendDisabled
                    ? `Resend code in ${resendCountdown}s`
                    : 'Resend verification code'
                  }
                </button>

                <button
                  onClick={() => setCurrentStep('register')}
                  disabled={otpLoading}
                  className="w-full bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Back to registration
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
