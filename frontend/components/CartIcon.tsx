'use client';

import Link from 'next/link';
import { useCart } from './CartContext';

export default function CartIcon() {
  const { getTotalItems } = useCart();
  const totalItems = getTotalItems();

  return (
    <Link href="/customer/cart" className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--primary)] hover:text-white transition-all duration-200">
        <span className="text-xl">🛒</span>
        <span className="hidden sm:inline">Cart</span>
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-pulse">
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        )}
      </div>
    </Link>
  );
}