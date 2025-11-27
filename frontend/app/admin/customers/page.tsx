'use client';

import { useEffect, useState } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  createdAt: string;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch('http://localhost:5000/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success) {
          setCustomers(data.users.filter((u: User) => u.role === 'customer'));
        }
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (loading) return <div>Loading customers...</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Manage Customers</h1>
      <p className="text-[var(--muted)] mb-8">View and manage customer accounts</p>

      <div className="space-y-4">
        {customers.map((customer) => (
          <div key={customer._id} className="card p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold text-lg">{customer.name}</h3>
                <p className="text-[var(--muted)] text-sm">{customer.email}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-sm">Phone</p>
                <p className="font-semibold">{customer.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-sm">Joined</p>
                <p className="font-semibold">{new Date(customer.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            {customer.address && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <p className="text-[var(--muted)] text-sm">Address</p>
                <p className="font-semibold">{customer.address}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {customers.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No customers yet</p>
        </div>
      )}
    </div>
  );
}
