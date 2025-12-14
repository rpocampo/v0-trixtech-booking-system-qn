'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import OTPInput from '../../components/OTPInput';
import Button from '../../components/Button';

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
    <div className="min-h-screen bg-gradient-to-br from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Enhanced Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-[var(--success)]/20 to-[var(--primary)]/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-[var(--warning)]/15 to-[var(--accent)]/15 rounded-full blur-2xl animate-glow"></div>
      </div>

      <div className="card w-full max-w-md sm:max-w-lg lg:max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold mb-3 text-gradient-primary">TRIXTECH</h1>
          <p className="text-[var(--muted)] text-lg">
            {currentStep === 'register' ? 'Create your account' : 'Verify your email'}
          </p>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

        {currentStep === 'register' ? (
          <form onSubmit={handleSubmit} className="space-y-6 stagger-children">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="input-field pr-12"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] hover:text-[var(--primary)] transition-all duration-200 p-1 rounded-md hover:bg-[var(--primary)]/10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="input-field pr-12"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted)] hover:text-[var(--primary)] transition-all duration-200 p-1 rounded-md hover:bg-[var(--primary)]/10"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                loading={loading}
                fullWidth
                size="lg"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>}
              >
                {loading ? 'Sending verification code...' : 'Send Verification Code'}
              </Button>
            </div>

            <div className="text-center pt-4">
              <p className="text-[var(--muted)]">
                Already have an account?{' '}
                <Link href="/login" className="text-[var(--primary)] hover:text-[var(--primary-dark)] font-semibold transition-all duration-200 hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>
          </form>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[var(--foreground)] text-sm leading-relaxed">
                  We've sent a 6-digit verification code to <strong className="text-[var(--primary)]">{formData.email}</strong>.
                  Please check your email and enter the code below.
                </p>
              </div>

              <OTPInput
                onComplete={handleOTPComplete}
                error={otpError}
                loading={otpLoading}
              />

              <div className="mt-8 space-y-4">
                <Button
                  onClick={handleResendOTP}
                  disabled={resendDisabled || otpLoading}
                  fullWidth
                  variant="outline"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>}
                >
                  {resendDisabled
                    ? `Resend code in ${resendCountdown}s`
                    : 'Resend verification code'
                  }
                </Button>

                <Button
                  onClick={() => setCurrentStep('register')}
                  disabled={otpLoading}
                  fullWidth
                  variant="ghost"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>}
                  iconPosition="left"
                >
                  Back to registration
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
