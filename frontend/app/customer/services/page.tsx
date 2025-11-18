'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  quantity?: number;
  image?: string;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/services');
        const data = await response.json();
        if (data.success) {
          setServices(data.services);
        }
      } catch (error) {
        console.error('Failed to fetch services:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  if (loading) return <div>Loading services...</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-2">Our Services</h1>
      <p className="text-[var(--muted)] mb-8">Choose from our wide range of services</p>

      {services.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No services available at the moment</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service._id} className="card p-6 flex flex-col">
              {service.image && (
                <img
                  src={service.image.startsWith('/uploads/') ? `http://localhost:5000${service.image}` : service.image}
                  alt={service.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                  }}
                />
              )}
              <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
              <p className="text-[var(--muted)] text-sm mb-4">{service.description}</p>

              <div className="mt-auto space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)] text-sm">Duration:</span>
                  <span className="font-semibold">{service.duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)] text-sm">Category:</span>
                  <span className="font-semibold capitalize">{service.category}</span>
                </div>
                {service.category === 'equipment' && service.quantity && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)] text-sm">Available:</span>
                    <span className={`font-semibold ${service.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {service.quantity} {service.quantity === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                  <span className="font-semibold">Price:</span>
                  <span className="text-[var(--primary)] font-bold">₱{service.price}</span>
                </div>
              </div>

              <Link href={`/customer/booking/${service._id}`} className="btn-primary text-center">
                Book Now
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
