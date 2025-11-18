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

export default function Reports() {
  const { socket } = useSocket();
  const [inventoryReport, setInventoryReport] = useState<InventoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/analytics/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setInventoryReport(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
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

      <h1 className="text-4xl font-bold mb-2">Inventory Reports</h1>
      <p className="text-[var(--muted)] mb-8">Track equipment utilization and stock levels</p>

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
    </div>
  );
}