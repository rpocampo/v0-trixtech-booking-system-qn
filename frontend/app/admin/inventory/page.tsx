/**
 * INVENTORY MANAGEMENT MODULE
 *
 * PRIMARY CONTROLLER OF STOCK DATA
 * ================================
 *
 * ROLE: Acts as the primary controller of all stock data
 * - Responsible for editing, updating, adding, and reducing stock quantities
 * - Ensures all stock changes are accurately reflected in the system
 * - Maintains the official and authoritative inventory records
 * - Provides real-time inventory synchronization via WebSocket
 * - Tracks inventory levels, low stock alerts, and out-of-stock items
 * - Calculates total inventory value and stock worth
 *
 * AUTHORITY: This module has EXCLUSIVE authority over stock quantity modifications
 * - All stock changes MUST go through this module
 * - Other modules can only READ stock data, never modify it
 * - Maintains data integrity and prevents conflicting updates
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../../components/SocketProvider';

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  serviceType: string;
  quantity: number;
  price: number;
  isAvailable: boolean;
  image?: string;
}

export default function InventoryManagement() {
  const router = useRouter();
  const { socket } = useSocket();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newQuantity, setNewQuantity] = useState('');
  const [lowStockAlerts, setLowStockAlerts] = useState<any>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedServiceBatches, setSelectedServiceBatches] = useState<any>(null);
  const [showBatches, setShowBatches] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [newBatch, setNewBatch] = useState({
    batchId: '',
    supplier: '',
    quantity: '',
    unitCost: '',
    expiryDate: '',
    location: '',
    notes: ''
  });
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [stockHistory, setStockHistory] = useState<any>(null);
  const [historyDateRange, setHistoryDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // Today
  });

  const fetchInventory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('http://localhost:5000/api/services', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.clear();
        router.push('/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Filter only equipment and supply items
        const inventoryItems = data.services.filter((service: any) =>
          service.serviceType === 'equipment' || service.serviceType === 'supply'
        );
        setInventory(inventoryItems);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStockAlerts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('http://localhost:5000/api/inventory/low-stock-status', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLowStockAlerts(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
    }
  };

  const fetchServiceBatches = async (serviceId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/api/inventory/service/${serviceId}/batches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedServiceBatches(data);
          setShowBatches(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch service batches:', error);
    }
  };

  const addBatch = async (serviceId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const batchData = {
        ...newBatch,
        quantity: parseInt(newBatch.quantity),
        unitCost: parseFloat(newBatch.unitCost) || 0,
        expiryDate: newBatch.expiryDate ? new Date(newBatch.expiryDate) : undefined
      };

      const response = await fetch(`http://localhost:5000/api/inventory/service/${serviceId}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(batchData)
      });

      if (response.ok) {
        fetchInventory();
        fetchServiceBatches(serviceId);
        setShowAddBatch(false);
        setNewBatch({
          batchId: '',
          supplier: '',
          quantity: '',
          unitCost: '',
          expiryDate: '',
          location: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Failed to add batch:', error);
    }
  };

  const fetchStockHistory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/api/inventory/stock-history?startDate=${historyDateRange.startDate}&endDate=${historyDateRange.endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStockHistory(data);
          setShowStockHistory(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stock history:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchInventory();
    fetchLowStockAlerts();
  }, [router]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      console.log('Inventory updated:', data);
      setUpdating(true);
      setLastUpdate(new Date());
      fetchInventory();
      setTimeout(() => setUpdating(false), 2000);
    };

    socket.on('inventory-updated', handleInventoryUpdate);

    return () => {
      socket.off('inventory-updated', handleInventoryUpdate);
    };
  }, [socket]);

  const updateInventory = async (itemId: string, newQty: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/api/services/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity: newQty,
        }),
      });

      if (response.status === 401) {
        localStorage.clear();
        router.push('/login');
        return;
      }

      if (response.ok) {
        fetchInventory();
        setShowModal(false);
        setSelectedItem(null);
        setNewQuantity('');
      }
    } catch (error) {
      console.error('Failed to update inventory:', error);
    }
  };

  const openUpdateModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setNewQuantity(item.quantity.toString());
    setShowModal(true);
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { status: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-100' };
    if (quantity <= 5) return { status: 'Low Stock', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { status: 'In Stock', color: 'text-green-600', bg: 'bg-green-100' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => item.quantity <= 5 && item.quantity > 0).length;
  const outOfStockItems = inventory.filter(item => item.quantity === 0).length;
  const totalValue = inventory.reduce((sum, item) => {
    const price = isNaN(item.price) ? 0 : item.price;
    return sum + (price * item.quantity);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Real-time Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--primary)] text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Inventory updated!</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[var(--foreground)]">Inventory Management</h1>
        <p className="text-[var(--muted)] mt-2">Monitor and manage your equipment and supply inventory</p>
        {lastUpdate && (
          <p className="text-xs text-[var(--muted)] mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </div>


      {/* Inventory Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">📦</span>
            Total Items
          </div>
          <div className="stat-value text-[var(--primary)]">{totalItems}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            Low Stock
          </div>
          <div className="stat-value text-yellow-600">{lowStockItems}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300">
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">❌</span>
            Out of Stock
          </div>
          <div className="stat-value text-red-600">{outOfStockItems}</div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300 cursor-pointer" onClick={() => setShowAlerts(!showAlerts)}>
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">🔔</span>
            Alerts
          </div>
          <div className="stat-value text-blue-600">
            {(lowStockAlerts?.critical || 0) + (lowStockAlerts?.warning || 0) + (lowStockAlerts?.info || 0)}
          </div>
        </div>
        <div className="stat-box hover:shadow-lg transition-shadow duration-300 cursor-pointer" onClick={() => fetchStockHistory()}>
          <div className="stat-label flex items-center gap-2">
            <span className="text-lg">📊</span>
            Stock History
          </div>
          <div className="stat-value text-purple-600">
            Monitor
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {showAlerts && lowStockAlerts && (
        <div className="card p-6 bg-gradient-to-r from-[var(--primary-50)] to-[var(--accent-50)] border-[var(--primary-200)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
              <span className="text-xl">🔔</span>
              Low Stock Alerts
            </h3>
            <button
              onClick={fetchLowStockAlerts}
              className="btn-secondary text-sm"
            >
              Refresh
            </button>
          </div>

          {lowStockAlerts.items && lowStockAlerts.items.length > 0 ? (
            <div className="space-y-3">
              {lowStockAlerts.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      item.level === 'out_of_stock' ? 'bg-red-500' :
                      item.level === 'critical' ? 'bg-red-500' :
                      item.level === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{item.name}</p>
                      <p className="text-sm text-[var(--muted)] capitalize">{item.category} • {item.level.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${
                      item.quantity === 0 ? 'text-red-600' :
                      item.quantity <= 2 ? 'text-red-600' :
                      item.quantity <= 5 ? 'text-yellow-600' : 'text-blue-600'
                    }`}>
                      {item.quantity} left
                    </span>
                    <button
                      onClick={() => {
                        const foundItem = inventory.find(inv => inv._id === item.id);
                        if (foundItem) openUpdateModal(foundItem);
                      }}
                      className="btn-primary text-xs px-3 py-1"
                    >
                      Update Stock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-700 font-medium">All inventory levels are healthy!</p>
              <p className="text-sm text-[var(--muted)] mt-1">No low stock alerts at this time.</p>
            </div>
          )}
        </div>
      )}

      {/* Inventory Table */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <span className="text-2xl">📋</span>
            Inventory Items
          </h2>
          <Link href="/admin/services" className="btn-outline text-sm">
            Manage Equipment →
          </Link>
        </div>

        {inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Item</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Type</th>
                  <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Stock</th>
                  <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-[var(--muted)]">Unit Price</th>
                  <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const stockStatus = getStockStatus(item.quantity);
                  return (
                    <tr key={item._id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img
                              src={item.image.startsWith('/uploads/') ? `http://localhost:5000${item.image}` : item.image}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/40x40?text=IMG';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-lg">
                              📦
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{item.name}</p>
                            <p className="text-xs text-[var(--muted)]">ID: {item._id.slice(-6)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 capitalize">{item.category.replace('-', ' ')}</td>
                      <td className="py-4 px-4 capitalize">{item.serviceType}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`font-semibold ${item.quantity === 0 ? 'text-red-600' : item.quantity <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${stockStatus.bg} ${stockStatus.color}`}>
                          {stockStatus.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-[var(--primary)]">₱{isNaN(item.price) ? '0.00' : item.price.toFixed(2)}</td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openUpdateModal(item)}
                            className="btn-primary text-xs px-2 py-1"
                          >
                            Update Stock
                          </button>
                          <button
                            onClick={() => fetchServiceBatches(item._id)}
                            className="btn-secondary text-xs px-2 py-1"
                          >
                            View Batches
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">📦</div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">No inventory items found</h3>
            <p className="text-[var(--muted)] mb-6">Add equipment or supplies to start managing your inventory.</p>
            <Link href="/admin/services" className="btn-primary">
              Add Services
            </Link>
          </div>
        )}
      </div>

      {/* Update Stock Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-[var(--foreground)] mb-4">Update Stock</h3>

              <div className="mb-6">
                <div className="flex items-center gap-3 p-3 bg-[var(--surface-secondary)] rounded-lg mb-4">
                  {selectedItem.image ? (
                    <img
                      src={selectedItem.image.startsWith('/uploads/') ? `http://localhost:5000${selectedItem.image}` : selectedItem.image}
                      alt={selectedItem.name}
                      className="w-12 h-12 rounded-lg object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/48x48?text=IMG';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-xl">
                      📦
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{selectedItem.name}</p>
                    <p className="text-sm text-[var(--muted)]">Current stock: {selectedItem.quantity} items</p>
                  </div>
                </div>

                <label className="block text-sm font-medium mb-2">New Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  className="input-field w-full"
                  placeholder="Enter new quantity"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const qty = parseInt(newQuantity);
                    if (!isNaN(qty) && qty >= 0) {
                      updateInventory(selectedItem._id, qty);
                    }
                  }}
                  className="btn-primary flex-1"
                >
                  Update Stock
                </button>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedItem(null);
                    setNewQuantity('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Management Modal */}
      {showBatches && selectedServiceBatches && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-[var(--foreground)]">Batch Management</h3>
                  <p className="text-[var(--muted)] mt-1">{selectedServiceBatches.service.name}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddBatch(true)}
                    className="btn-primary text-sm"
                  >
                    Add Batch
                  </button>
                  <button
                    onClick={() => {
                      setShowBatches(false);
                      setSelectedServiceBatches(null);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Batch Summary */}
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="stat-box">
                  <div className="stat-label">Total Quantity</div>
                  <div className="stat-value text-[var(--primary)]">{selectedServiceBatches.batchDetails.totalQuantity}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Active Batches</div>
                  <div className="stat-value text-blue-600">{selectedServiceBatches.batchDetails.totalBatches}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Expiring Soon</div>
                  <div className="stat-value text-yellow-600">{selectedServiceBatches.batchDetails.expiringCount}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Expired</div>
                  <div className="stat-value text-red-600">{selectedServiceBatches.batchDetails.expiredCount}</div>
                </div>
              </div>

              {/* Batches Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Batch ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Supplier</th>
                      <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Quantity</th>
                      <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Unit Cost</th>
                      <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Expiry Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Location</th>
                      <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedServiceBatches.batchDetails.batches.map((batch: any) => (
                      <tr key={batch._id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                        <td className="py-3 px-4 font-medium">{batch.batchId}</td>
                        <td className="py-3 px-4">{batch.supplier}</td>
                        <td className="py-3 px-4 text-center">{batch.quantity}</td>
                        <td className="py-3 px-4 text-center">₱{batch.unitCost?.toFixed(2) || '0.00'}</td>
                        <td className="py-3 px-4 text-center">
                          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4">{batch.location || 'N/A'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            batch.quantity === 0 ? 'bg-gray-100 text-gray-800' :
                            batch.expiryDate && new Date(batch.expiryDate) < new Date() ? 'bg-red-100 text-red-800' :
                            batch.expiryDate && new Date(batch.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {batch.quantity === 0 ? 'Empty' :
                             batch.expiryDate && new Date(batch.expiryDate) < new Date() ? 'Expired' :
                             batch.expiryDate && new Date(batch.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'Expiring' :
                             'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatch && selectedServiceBatches && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-[var(--foreground)] mb-4">Add New Batch</h3>
              <p className="text-[var(--muted)] mb-6">{selectedServiceBatches.service.name}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Batch ID *</label>
                  <input
                    type="text"
                    value={newBatch.batchId}
                    onChange={(e) => setNewBatch({ ...newBatch, batchId: e.target.value })}
                    className="input-field w-full"
                    placeholder="e.g., BATCH-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Supplier *</label>
                  <input
                    type="text"
                    value={newBatch.supplier}
                    onChange={(e) => setNewBatch({ ...newBatch, supplier: e.target.value })}
                    className="input-field w-full"
                    placeholder="Supplier name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={newBatch.quantity}
                      onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
                      className="input-field w-full"
                      placeholder="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Unit Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newBatch.unitCost}
                      onChange={(e) => setNewBatch({ ...newBatch, unitCost: e.target.value })}
                      className="input-field w-full"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Expiry Date</label>
                  <input
                    type="date"
                    value={newBatch.expiryDate}
                    onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={newBatch.location}
                    onChange={(e) => setNewBatch({ ...newBatch, location: e.target.value })}
                    className="input-field w-full"
                    placeholder="Warehouse location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={newBatch.notes}
                    onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                    className="input-field w-full"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => addBatch(selectedServiceBatches.service.id)}
                  className="btn-primary flex-1"
                >
                  Add Batch
                </button>
                <button
                  onClick={() => {
                    setShowAddBatch(false);
                    setNewBatch({
                      batchId: '',
                      supplier: '',
                      quantity: '',
                      unitCost: '',
                      expiryDate: '',
                      location: '',
                      notes: ''
                    });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {showStockHistory && stockHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-gray-600">
            <div className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-100">Date-to-Date Stock Monitoring</h3>
                  <p className="text-gray-400 mt-1">
                    {new Date(historyDateRange.startDate).toLocaleDateString()} - {new Date(historyDateRange.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      value={historyDateRange.startDate}
                      onChange={(e) => setHistoryDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="input-field text-sm"
                    />
                    <input
                      type="date"
                      value={historyDateRange.endDate}
                      onChange={(e) => setHistoryDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="input-field text-sm"
                    />
                    <button
                      onClick={fetchStockHistory}
                      className="btn-primary text-sm min-w-[80px] flex justify-center items-center"
                    >
                      Update
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setShowStockHistory(false);
                      setStockHistory(null);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Stock History Summary */}
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="text-gray-200 text-sm font-medium">Total Transactions</div>
                  <div className="text-blue-200 text-2xl font-bold mt-1">{stockHistory.summary?.totalTransactions || 0}</div>
                </div>
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="text-gray-200 text-sm font-medium">Stock Added</div>
                  <div className="text-green-200 text-2xl font-bold mt-1">{stockHistory.summary?.totalStockAdded || 0}</div>
                </div>
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="text-gray-200 text-sm font-medium">Stock Reduced</div>
                  <div className="text-red-200 text-2xl font-bold mt-1">{stockHistory.summary?.totalStockReduced || 0}</div>
                </div>
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="text-gray-200 text-sm font-medium">Net Change</div>
                  <div className={`text-2xl font-bold mt-1 ${(stockHistory.summary?.netChange || 0) >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                    {(stockHistory.summary?.netChange || 0) >= 0 ? '+' : ''}{stockHistory.summary?.netChange || 0}
                  </div>
                </div>
              </div>

              {/* Stock History Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-3 px-4 font-semibold text-gray-100">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-100">Item</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-100">Type</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-100">Previous Stock</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-100">Change</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-100">New Stock</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-100">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockHistory.transactions?.map((transaction: any, index: number) => (
                      <tr key={index} className="border-b border-gray-600 hover:bg-gray-700">
                        <td className="py-3 px-4 text-gray-100">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {transaction.itemImage ? (
                              <img
                                src={transaction.itemImage.startsWith('/uploads/') ? `http://localhost:5000${transaction.itemImage}` : transaction.itemImage}
                                alt={transaction.itemName}
                                className="w-6 h-6 rounded object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://via.placeholder.com/24x24?text=I';
                                }}
                              />
                            ) : (
                              <div className="w-6 h-6 rounded bg-gray-600 flex items-center justify-center text-xs">📦</div>
                            )}
                            <span className="font-medium text-gray-100">{transaction.itemName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.type === 'addition' ? 'bg-green-700 text-white' :
                            transaction.type === 'reduction' ? 'bg-red-700 text-white' :
                            'bg-blue-700 text-white'
                          }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-100">
                          {transaction.previousStock}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-semibold ${
                            transaction.change > 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {transaction.change > 0 ? '+' : ''}{transaction.change}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-100">
                          {transaction.newStock}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-200">
                          {transaction.reason || 'Manual update'}
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-300">
                          No stock transactions found for the selected date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Export Button */}
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    // Simple CSV export
                    if (stockHistory.transactions) {
                      const csvContent = [
                        ['Date', 'Item', 'Type', 'Previous Stock', 'Change', 'New Stock', 'Reason'],
                        ...stockHistory.transactions.map((t: any) => [
                          new Date(t.date).toLocaleDateString(),
                          t.itemName,
                          t.type,
                          t.previousStock,
                          t.change,
                          t.newStock,
                          t.reason || 'Manual update'
                        ])
                      ].map(row => row.join(',')).join('\n');

                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `stock-history-${historyDateRange.startDate}-to-${historyDateRange.endDate}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }
                  }}
                  className="btn-secondary"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}