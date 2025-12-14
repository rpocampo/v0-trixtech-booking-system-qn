'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../../components/CartContext';
import { useSocket } from '../../../components/SocketProvider';

interface EquipmentRecommendation {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  serviceType: string;
  image?: string;
  quantity?: number;
}

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
    canCheckout,
    addToCart
  } = useCart();

  const [isProcessing, setIsProcessing] = useState(false);
  const [stockValidationIssues, setStockValidationIssues] = useState<string[]>([]);
  const [isValidatingStock, setIsValidatingStock] = useState(false);
  const [lastStockUpdate, setLastStockUpdate] = useState<Date | null>(null);
  const [scheduledItems, setScheduledItems] = useState<{ [key: string]: { date: string; notes: string } }>({});
  const [equipmentRecommendations, setEquipmentRecommendations] = useState<EquipmentRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

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

  // Fetch equipment recommendations when cart has services
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (items.length === 0) {
        setEquipmentRecommendations([]);
        return;
      }

      setLoadingRecommendations(true);
      try {
        const serviceIds = items.map(item => item.id).join(',');
        const response = await fetch(`http://localhost:5000/api/analytics/equipment-recommendations?serviceIds=${serviceIds}`);
        const data = await response.json();
        if (data.success) {
          // Filter out equipment already in cart
          const cartEquipmentIds = items
            .filter(item => item.serviceType === 'equipment')
            .map(item => item.id);
          const filteredRecommendations = data.recommendations.filter(
            (rec: EquipmentRecommendation) => !cartEquipmentIds.includes(rec._id)
          );
          setEquipmentRecommendations(filteredRecommendations);
        }
      } catch (error) {
        console.error('Failed to fetch equipment recommendations:', error);
        setEquipmentRecommendations([]);
      } finally {
        setLoadingRecommendations(false);
      }
    };

    fetchRecommendations();
  }, [items]);

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

  const handleAddRecommendation = (recommendation: EquipmentRecommendation) => {
    addToCart({
      id: recommendation._id,
      name: recommendation.name,
      price: recommendation.price,
      serviceType: recommendation.serviceType,
      category: recommendation.category,
      image: recommendation.image,
      maxOrder: recommendation.quantity,
      availableQuantity: recommendation.quantity,
    });
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
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
        <div className="text-center max-w-md w-full animate-scale-in">
          <div className="text-6xl sm:text-8xl mb-6 animate-float opacity-50">🛒</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-4 text-gradient-primary">Your Reservation is Empty</h1>
          <p className="text-[var(--muted)] mb-8 text-lg leading-relaxed">
            Add some equipments to your reservation to get started.
          </p>
          <Link href="/customer/services" className="btn-primary w-full sm:w-auto hover-lift animate-bounce-in">
            <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Browse Equipments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 animate-fade-in">
      {/* Real-time Stock Update Indicator */}
      {lastStockUpdate && (
        <div className="fixed top-4 right-4 z-50 card p-3 animate-slide-in flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-glow">
          <div className="animate-pulse">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-medium">Stock updated!</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-10 animate-slide-up">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--foreground)] mb-3 leading-tight text-gradient-primary">Reservation Cart</h1>
          <p className="text-lg text-[var(--muted)] flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {totalItems} {totalItems === 1 ? 'item' : 'items'} in your reservation
          </p>
        </div>
        <button
          onClick={handleClearCart}
          className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 self-start sm:self-auto hover-lift interactive-scale"
        >
          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear Reservation
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6 stagger-children">
          {items.map((item, index) => (
            <div key={item.id} className="card p-4 sm:p-6 hover-lift animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Item Image */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-lg sm:text-xl md:text-2xl self-center sm:self-auto flex-shrink-0">
                  {item.image ? (
                    <img
                      src={item.image.startsWith('/uploads/') ? `http://localhost:5000${item.image}` : item.image}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                      loading="lazy"
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
                <div className="flex-1 min-w-0">
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

                  {/* Quantity Display/Controls */}
                  <div className="flex items-center gap-3">
                    {(item.serviceType === 'equipment' || item.serviceType === 'supply') ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-gray-200 hover:bg-[var(--primary)] hover:text-white flex items-center justify-center text-sm font-semibold interactive-scale transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.maxOrder || 999}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                          className="input-field w-16 text-center"
                          aria-label="Quantity"
                        />
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-gray-200 hover:bg-[var(--primary)] hover:text-white flex items-center justify-center text-sm font-semibold interactive-scale transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={item.maxOrder ? item.quantity >= item.maxOrder : false}
                          aria-label="Increase quantity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        {item.maxOrder && (
                          <span className="text-xs text-[var(--muted)] bg-gray-100 px-2 py-1 rounded-full">
                            Max: {item.maxOrder}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="badge badge-primary">Qty: {item.quantity}</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Price and Actions */}
                <div className="flex flex-col sm:items-end gap-2 sm:gap-0">
                  <div className="text-xl sm:text-2xl font-bold text-[var(--primary)]">
                    ₱{isNaN(item.price) ? '0.00' : (item.price * item.quantity).toFixed(2)}
                  </div>
                  <div className="text-xs sm:text-sm text-[var(--muted)]">
                    ₱{isNaN(item.price) ? '0.00' : item.price.toFixed(2)} each
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-600 hover:text-red-700 text-sm underline self-start sm:self-end mt-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cart Summary */}
        <div className="lg:col-span-1 order-first lg:order-last animate-slide-in-right">
          <div className="card p-4 sm:p-6 sticky top-6 hover-lift">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Cart Summary
            </h2>

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


            <div className="space-y-4 animate-slide-up">
              <button
                onClick={handleCheckout}
                disabled={isProcessing || isValidatingStock || stockValidationIssues.length > 0 || !canCheckout()}
                className="w-full btn-primary py-4 text-lg font-semibold hover-lift disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isValidatingStock ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Validating Stock...
                  </>
                ) : isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : stockValidationIssues.length > 0 ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Issues Detected - Cannot Reserve
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Proceed to Reserved
                  </>
                )}
              </button>

              <Link
                href="/customer/services"
                className="w-full btn-secondary py-4 text-center block hover-lift flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Continue Browsing
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

      {/* Equipment Recommendations */}
      {equipmentRecommendations.length > 0 && (
        <div className="mt-12 animate-slide-up">
          <div className="card p-6 hover-lift">
            <h2 className="text-3xl font-bold text-[var(--foreground)] mb-4 flex items-center gap-3 text-gradient-primary">
              <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              Recommended Equipment
            </h2>
            <p className="text-[var(--muted)] mb-8 text-lg leading-relaxed">
              Enhance your event with these recommended equipment rentals that complement your selected services.
            </p>

            {loadingRecommendations ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent"></div>
                <span className="ml-3 text-[var(--muted)]">Loading recommendations...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(showAllRecommendations ? equipmentRecommendations : equipmentRecommendations.slice(0, 4)).map((rec) => (
                    <div key={rec._id} className="border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* Equipment Image */}
                      <div className="w-full h-24 rounded-lg bg-gradient-to-br from-[var(--primary-100)] to-[var(--accent)]/20 flex items-center justify-center text-2xl mb-3">
                        {rec.image ? (
                          <img
                            src={rec.image.startsWith('/uploads/') ? `http://localhost:5000${rec.image}` : rec.image}
                            alt={rec.name}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x80?text=EQUIP';
                            }}
                          />
                        ) : (
                          '🎪'
                        )}
                      </div>

                      {/* Equipment Details */}
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{rec.name}</h3>
                      <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2">{rec.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-[var(--primary)]">₱{rec.price}</span>
                        {rec.quantity && (
                          <span className="text-xs text-green-600">{rec.quantity} available</span>
                        )}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={() => handleAddRecommendation(rec)}
                        className="w-full btn-primary text-sm py-2"
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>

                {/* See More Button */}
                {equipmentRecommendations.length > 4 && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      {showAllRecommendations ? (
                        <>
                          <span>Show Less</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>See More Equipment ({equipmentRecommendations.length - 4} more)</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Continue Browsing Banner */}
      <div className="mt-16 card-gradient p-8 sm:p-12 text-center animate-scale-in hover-lift">
        <div className="max-w-4xl mx-auto">
          <div className="text-6xl mb-6 animate-float">🎪</div>
          <h3 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-6 text-gradient-primary">
            Need More Equipment?
          </h3>
          <p className="text-[var(--muted)] mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
            Browse our complete catalog of equipment rentals and professional services to make your event unforgettable.
          </p>
          <Link href="/customer/services" className="btn-primary hover-lift inline-flex items-center gap-2 text-lg px-8 py-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Browse All Equipment
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}