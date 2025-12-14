'use client';

import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled,
    className,
    children,
    ...props
  }, ref) => {
    const baseClasses = [
      'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 ease-out',
      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-opacity-60',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:transform-none',
      'active:scale-[0.98] transform',
      'overflow-hidden',
      'select-none',
      'group',
      'backdrop-blur-sm',
    ];

    const variantClasses = {
      primary: [
        'bg-gradient-to-r from-[var(--primary)] via-[var(--primary)] to-[var(--primary-dark)] text-white',
        'hover:from-[var(--primary-dark)] hover:via-[var(--primary)] hover:to-[var(--primary)]',
        'hover:shadow-2xl hover:shadow-[var(--primary)]/30 hover:-translate-y-0.5',
        'focus:ring-[var(--primary)]',
        'border border-[var(--primary)]/80',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
        'before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700',
        'after:absolute after:inset-0 after:bg-gradient-to-r after:from-[var(--primary-light)]/20 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-300',
      ],
      secondary: [
        'bg-white/90 text-[var(--primary)] border-2 border-[var(--primary)]/80',
        'hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)]',
        'hover:shadow-xl hover:shadow-[var(--primary)]/25 hover:-translate-y-0.5',
        'focus:ring-[var(--primary)]',
        'backdrop-blur-md',
      ],
      success: [
        'bg-gradient-to-r from-[var(--success)] via-[var(--success)] to-[var(--success-dark)] text-white',
        'hover:from-[var(--success-dark)] hover:via-[var(--success)] hover:to-[var(--success)]',
        'hover:shadow-2xl hover:shadow-[var(--success)]/30 hover:-translate-y-0.5',
        'focus:ring-[var(--success)]',
        'border border-[var(--success)]/80',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
        'before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700',
      ],
      warning: [
        'bg-gradient-to-r from-[var(--warning)] via-[var(--warning)] to-[var(--warning-dark)] text-white',
        'hover:from-[var(--warning-dark)] hover:via-[var(--warning)] hover:to-[var(--warning)]',
        'hover:shadow-2xl hover:shadow-[var(--warning)]/30 hover:-translate-y-0.5',
        'focus:ring-[var(--warning)]',
        'border border-[var(--warning)]/80',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
        'before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700',
      ],
      danger: [
        'bg-gradient-to-r from-[var(--danger)] via-[var(--danger)] to-[var(--danger-dark)] text-white',
        'hover:from-[var(--danger-dark)] hover:via-[var(--danger)] hover:to-[var(--danger)]',
        'hover:shadow-2xl hover:shadow-[var(--danger)]/30 hover:-translate-y-0.5',
        'focus:ring-[var(--danger)]',
        'border border-[var(--danger)]/80',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
        'before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700',
      ],
      ghost: [
        'bg-transparent/50 text-[var(--primary)] border border-[var(--border)]/60',
        'hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] hover:border-[var(--primary)]/40 hover:shadow-lg',
        'focus:ring-[var(--primary)]',
        'backdrop-blur-sm',
      ],
      outline: [
        'bg-white/80 text-[var(--foreground)] border border-[var(--border)]/60',
        'hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]/60 hover:text-[var(--primary)] hover:shadow-lg',
        'focus:ring-[var(--primary)]',
        'backdrop-blur-md',
      ],
    };

    const sizeClasses = {
      sm: ['px-3 py-1.5 text-sm gap-1.5 min-h-[36px]'],
      md: ['px-4 py-2.5 text-sm gap-2 min-h-[44px]'],
      lg: ['px-6 py-3 text-base gap-2.5 min-h-[52px]'],
      xl: ['px-8 py-4 text-lg gap-3 min-h-[60px]'],
    };

    const widthClass = fullWidth ? 'w-full' : '';

    const classes = [
      ...baseClasses,
      ...variantClasses[variant],
      ...sizeClasses[size],
      widthClass,
      className
    ].filter(Boolean).join(' ');

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={classes}
        disabled={isDisabled}
        {...props}
      >
        {/* Enhanced ripple effect */}
        <span className="absolute inset-0 overflow-hidden rounded-xl">
          <span className="absolute inset-0 bg-white/30 scale-0 rounded-full transition-all duration-500 ease-out opacity-0 group-active:scale-150 group-active:opacity-100"></span>
        </span>

        {/* Subtle glow effect */}
        <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>

        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}

        {/* Icon and content */}
        <span className="relative z-10 flex items-center gap-2 transition-transform duration-200 group-active:scale-95">
          {icon && iconPosition === 'left' && !loading && (
            <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">{icon}</span>
          )}
          <span className={`transition-opacity duration-200 ${loading ? 'opacity-70' : ''}`}>{children}</span>
          {icon && iconPosition === 'right' && !loading && (
            <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">{icon}</span>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;