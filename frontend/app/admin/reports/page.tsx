'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '../../../components/SocketProvider';

interface InventoryReport {
  serviceId: string;
  name: string;
  totalStock: number;
  bookedQuantity: number;
  availableQuantity: number;
  utilizationRate: string;
}

interface DeliverySchedule {
  id: string;
  serviceName: string;
  serviceCategory: string;
  customerName: string;
  customerEmail: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  quantity: number;
  totalPrice: number;
  notes?: string;
}

interface DeliveryTruckStatus {
  status: 'available' | 'busy' | 'error';
  currentDelivery?: {
    serviceName: string;
    customerName: string;
    endTime: string;
    timeRemaining: number;
  };
  nextDelivery?: {
    serviceName: string;
    customerName: string;
    startTime: string;
    timeUntilNext: number;
  };
}

export default function Reports() {
  const { socket } = useSocket();
  const [inventoryReport, setInventoryReport] = useState<InventoryReport[]>([]);
  const [deliverySchedules, setDeliverySchedules] = useState<DeliverySchedule[]>([]);
  const [deliveryTruckStatus, setDeliveryTruckStatus] = useState<DeliveryTruckStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch inventory reports
      const inventoryResponse = await fetch('http://localhost:5000/api/analytics/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const inventoryData = await inventoryResponse.json();
      if (inventoryData.success) {
        setInventoryReport(inventoryData.data);
      }

      // Fetch delivery schedules
      await fetchDeliverySchedules();

      // Fetch delivery truck status
      await fetchDeliveryTruckStatus();

    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliverySchedules = async (date?: string) => {
    try {
      const token = localStorage.getItem('token');
      const dateParam = date || selectedDate;
      const response = await fetch(`http://localhost:5000/api/bookings/admin/delivery-schedules?date=${dateParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setDeliverySchedules(data.schedules);
      }
    } catch (error) {
      console.error('Failed to fetch delivery schedules:', error);
    }
  };

  const fetchDeliveryTruckStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/bookings/admin/delivery-truck-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setDeliveryTruckStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch delivery truck status:', error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      console.log('Inventory updated for reports:', data);
      setUpdating(true);

      // Refresh the reports data
      fetchReports();

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleServiceUpdate = (data: any) => {
      console.log('Service updated for reports:', data);
      setUpdating(true);

      // Refresh the reports data
      fetchReports();

      setTimeout(() => setUpdating(false), 2000);
    };

    socket.on('inventory-updated', handleInventoryUpdate);
    socket.on('service-updated', handleServiceUpdate);

    return () => {
      socket.off('inventory-updated', handleInventoryUpdate);
      socket.off('service-updated', handleServiceUpdate);
    };
  }, [socket]);

  if (loading) return <div>Loading reports...</div>;

  return (
    <div>
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Reports updated!</span>
        </div>
      )}

      <h1 className="text-4xl font-bold mb-2">Admin Reports & Delivery Management</h1>
      <p className="text-[var(--muted)] mb-8">Track inventory, delivery schedules, and truck availability</p>

      <div className="card p-6">
        <h2 className="section-title">Equipment Inventory Status</h2>
        {inventoryReport.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Equipment</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Total Stock</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Booked</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Available</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {inventoryReport.map((item) => (
                  <tr key={item.serviceId} className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-semibold">{item.name}</td>
                    <td className="py-3 px-4">{item.totalStock}</td>
                    <td className="py-3 px-4">{item.bookedQuantity}</td>
                    <td className="py-3 px-4">
                      <span className={item.availableQuantity === 0 ? 'text-red-600 font-semibold' : ''}>
                        {item.availableQuantity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${parseFloat(item.utilizationRate) > 80 ? 'bg-red-500' : parseFloat(item.utilizationRate) > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(parseFloat(item.utilizationRate), 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">{item.utilizationRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[var(--muted)] text-center py-8">No equipment data available</p>
        )}
      </div>

      {/* Delivery Truck Status */}
      <div className="card p-6 mt-8">
        <h2 className="section-title">🚚 Delivery Truck Status</h2>
        {deliveryTruckStatus ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${
              deliveryTruckStatus.status === 'busy'
                ? 'bg-red-50 border-red-200'
                : deliveryTruckStatus.status === 'available'
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${
                  deliveryTruckStatus.status === 'busy'
                    ? 'bg-red-500'
                    : deliveryTruckStatus.status === 'available'
                    ? 'bg-green-500'
                    : 'bg-gray-500'
                }`}></div>
                <div>
                  <h3 className={`font-semibold text-lg ${
                    deliveryTruckStatus.status === 'busy'
                      ? 'text-red-800'
                      : deliveryTruckStatus.status === 'available'
                      ? 'text-green-800'
                      : 'text-gray-800'
                  }`}>
                    Truck is {deliveryTruckStatus.status === 'busy' ? 'Busy' : 'Available'}
                  </h3>
                  {deliveryTruckStatus.currentDelivery && (
                    <p className="text-red-700 mt-1">
                      Currently delivering: <strong>{deliveryTruckStatus.currentDelivery.serviceName}</strong> to {deliveryTruckStatus.currentDelivery.customerName}
                      <br />
                      <span className="text-sm">Ends at: {new Date(deliveryTruckStatus.currentDelivery.endTime).toLocaleString()}</span>
                      <span className="text-sm ml-4">({deliveryTruckStatus.currentDelivery.timeRemaining} minutes remaining)</span>
                    </p>
                  )}
                  {deliveryTruckStatus.nextDelivery && (
                    <p className="text-blue-700 mt-1">
                      Next delivery: <strong>{deliveryTruckStatus.nextDelivery.serviceName}</strong> for {deliveryTruckStatus.nextDelivery.customerName}
                      <br />
                      <span className="text-sm">Starts at: {new Date(deliveryTruckStatus.nextDelivery.startTime).toLocaleString()}</span>
                      <span className="text-sm ml-4">({deliveryTruckStatus.nextDelivery.timeUntilNext} minutes from now)</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[var(--muted)] text-center py-8">Loading truck status...</p>
        )}
      </div>

      {/* Delivery Schedules */}
      <div className="card p-6 mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-title">📅 Delivery Schedules</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                fetchDeliverySchedules(e.target.value);
              }}
              className="input-field"
            />
          </div>
        </div>

        {deliverySchedules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Service</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Value</th>
                </tr>
              </thead>
              <tbody>
                {deliverySchedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-[var(--border)] hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold">
                        {new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                        {new Date(schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">{schedule.serviceName}</div>
                      <div className="text-xs text-[var(--muted)] capitalize">{schedule.serviceCategory}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">{schedule.customerName}</div>
                      <div className="text-xs text-[var(--muted)]">{schedule.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4">{schedule.duration} minutes</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        schedule.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : schedule.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">₱{schedule.totalPrice}</div>
                      <div className="text-xs text-[var(--muted)]">Qty: {schedule.quantity}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[var(--muted)] text-center py-8">No delivery schedules for selected date</p>
        )}
      </div>
    </div>
  );
}