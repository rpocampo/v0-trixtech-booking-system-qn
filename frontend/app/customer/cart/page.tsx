'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../../components/CartContext';
import { useSocket } from '../../../components/SocketProvider';

export default function CartPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const {
    items,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    validateStockAvailability,
    refreshStockData,
    canCheckout
  } = useCart();

  const [isProcessing, setIsProcessing] = useState(false);
  const [stockValidationIssues, setStockValidationIssues] = useState<string[]>([]);
  const [isValidatingStock, setIsValidatingStock] = useState(false);
  const [lastStockUpdate, setLastStockUpdate] = useState<Date | null>(null);
  const [scheduledItems, setScheduledItems] = useState<{ [key: string]: { date: string; notes: string } }>({});

  // Auto-validate stock when cart changes
  useEffect(() => {
    if (items.length > 0) {
      const validateStock = async () => {
        setIsValidatingStock(true);
        try {
          const validation = await validateStockAvailability();
          setStockValidationIssues(validation.valid ? [] : validation.issues);
        } catch (error) {
          console.error('Stock validation failed:', error);
          setStockValidationIssues(['Failed to validate stock availability']);
        } finally {
          setIsValidatingStock(false);
        }
      };

      // Debounce validation to avoid too many API calls
      const timeoutId = setTimeout(validateStock, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setStockValidationIssues([]);
    }
  }, [items, validateStockAvailability]);

  // Real-time stock updates
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdate = (data: any) => {
      console.log('Cart: Inventory updated:', data);
      setLastStockUpdate(new Date());

      // Refresh stock data for cart items
      refreshStockData();

      // Re-validate stock if there were previous issues
      if (stockValidationIssues.length > 0) {
        validateStockAvailability().then(validation => {
          if (!validation.valid) {
            setStockValidationIssues(validation.issues);
          } else {
            setStockValidationIssues([]);
          }
        });
      }
    };

    socket.on('inventory-updated', handleInventoryUpdate);

    return () => {
      socket.off('inventory-updated', handleInventoryUpdate);
    };
  }, [socket, stockValidationIssues.length]);

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
      setScheduledItems({});
    }
  };


  const handleCheckout = async () => {
    if (items.length === 0) return;

    setIsProcessing(true);
    setStockValidationIssues([]);

    try {
      // Cart validation - no scheduling required here anymore

      // First, validate stock availability
      setIsValidatingStock(true);
      const validation = await validateStockAvailability();
      setIsValidatingStock(false);

      if (!validation.valid) {
        setStockValidationIssues(validation.issues);
        setIsProcessing(false);
        return;
      }

      // If validation passes, proceed with unified checkout
      router.push('/customer/checkout');
    } catch (error) {
      console.error('Checkout validation failed:', error);
      setStockValidationIssues(['Failed to validate cart. Please try again.']);
      setIsProcessing(false);
      setIsValidatingStock(false);
    }
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
      {/* Real-time Stock Update Indicator */}
      {lastStockUpdate && (
        <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Stock updated!</span>
        </div>
      )}

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
                    item.category === 'birthday' ? '🎂' :
                    item.category === 'funeral' ? '⚰️' : '⚙️'
                  )}
                </div>

                {/* Item Details */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-[var(--foreground)] mb-1">
                    {item.name}
                  </h3>
                  <p className="text-sm text-[var(--muted)] capitalize mb-2">
                    {item.category.replace('-', ' ')} • {item.serviceType}
                    {(item.serviceType === 'equipment' || item.serviceType === 'supply') && (
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        item.availableQuantity === undefined
                          ? 'bg-gray-100 text-gray-600'
                          : item.availableQuantity === 0
                            ? 'bg-red-100 text-red-600'
                            : item.availableQuantity < item.quantity
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-green-100 text-green-600'
                      }`}>
                        {item.availableQuantity === undefined
                          ? 'Checking stock...'
                          : item.availableQuantity === 0
                            ? 'Out of stock'
                            : item.availableQuantity < item.quantity
                              ? `Only ${item.availableQuantity} available`
                              : `${item.availableQuantity} available`
                        }
                      </span>
                    )}
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
                    ₱{isNaN(item.price) ? '0.00' : (item.price * item.quantity).toFixed(2)}
                  </div>
                  <div className="text-sm text-[var(--muted)] mb-4">
                    ₱{isNaN(item.price) ? '0.00' : item.price.toFixed(2)} each
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

            {/* Stock Validation Errors */}
            {stockValidationIssues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-semibold">Stock Issues Detected</span>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {stockValidationIssues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setStockValidationIssues([]);
                    refreshStockData();
                  }}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Refresh Stock Data
                </button>
              </div>
            )}

            <div className="space-y-4 mb-6">
               <div className="flex justify-between text-sm">
                 <span className="text-[var(--muted)]">Items ({totalItems}):</span>
                 <span className="font-semibold">₱{isNaN(totalPrice) ? '0.00' : totalPrice.toFixed(2)}</span>
               </div>

               {/* Add any additional fees here */}
               <div className="border-t pt-4">
                 <div className="flex justify-between text-lg font-bold">
                   <span>Total:</span>
                   <span className="text-[var(--primary)]">₱{isNaN(totalPrice) ? '0.00' : totalPrice.toFixed(2)}</span>
                 </div>
               </div>
             </div>


            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                disabled={isProcessing || isValidatingStock || stockValidationIssues.length > 0 || !canCheckout()}
                className="w-full btn-primary py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidatingStock
                  ? 'Validating Stock...'
                  : isProcessing
                    ? 'Processing...'
                    : stockValidationIssues.length > 0
                         ? 'Issues Detected - Cannot Checkout'
                         : 'Proceed to Checkout'
                }
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
                  <p className="font-semibold">Unified Checkout Process:</p>
                  <p>All items will be processed together. Schedule dates and times for each service in the next step.</p>
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