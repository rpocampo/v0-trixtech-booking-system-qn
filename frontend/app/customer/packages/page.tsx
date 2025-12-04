'use client';

import { useState, useEffect } from 'react';

export default function PackagesPage() {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    // Fetch packages
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/packages');
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Available Packages</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg: any) => (
          <div key={pkg._id} className="card p-6">
            <h3 className="text-xl font-semibold mb-2">{pkg.name}</h3>
            <p className="text-gray-600 mb-4">{pkg.description}</p>
            <p className="text-2xl font-bold text-primary">₱{pkg.totalPrice}</p>
          </div>
        ))}
      </div>

      {packages.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No packages available at the moment.</p>
        </div>
      )}
    </div>
  );
}