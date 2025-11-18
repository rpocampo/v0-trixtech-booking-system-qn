'use client';

import { useEffect, useState } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
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
        const data = await response.json();
        if (data.success) {
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

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div></div>;

  if (error) return <div className="flex items-center justify-center min-h-screen"><div className="text-red-500">{error}</div></div>;

  if (!user) return <div className="flex items-center justify-center min-h-screen"><div className="text-[var(--muted)]">No user data available</div></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">My Profile</h1>
      <p className="text-[var(--muted)] mb-8">Update your personal information</p>

      <div className="card p-8">
        {message && (
          <div className={`mb-4 px-4 py-2 rounded border ${message.includes('successfully') ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" value={user.email} disabled className="input-field bg-gray-100" />
            <p className="text-xs text-[var(--muted)] mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-field"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Your address"
            />
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
