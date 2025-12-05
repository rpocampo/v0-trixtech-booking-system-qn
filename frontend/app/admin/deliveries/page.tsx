'use client';

import { useState, useEffect } from 'react';

interface Delivery {
  _id: string;
  bookingId: {
    _id: string;
  };
  customerId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  scheduledDate: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  estimatedDuration: number;
  actualStartTime?: string;
  actualEndTime?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  contactPerson?: {
    name: string;
    phone: string;
  };
  items: Array<{
    serviceId: string;
    name: string;
    quantity: number;
    category: string;
  }>;
  totalWeight: number;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryStatus {
  status: 'available' | 'busy' | 'scheduled';
  currentDelivery?: {
    id: string;
    customerName: string;
    scheduledDate: string;
    estimatedDuration: number;
    actualStartTime?: string;
  };
  nextDelivery?: {
    id: string;
    customerName: string;
    scheduledDate: string;
    estimatedDuration: number;
  };
  nextAvailableTime?: string;
}

export default function DeliveryManagement() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Fetch deliveries
  const fetchDeliveries = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (filterStatus) params.append('status', filterStatus);

      const response = await fetch(`http://localhost:5000/api/deliveries/schedule?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setDeliveries(data.deliveries || []);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    }
  };

  // Fetch delivery status
  const fetchDeliveryStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/deliveries/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setDeliveryStatus(data);
      }
    } catch (error) {
      console.error('Error fetching delivery status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update delivery status
  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        fetchDeliveries();
        fetchDeliveryStatus();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update delivery status');
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      alert('Failed to update delivery status');
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDeliveries();
    fetchDeliveryStatus();
  }, [selectedDate, filterStatus]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeliveries();
      fetchDeliveryStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedDate, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Management</h1>
      </div>

      {/* Current Status */}
      {deliveryStatus && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Current Truck Status</h2>
          <div className={`p-4 rounded-lg ${
            deliveryStatus.status === 'available' ? 'bg-green-50 border border-green-200' :
            deliveryStatus.status === 'busy' ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${
                deliveryStatus.status === 'available' ? 'bg-green-500' :
                deliveryStatus.status === 'busy' ? 'bg-red-500' :
                'bg-yellow-500'
              }`}></div>
              <div>
                <p className="font-medium capitalize">{deliveryStatus.status}</p>
                {deliveryStatus.currentDelivery && (
                  <p className="text-sm text-gray-600">
                    Delivering to: {deliveryStatus.currentDelivery.customerName}
                  </p>
                )}
                {deliveryStatus.nextDelivery && (
                  <p className="text-sm text-gray-600">
                    Next: {deliveryStatus.nextDelivery.customerName} at {new Date(deliveryStatus.nextDelivery.scheduledDate).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Delivery Schedule</h2>
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Deliveries ({deliveries.length})</h3>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No deliveries found for the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <tr key={delivery._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {delivery.customerId.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {delivery.customerId.email}
                        </div>
                        {delivery.customerId.phone && (
                          <div className="text-sm text-gray-500">
                            {delivery.customerId.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(delivery.scheduledDate).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(delivery.scheduledDate).toLocaleTimeString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        Duration: {delivery.estimatedDuration}min
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(delivery.status)}`}>
                        {delivery.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(delivery.priority)}`}>
                        {delivery.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {delivery.items.map((item, index) => (
                          <div key={index}>
                            {item.quantity}x {item.name}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        Auto-managed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}