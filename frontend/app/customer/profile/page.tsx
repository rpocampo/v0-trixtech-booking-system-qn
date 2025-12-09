'use client';

import { useEffect, useState } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gcashQRCode?: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrUploading, setQrUploading] = useState(false);
  const [qrMessage, setQrMessage] = useState('');
  const [qrCodeData, setQrCodeData] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          setError('Your session has expired. Please log in again.');
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          setFormData({
            name: data.user.name || '',
            phone: data.user.phone || '',
            address: data.user.address || '',
          });
        } else {
          setError('Failed to load profile');
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${user?._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Profile updated successfully!');
        setUser(data.user);
      } else {
        setMessage('Failed to update profile');
      }
    } catch (error) {
      setMessage('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrUploading(true);
    setQrMessage('');

    try {
      const token = localStorage.getItem('token');
      const formDataUpload = new FormData();
      formDataUpload.append('qrCode', file);

      const response = await fetch(`http://localhost:5000/api/users/${user?._id}/gcash-qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataUpload,
      });

      const data = await response.json();

      if (response.ok) {
        setQrMessage('GCash QR code uploaded successfully!');
        setUser(data.user);
      } else {
        setQrMessage(data.message || 'Failed to upload QR code');
      }
    } catch (error) {
      setQrMessage('An error occurred while uploading');
    } finally {
      setQrUploading(false);
    }
  };

  const handleQRRemove = async () => {
    if (!confirm('Are you sure you want to remove your GCash QR code?')) return;

    setQrUploading(true);
    setQrMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${user?._id}/gcash-qr`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setQrMessage('GCash QR code removed successfully!');
        setUser(data.user);
        setQrCodeData('');
      } else {
        setQrMessage(data.message || 'Failed to remove QR code');
      }
    } catch (error) {
      setQrMessage('An error occurred while removing QR code');
    } finally {
      setQrUploading(false);
    }
  };

  const handleQRDataSubmit = async () => {
    if (!qrCodeData.trim()) {
      setQrMessage('Please enter your GCash QR code data');
      return;
    }

    setQrUploading(true);
    setQrMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${user?._id}/gcash-qr`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCodeUrl: qrCodeData.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setQrMessage('GCash QR code set successfully!');
        setUser(data.user);
      } else {
        setQrMessage(data.message || 'Failed to set QR code');
      }
    } catch (error) {
      setQrMessage('An error occurred while setting QR code');
    } finally {
      setQrUploading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div></div>;

  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">{error}</div></div>;

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="text-[var(--muted)]">No user data available</div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl sm:text-4xl font-bold mb-2">My Profile</h1>
      <p className="text-[var(--muted)] mb-6 sm:mb-8 text-sm sm:text-base">Update your personal information</p>

      <div className="card p-8">
        {message && (
          <div className={`mb-6 px-6 py-4 rounded-2xl border shadow-lg animate-slide-in ${
            message.includes('successfully')
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-800'
              : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                message.includes('successfully') ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {message.includes('successfully') ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <span className="font-medium">{message}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-4 text-base border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm transition-all duration-300 hover:shadow-md"
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-4 text-base border border-gray-200 rounded-2xl bg-gray-50/80 backdrop-blur-sm text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Email cannot be changed for security reasons
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-4 text-base border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm transition-all duration-300 hover:shadow-md"
                placeholder="+63 (555) 000-0000"
              />
            </div>

            <div className="space-y-2 md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-4 text-base border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm transition-all duration-300 hover:shadow-md resize-none"
                rows={4}
                placeholder="Enter your complete address"
              />
            </div>
          </div>

          {/* GCash QR Code Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">GCash QR Code</h3>
            <p className="text-sm text-[var(--muted)] mb-4">
              Set up your personal GCash QR code to receive payments directly. You can either paste your QR code data or upload an image.
            </p>

            {qrMessage && (
              <div className={`mb-4 px-4 py-2 rounded border ${qrMessage.includes('successfully') ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
                {qrMessage}
              </div>
            )}

            {user?.gcashQRCode ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-white rounded-lg border flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-green-800">GCash QR Code Active</p>
                      <p className="text-sm text-green-600">Your personal QR code will be used for payments</p>
                      {user.gcashQRCode.startsWith('000201') && (
                        <p className="text-xs text-green-700 mt-1">Using QR data string</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleQRRemove}
                    disabled={qrUploading}
                    className="btn-secondary bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                  >
                    Remove QR Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 21h.01M12 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-yellow-800">No GCash QR Code</p>
                      <p className="text-sm text-yellow-600">Set up your QR code to receive payments directly</p>
                    </div>
                  </div>
                </div>

                {/* Option 1: Paste QR Code Data */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800">Option 1: Paste QR Code Data</h4>
                  <p className="text-sm text-gray-600">
                    Open your GCash app → Profile → QR Code → Tap "Copy QR" to get your QR code data string.
                  </p>
                  <div className="space-y-2">
                    <textarea
                      value={qrCodeData}
                      onChange={(e) => setQrCodeData(e.target.value)}
                      placeholder="Paste your GCash QR code data here (starts with 000201...)"
                      className="input-field font-mono text-sm"
                      rows={3}
                    />
                    <button
                      onClick={handleQRDataSubmit}
                      disabled={qrUploading || !qrCodeData.trim()}
                      className="btn-primary"
                    >
                      {qrUploading ? 'Setting...' : 'Set QR Code Data'}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                {/* Option 2: Upload QR Code Image */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-800">Option 2: Upload QR Code Image</h4>
                  <p className="text-sm text-gray-600">
                    Take a screenshot of your GCash QR code and upload the image.
                  </p>
                  <label className="btn-secondary cursor-pointer inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQRUpload}
                      disabled={qrUploading}
                      className="hidden"
                    />
                    <span className="relative z-10">
                      {qrUploading ? 'Uploading...' : 'Upload QR Code Image'}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
