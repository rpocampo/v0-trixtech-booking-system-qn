'use client';

import { useEffect, useState } from 'react';

export default function Reports() {
  const [stockHistory, setStockHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Today

  const fetchStockHistory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/inventory/stock-history?startDate=${selectedDate}&endDate=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStockHistory(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stock history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockHistory();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchStockHistory();
    }
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[var(--foreground)]">Reports</h1>
        <p className="text-[var(--muted)] mt-2">Monitor and analyze your inventory data</p>
      </div>

      {/* Stock History Content */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
              <span className="text-lg">📊</span>
              Stock History
            </h2>
            <p className="text-[var(--muted)] mt-1">
              Stock history for {new Date(selectedDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field text-sm"
              />
              <button
                onClick={fetchStockHistory}
                className="btn-primary text-sm min-w-[80px] flex justify-center items-center"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* Stock History Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="stat-box">
            <div className="stat-label">Total Transactions</div>
            <div className="stat-value text-[var(--primary)]">{stockHistory?.summary?.totalTransactions || 0}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Stock Added</div>
            <div className="stat-value text-green-600">{stockHistory?.summary?.totalStockAdded || 0}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Stock Reduced</div>
            <div className="stat-value text-red-600">{stockHistory?.summary?.totalStockReduced || 0}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Net Change</div>
            <div className={`stat-value ${(stockHistory?.summary?.netChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(stockHistory?.summary?.netChange || 0) >= 0 ? '+' : ''}{stockHistory?.summary?.netChange || 0}
            </div>
          </div>
        </div>

        {/* Stock History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Item</th>
                <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Type</th>
                <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Previous Stock</th>
                <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">Change</th>
                <th className="text-center py-3 px-4 font-semibold text-[var(--muted)]">New Stock</th>
                <th className="text-left py-3 px-4 font-semibold text-[var(--muted)]">Reason</th>
              </tr>
            </thead>
            <tbody>
              {stockHistory?.transactions?.map((transaction: any, index: number) => (
                <tr key={index} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="py-3 px-4 text-[var(--foreground)]">
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
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-xs">📦</div>
                      )}
                      <span className="font-medium text-[var(--foreground)]">{transaction.itemName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      transaction.type === 'addition' ? 'bg-green-100 text-green-800' :
                      transaction.type === 'reduction' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-[var(--foreground)]">
                    {transaction.previousStock}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-semibold ${
                      transaction.change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.change > 0 ? '+' : ''}{transaction.change}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-[var(--foreground)]">
                    {transaction.newStock}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--muted)]">
                    {transaction.reason || 'Manual update'}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--muted)]">
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
              if (stockHistory?.transactions) {
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
                a.download = `stock-history-${selectedDate}.csv`;
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
  );
}