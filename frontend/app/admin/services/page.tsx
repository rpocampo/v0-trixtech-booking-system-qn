/**
 * SERVICES MODULE
 *
 * VIEWER OF INVENTORY AVAILABILITY
 * ================================
 *
 * ROLE: Acts as a viewer of inventory availability
 * - Displays real-time stock availability pulled from the Inventory module
 * - Must be read-only regarding stock quantities (no editing or modifications allowed)
 * - Ensures users only see available stock without altering inventory data
 * - Handles service definitions, descriptions, pricing, and configurations
 * - Shows current stock status with visual indicators (In Stock/Low Stock/Out of Stock)
 * - Directs administrators to Inventory module for stock management
 *
 * RESTRICTIONS: This module has NO authority over stock quantity modifications
 * - Stock data is READ-ONLY - cannot edit, update, or modify quantities
 * - All stock changes MUST be made through the Inventory module
 * - Maintains clear boundary between service configuration and inventory control
 * - Prevents data conflicts by enforcing read-only access to stock data
 */

'use client';

import { useEffect, useState } from 'react';

interface Service {
  _id: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  serviceType: string;
  eventTypes?: string[];
  price: number;
  priceType: string;
  duration?: number;
  quantity?: number;
  location?: string;
  tags?: string[];
  features?: string[];
  includedItems?: string[];
  requirements?: string[];
  isAvailable: boolean;
  minOrder?: number;
  maxOrder?: number;
  leadTime?: number;
}

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortDescription: '',
    category: 'event-planning',
    serviceType: 'service',
    eventTypes: [] as string[],
    price: 0,
    priceType: 'flat-rate',
    duration: 60,
    quantity: 1,
    location: 'both',
    tags: [] as string[],
    features: [] as string[],
    includedItems: [] as string[],
    requirements: [] as string[],
    minOrder: 1,
    maxOrder: 0,
    leadTime: 24,
    image: null as File | null,
    gallery: [] as File[],
  });

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

      // Add all form fields
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('shortDescription', formData.shortDescription);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('serviceType', formData.serviceType);
      formData.eventTypes.forEach(type => formDataToSend.append('eventTypes', type));
      formDataToSend.append('price', formData.price.toString());
      formDataToSend.append('priceType', formData.priceType);
      formDataToSend.append('location', formData.location);
      formData.tags.forEach(tag => formDataToSend.append('tags', tag));
      formData.features.forEach(feature => formDataToSend.append('features', feature));
      formData.includedItems.forEach(item => formDataToSend.append('includedItems', item));
      formData.requirements.forEach(req => formDataToSend.append('requirements', req));
      formDataToSend.append('minOrder', formData.minOrder.toString());
      formDataToSend.append('leadTime', formData.leadTime.toString());

      if (formData.serviceType === 'service' && formData.duration) {
        formDataToSend.append('duration', formData.duration.toString());
      }

      if ((formData.serviceType === 'equipment' || formData.serviceType === 'supply')) {
        // Quantity is managed in Inventory module, set to 0 initially
        formDataToSend.append('quantity', '0');
        if (formData.maxOrder > 0) {
          formDataToSend.append('maxOrder', formData.maxOrder.toString());
        }
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
          shortDescription: '',
          category: 'event-planning',
          serviceType: 'service',
          eventTypes: [],
          price: 0,
          priceType: 'flat-rate',
          duration: 60,
          quantity: 1,
          location: 'both',
          tags: [],
          features: [],
          includedItems: [],
          requirements: [],
          minOrder: 1,
          maxOrder: 0,
          leadTime: 24,
          image: null,
          gallery: [],
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


  if (loading) return <div>Loading services...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Manage Services</h1>
          <p className="text-[var(--muted)]">Create and manage your services</p>
          <p className="text-xs text-blue-600 mt-1">
            💡 Stock quantities are managed in the <a href="/admin/inventory" className="underline hover:text-blue-800">Inventory</a> module
          </p>
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="input-field"
                  placeholder="e.g., Professional Event Planning Service"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Service Type</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="input-field"
                >
                  <option value="service">Service</option>
                  <option value="equipment">Equipment</option>
                  <option value="supply">Supply</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                >
                  <optgroup label="Services">
                    <option value="event-planning">Event Planning</option>
                    <option value="catering">Catering</option>
                    <option value="photography">Photography</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="decoration">Decoration</option>
                    <option value="setup-teardown">Setup/Teardown</option>
                    <option value="cleaning">Cleaning</option>
                  </optgroup>
                  <optgroup label="Equipment & Supplies">
                    <option value="furniture">Furniture</option>
                    <option value="lighting">Lighting</option>
                    <option value="sound-system">Sound System</option>
                    <option value="tents-canopies">Tents & Canopies</option>
                    <option value="linens-tableware">Linens & Tableware</option>
                    <option value="party-supplies">Party Supplies</option>
                  </optgroup>
                  <optgroup label="Events">
                    <option value="wedding">Wedding</option>
                    <option value="corporate">Corporate</option>
                    <option value="birthday">Birthday</option>
                    <option value="graduation">Graduation</option>
                    <option value="party">Party</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price (₱)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  required
                  className="input-field"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price Type</label>
                <select
                  value={formData.priceType}
                  onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
                  className="input-field"
                >
                  <option value="flat-rate">Flat Rate</option>
                  <option value="per-hour">Per Hour</option>
                  <option value="per-day">Per Day</option>
                  <option value="per-event">Per Event</option>
                  <option value="per-person">Per Person</option>
                  <option value="per-item">Per Item</option>
                </select>
              </div>

              {formData.serviceType === 'service' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                    required
                    className="input-field"
                    min="15"
                    step="15"
                  />
                </div>
              )}

              {(formData.serviceType === 'equipment' || formData.serviceType === 'supply') && (
                <div>
                  <label className="block text-sm font-medium mb-2">Max Order (0 = unlimited)</label>
                  <input
                    type="number"
                    value={formData.maxOrder}
                    onChange={(e) => setFormData({ ...formData, maxOrder: parseInt(e.target.value) || 0 })}
                    className="input-field"
                    min="0"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    💡 Initial stock quantity will be set to 0. Use Inventory module to manage stock levels.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input-field"
                >
                  <option value="indoor">Indoor Only</option>
                  <option value="outdoor">Outdoor Only</option>
                  <option value="both">Indoor & Outdoor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Lead Time (hours)</label>
                <input
                  type="number"
                  value={formData.leadTime}
                  onChange={(e) => setFormData({ ...formData, leadTime: parseInt(e.target.value) || 24 })}
                  className="input-field"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Short Description</label>
              <input
                type="text"
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                className="input-field"
                placeholder="Brief description for listings..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Full Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                className="input-field"
                rows={4}
                placeholder="Detailed service description..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Suitable Event Types</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {['wedding', 'corporate', 'birthday', 'graduation', 'party', 'conference'].map((eventType) => (
                    <label key={eventType} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.eventTypes.includes(eventType)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...formData.eventTypes, eventType]
                            : formData.eventTypes.filter(t => t !== eventType);
                          setFormData({ ...formData, eventTypes: updated });
                        }}
                        className="mr-2"
                      />
                      <span className="capitalize">{eventType}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                  })}
                  className="input-field"
                  placeholder="professional, premium, luxury..."
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Features (one per line)</label>
                <textarea
                  value={formData.features.join('\n')}
                  onChange={(e) => setFormData({
                    ...formData,
                    features: e.target.value.split('\n').filter(f => f.trim())
                  })}
                  className="input-field"
                  rows={4}
                  placeholder="Professional staff&#10;High-quality equipment&#10;Flexible scheduling..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">What's Included (one per line)</label>
                <textarea
                  value={formData.includedItems.join('\n')}
                  onChange={(e) => setFormData({
                    ...formData,
                    includedItems: e.target.value.split('\n').filter(i => i.trim())
                  })}
                  className="input-field"
                  rows={4}
                  placeholder="Setup and teardown&#10;Basic decorations&#10;Sound system..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Requirements (one per line)</label>
              <textarea
                value={formData.requirements.join('\n')}
                onChange={(e) => setFormData({
                  ...formData,
                  requirements: e.target.value.split('\n').filter(r => r.trim())
                })}
                className="input-field"
                rows={3}
                placeholder="Power outlet access&#10;Parking space&#10;Advance booking..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Main Service Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                  className="input-field"
                />
                <p className="text-xs text-[var(--muted)] mt-1">Primary image for the service</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Gallery Images</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFormData({
                    ...formData,
                    gallery: Array.from(e.target.files || [])
                  })}
                  className="input-field"
                />
                <p className="text-xs text-[var(--muted)] mt-1">Additional images (max 10)</p>
              </div>
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
                  {(service.serviceType === 'equipment' || service.serviceType === 'supply') && (
                    <span className="flex items-center gap-2">
                      Stock:
                      <span className={`font-semibold flex items-center gap-2 ${
                        (service.quantity || 0) === 0 ? 'text-red-600' :
                        (service.quantity || 0) <= 5 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {service.quantity || 0} available
                        <span className="text-xs text-gray-500">
                          (Manage in Inventory)
                        </span>
                      </span>
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
