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
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'equipment',
    serviceType: 'service', // Allow selection between service, equipment, supply
    price: 0,
    duration: 1,
    includedItems: [] as string[],
    image: null as File | null,
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Inclusions management functions
  const addInclusion = () => {
    setFormData(prev => ({
      ...prev,
      includedItems: [...prev.includedItems, '']
    }));
  };

  const removeInclusion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      includedItems: prev.includedItems.filter((_, i) => i !== index)
    }));
  };

  const updateInclusion = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      includedItems: prev.includedItems.map((item, i) => i === index ? value : item)
    }));
  };

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

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Service name is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than ₱0.00';
    }

    // Validate inclusions only if serviceType is not equipment
    if (formData.serviceType !== 'equipment') {
      const validInclusions = formData.includedItems.filter(item => item.trim());
      if (validInclusions.length === 0) {
        newErrors.inclusions = 'At least one inclusion is required';
      }

      // Check for duplicates
      const uniqueInclusions = new Set(validInclusions.map(item => item.trim().toLowerCase()));
      if (uniqueInclusions.size !== validInclusions.length) {
        newErrors.inclusions = 'Duplicate inclusions are not allowed';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const token = localStorage.getItem('token');

    try {
      const formDataToSend = new FormData();

      // Add essential form fields only
      formDataToSend.append('name', formData.name.trim());
      formDataToSend.append('description', formData.description.trim());
      formDataToSend.append('category', formData.category);
      formDataToSend.append('price', formData.price.toString());
      formDataToSend.append('priceType', 'flat-rate'); // Default to flat-rate for simplicity
      formDataToSend.append('serviceType', formData.serviceType);

      // Add duration for services, quantity for equipment/supply
      if (formData.serviceType === 'service') {
        formDataToSend.append('duration', '120'); // Default 2 hours for services
      } else {
        formDataToSend.append('quantity', '10'); // Default quantity for inventory items
      }

      // Add included items (skip for equipment, use provided ones or defaults for others)
      if (formData.serviceType === 'equipment') {
        // Equipment services don't require inclusions - send empty array
      } else if (formData.includedItems.length === 0) {
        formDataToSend.append('includedItems', 'Professional service delivery');
        formDataToSend.append('includedItems', 'Standard setup and preparation');
      } else {
        formData.includedItems.forEach(item => {
          if (item.trim()) {
            formDataToSend.append('includedItems', item.trim());
          }
        });
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
          category: 'equipment',
          serviceType: 'service',
          price: 0,
          duration: 1,
          includedItems: [],
          image: null,
        });
        setErrors({});
        setShowForm(false);
      } else {
        setErrors({ submit: data.message || 'Failed to create service' });
      }
    } catch (error) {
      console.error('Failed to create service:', error);
      setErrors({ submit: 'Network error. Please try again.' });
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

  const startEditing = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      serviceType: service.serviceType,
      price: service.price,
      duration: service.duration || 1,
      includedItems: Array.isArray(service.includedItems)
        ? service.includedItems
        : service.includedItems ? [service.includedItems] : [],
      image: null,
    });
    setShowForm(true);
  };

  const cancelEditing = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      category: 'equipment',
      serviceType: 'service',
      price: 0,
      duration: 1,
      includedItems: [],
      image: null,
    });
    setShowForm(false);
  };

  const updateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    if (!validateForm()) {
      return;
    }

    const token = localStorage.getItem('token');

    try {
      const formDataToSend = new FormData();

      formDataToSend.append('name', formData.name.trim());
      formDataToSend.append('description', formData.description.trim());
      formDataToSend.append('category', formData.category);
      formDataToSend.append('price', formData.price.toString());
      formDataToSend.append('duration', formData.duration.toString());

      // Add included items as separate entries (skip for equipment)
      if (formData.serviceType !== 'equipment') {
        formData.includedItems.forEach(item => {
          if (item.trim()) {
            formDataToSend.append('includedItems', item.trim());
          }
        });
      }

      const response = await fetch(`http://localhost:5000/api/services/${editingService._id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        setServices(services.map(s => s._id === editingService._id ? data.service : s));
        cancelEditing();
      } else {
        setErrors({ submit: data.message || 'Failed to update service' });
      }
    } catch (error) {
      console.error('Failed to update service:', error);
      setErrors({ submit: 'Network error. Please try again.' });
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
        <button onClick={() => {
          if (showForm) {
            cancelEditing();
          } else {
            setShowForm(true);
          }
        }} className="btn-primary">
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">
            {editingService ? 'Edit Service' : 'Create New Service'}
          </h2>

          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          <form onSubmit={editingService ? updateService : handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Service Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Service Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`input-field ${errors.name ? 'border-red-300 focus:border-red-500' : ''}`}
                  placeholder="e.g., Professional Photography Service"
                />
                {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Service Type *
                </label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="input-field"
                >
                  <option value="service">Service (Professional Service)</option>
                  <option value="equipment">Equipment (Rental Item)</option>
                  <option value="supply">Supply (Consumable Item)</option>
                </select>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Equipment & Supply items will appear in Inventory management
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                >
                  <option value="equipment">Equipment</option>
                  <option value="party">Party</option>
                  <option value="corporate">Corporate</option>
                  <option value="wedding">Wedding</option>
                  <option value="birthday">Birthday</option>
                  <option value="funeral">Funeral</option>
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Price (₱) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className={`input-field ${errors.price ? 'border-red-300 focus:border-red-500' : ''}`}
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                />
                {errors.price && <p className="text-sm text-red-600 mt-1">{errors.price}</p>}
                <p className="text-xs text-gray-500 mt-1">Enter the service price in Philippine Pesos</p>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Duration (Days) *
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
                  className="input-field"
                  min="1"
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 mt-1">Duration of the service in days</p>
              </div>
            </div>

            {/* Inclusions - Only show for non-equipment services */}
            {formData.serviceType !== 'equipment' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    What's Included
                  </label>
                  <button
                    type="button"
                    onClick={addInclusion}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>+</span> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.includedItems.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm border-2 border-dashed border-gray-300 rounded-md">
                      No inclusions added yet. Click "Add Item" to get started.
                    </div>
                  ) : (
                    formData.includedItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateInclusion(index, e.target.value)}
                          className="input-field flex-1"
                          placeholder="e.g., Professional service delivery"
                        />
                        <button
                          type="button"
                          onClick={() => removeInclusion(index)}
                          className="text-red-500 hover:text-red-700 p-2"
                          title="Remove this item"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {errors.inclusions && <p className="text-sm text-red-600 mt-1">{errors.inclusions}</p>}
                <p className="text-xs text-gray-500 mt-2">
                  Add items that are included in this service package
                </p>
              </div>
            )}

            {/* Equipment notice */}
            {formData.serviceType === 'equipment' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Equipment Service</h4>
                <p className="text-sm text-blue-700">
                  Equipment services do not require inclusions. The system will allow saving without any inclusions specified.
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`input-field ${errors.description ? 'border-red-300 focus:border-red-500' : ''}`}
                rows={4}
                placeholder="Describe what this service includes and what customers can expect..."
              />
              {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Service Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">Optional: Upload an image to represent this service</p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="mr-3 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingService ? 'Update Service' : 'Create Service'}
              </button>
            </div>
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
                  <span>Duration: <span className="font-semibold">{service.duration || 1} day{service.duration !== 1 ? 's' : ''}</span></span>
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
              <div className="flex gap-2">
                <button
                  onClick={() => startEditing(service)}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteService(service._id)}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
