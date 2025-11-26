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


export default function Reports() {
  const { socket } = useSocket();
  const [inventoryReport, setInventoryReport] = useState<InventoryReport[]>([]);
  const [deliverySchedules, setDeliverySchedules] = useState<DeliverySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch inventory reports
      const inventoryResponse = await fetch(`${apiUrl}/api/analytics/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const inventoryData = await inventoryResponse.json();
      if (inventoryData.success) {
        setInventoryReport(inventoryData.data);
      }

      // Fetch delivery schedules
      await fetchDeliverySchedules();

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
      const response = await fetch(`${apiUrl}/api/bookings/admin/delivery-schedules?date=${dateParam}`, {
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


  useEffect(() => {
    fetchReports();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      setUpdating(true);

      // Refresh the reports data
      fetchReports();

      setTimeout(() => setUpdating(false), 2000);
    };

    const handleServiceUpdate = (data: any) => {
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
