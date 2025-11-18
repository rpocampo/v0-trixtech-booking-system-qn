'use client';

import { useEffect, useState } from 'react';

interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  isAvailable: boolean;
  quantity?: number;
}

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'party',
    price: 0,
    duration: 60,
    quantity: 1,
    image: null as File | null,
  });
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [quantityValue, setQuantityValue] = useState(1);

  useEffect(() => {
    const fetchServices = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch('http://localhost:5000/api/services', {
          headers: { Authorization: `Bearer ${token}` },
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
      const formDataToSend = new FormData();

      // Add all form fields except image
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('price', formData.price.toString());
      formDataToSend.append('duration', formData.duration.toString());
      if (formData.quantity) {
        formDataToSend.append('quantity', formData.quantity.toString());
      }

      // Add image if exists
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      const response = await fetch('http://localhost:5000/api/services', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        setServices([...services, data.service]);
        setFormData({
          name: '',
          description: '',
          category: 'party',
          price: 0,
          duration: 60,
          quantity: 1,
          image: null,
        });
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to create service:', error);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/services/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setServices(services.filter((s) => s._id !== id));
      }
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
  };

  const updateQuantity = async (id: string, newQuantity: number) => {
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`http://localhost:5000/api/services/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (response.ok) {
        setServices(services.map((s) =>
          s._id === id ? { ...s, quantity: newQuantity } : s
        ));
        setEditingQuantity(null);
      }
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  if (loading) return <div>Loading services...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Manage Services</h1>
          <p className="text-[var(--muted)]">Create and manage your services</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Create New Service</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="input-field"
                  placeholder="e.g., Birthday Party Setup"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                >
                  <option value="party">Party</option>
                  <option value="wedding">Wedding</option>
                  <option value="corporate">Corporate</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price (₱)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  required
                  className="input-field"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  required
                  className="input-field"
                  min="15"
                  step="15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Quantity (for equipment)</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="input-field"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                className="input-field"
                rows={3}
                placeholder="Service description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Service Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                className="input-field"
              />
              <p className="text-xs text-[var(--muted)] mt-1">Upload an image for the service (optional)</p>
            </div>

            <button type="submit" className="btn-primary">
              Create Service
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {services.map((service) => (
          <div key={service._id} className="card p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{service.name}</h3>
                <p className="text-[var(--muted)] text-sm mt-1">{service.description}</p>
                <div className="flex gap-6 mt-4 text-sm">
                  <span>Category: <span className="font-semibold capitalize">{service.category}</span></span>
                  <span>Duration: <span className="font-semibold">{service.duration} min</span></span>
                  <span>Price: <span className="font-semibold text-[var(--primary)]">₱{service.price}</span></span>
                  {service.category === 'equipment' && (
                    <span className="flex items-center gap-2">
                      Quantity:
                      {editingQuantity === service._id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={quantityValue}
                            onChange={(e) => setQuantityValue(parseInt(e.target.value))}
                            className="w-16 px-2 py-1 text-sm border rounded"
                            min="0"
                          />
                          <button
                            onClick={() => updateQuantity(service._id, quantityValue)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingQuantity(null)}
                            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold text-green-600 flex items-center gap-2">
                          {service.quantity || 0}
                          <button
                            onClick={() => {
                              setEditingQuantity(service._id);
                              setQuantityValue(service.quantity || 1);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Edit
                          </button>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteService(service._id)}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
