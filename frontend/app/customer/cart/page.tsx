'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../../components/CartContext';

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice
  } = useCart();

  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantity(id, newQuantity);
  };

  const handleRemoveItem = (id: string) => {
    if (confirm('Are you sure you want to remove this item from your cart?')) {
      removeFromCart(id);
    }
  };

  const handleClearCart = () => {
    if (confirm('Are you sure you want to clear your entire cart?')) {
      clearCart();
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) return;

    setIsProcessing(true);
    // For now, redirect to the first item's booking page
    // In a full implementation, this would create a bulk booking or checkout process
    const firstItem = items[0];
    router.push(`/customer/booking/${firstItem.id}`);
  };

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6 opacity-50">🛒</div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">Your Cart is Empty</h1>
          <p className="text-[var(--muted)] mb-8">
            Add some services to your cart to get started with your booking.
          </p>
          <Link href="/customer/services" className="btn-primary">
            Browse Services
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2">Shopping Cart</h1>
          <p className="text-[var(--muted)]">
            {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>
        <button
          onClick={handleClearCart}
          className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card p-6">
              <div className="flex items-center gap-4">
                {/* Item Image */}
                <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-2xl">
                  {item.image ? (
                    <img
                      src={item.image.startsWith('/uploads/') ? `http://localhost:5000${item.image}` : item.image}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/80x80?text=IMG';
                      }}
                    />
                  ) : (
                    item.category === 'party' ? '🎉' :
                    item.category === 'wedding' ? '💒' :
                    item.category === 'corporate' ? '🏢' :
                    item.category === 'equipment' ? '🎪' :
                    item.category === 'cleaning' ? '🧹' : '⚙️'
                  )}
                </div>

                {/* Item Details */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-1">
                    {item.name}
                  </h3>
                  <p className="text-sm text-[var(--muted)] capitalize mb-2">
                    {item.category.replace('-', ' ')} • {item.serviceType}
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-semibold"
                        disabled={item.quantity <= 1}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.maxOrder || 999}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                        className="w-16 text-center border rounded px-2 py-1"
                      />
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-semibold"
                        disabled={item.maxOrder ? item.quantity >= item.maxOrder : false}
                      >
                        +
                      </button>
                    </div>

                    {item.maxOrder && (
                      <span className="text-xs text-[var(--muted)]">
                        Max: {item.maxOrder}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price and Actions */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-[var(--primary)] mb-2">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </div>
                  <div className="text-sm text-[var(--muted)] mb-4">
                    ₱{item.price} each
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-600 hover:text-red-700 text-sm underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cart Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-6">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">Cart Summary</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Items ({totalItems}):</span>
                <span className="font-semibold">₱{totalPrice.toFixed(2)}</span>
              </div>

              {/* Add any additional fees here */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-[var(--primary)]">₱{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full btn-primary py-3 text-lg font-semibold"
              >
                {isProcessing ? 'Processing...' : 'Proceed to Booking'}
              </button>

              <Link
                href="/customer/services"
                className="w-full btn-secondary py-3 text-center block"
              >
                Continue Shopping
              </Link>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <span className="text-lg">ℹ️</span>
                <div>
                  <p className="font-semibold">Next Steps:</p>
                  <p>Select dates and times for your bookings after checkout.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Shopping Banner */}
      <div className="mt-12 card-gradient p-8 text-center">
        <h3 className="text-2xl font-bold text-[var(--foreground)] mb-4">
          Need More Services?
        </h3>
        <p className="text-[var(--muted)] mb-6 max-w-2xl mx-auto">
          Browse our complete catalog of event services, equipment rentals, and professional services to make your event unforgettable.
        </p>
        <Link href="/customer/services" className="btn-primary">
          Browse All Services →
        </Link>
      </div>
    </div>
  );
}