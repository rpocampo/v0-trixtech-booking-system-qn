'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  serviceType: string;
  category: string;
  image?: string;
  maxOrder?: number;
  availableQuantity?: number;
  isAvailable?: boolean;
  lastStockCheck?: number; // timestamp of last stock validation
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  isInCart: (id: string) => boolean;
  getItemQuantity: (id: string) => number;
  validateStockAvailability: () => Promise<{ valid: boolean; issues: string[] }>;
  refreshStockData: () => Promise<void>;
  canCheckout: () => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('trixtech_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        // Failed to load cart, start with empty cart
        setItems([]);
      }
    }
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem('trixtech_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const quantity = newItem.quantity || 1;

    setItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === newItem.id);

      if (existingItem) {
        // For services, don't increase quantity - keep at 1
        if (existingItem.serviceType === 'service') {
          return currentItems; // No change
        }
        // Update quantity of existing equipment/supply item
        return currentItems.map(item =>
          item.id === newItem.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, item.maxOrder || item.quantity + quantity) }
            : item
        );
      } else {
        // For services, always add with quantity 1
        const finalQuantity = newItem.serviceType === 'service' ? 1 : quantity;
        return [...currentItems, { ...newItem, quantity: finalQuantity }];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }

    setItems(currentItems =>
      currentItems.map(item => {
        if (item.id === id) {
          // For services, quantity is always 1
          if (item.serviceType === 'service') {
            return { ...item, quantity: 1 };
          }
          // For equipment/supply, allow quantity changes within limits
          return { ...item, quantity: Math.min(quantity, item.maxOrder || quantity) };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const isInCart = (id: string) => {
    return items.some(item => item.id === id);
  };

  const getItemQuantity = (id: string) => {
    const item = items.find(item => item.id === id);
    return item ? item.quantity : 0;
  };

  const validateStockAvailability = async (): Promise<{ valid: boolean; issues: string[] }> => {
    const issues: string[] = [];
    let valid = true;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        issues.push('Please log in to validate stock availability');
        return { valid: false, issues };
      }

      // Check each item in cart
      for (const item of items) {
        try {
          const response = await fetch(`http://localhost:5000/api/services/${item.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const serviceData = await response.json();
            if (serviceData.success) {
              const service = serviceData.service;

              // Check if service is available
              if (!service.isAvailable) {
                issues.push(`${item.name} is no longer available`);
                valid = false;
              }

              // Check stock for equipment/supply items
              if ((service.serviceType === 'equipment' || service.serviceType === 'supply') &&
                  service.quantity !== undefined) {
                if (service.quantity === 0) {
                  issues.push(`${item.name} is out of stock`);
                  valid = false;
                } else if (service.quantity < item.quantity) {
                  issues.push(`Only ${service.quantity} ${item.name} available (you have ${item.quantity} in cart)`);
                  valid = false;
                }
              }
            }
          }
        } catch (error) {
          issues.push(`Failed to check availability for ${item.name}`);
          valid = false;
        }
      }
    } catch (error) {
      issues.push('Failed to validate stock availability');
      valid = false;
    }

    return { valid, issues };
  };

  const refreshStockData = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const updatedItems = await Promise.all(
        items.map(async (item) => {
          try {
            const response = await fetch(`http://localhost:5000/api/services/${item.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
              const serviceData = await response.json();
              if (serviceData.success) {
                const service = serviceData.service;
                return {
                  ...item,
                  isAvailable: service.isAvailable,
                  availableQuantity: service.quantity,
                  lastStockCheck: Date.now(),
                };
              }
            }
          } catch (error) {
            console.error(`Failed to refresh stock data for ${item.name}:`, error);
          }
          return item;
        })
      );

      setItems(updatedItems);
    } catch (error) {
      console.error('Failed to refresh stock data:', error);
    }
  };

  const canCheckout = (): boolean => {
    // Basic validation - check if all items have valid quantities and are available
    return items.length > 0 && items.every(item =>
      item.quantity > 0 &&
      item.isAvailable !== false &&
      (item.availableQuantity === undefined || item.availableQuantity >= item.quantity)
    );
  };

  const value: CartContextType = {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    isInCart,
    getItemQuantity,
    validateStockAvailability,
    refreshStockData,
    canCheckout,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};