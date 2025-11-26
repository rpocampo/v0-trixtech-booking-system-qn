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
      'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      'active:scale-95 transform',
      'overflow-hidden',
      'select-none',
    ];

    const variantClasses = {
      primary: [
        'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white',
        'hover:from-[var(--primary-dark)] hover:to-[var(--primary)]',
        'hover:shadow-xl hover:shadow-[var(--primary)]/25',
        'focus:ring-[var(--primary)]',
        'border border-[var(--primary)]',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        'before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700',
      ],
      secondary: [
        'bg-white text-[var(--primary)] border-2 border-[var(--primary)]',
        'hover:bg-[var(--primary)] hover:text-white',
        'hover:shadow-lg hover:shadow-[var(--primary)]/20',
        'focus:ring-[var(--primary)]',
      ],
      success: [
        'bg-gradient-to-r from-[var(--success)] to-[var(--success-dark)] text-white',
        'hover:from-[var(--success-dark)] hover:to-[var(--success)]',
        'hover:shadow-xl hover:shadow-[var(--success)]/25',
        'focus:ring-[var(--success)]',
        'border border-[var(--success)]',
      ],
      warning: [
        'bg-gradient-to-r from-[var(--warning)] to-[var(--warning-dark)] text-white',
        'hover:from-[var(--warning-dark)] hover:to-[var(--warning)]',
        'hover:shadow-xl hover:shadow-[var(--warning)]/25',
        'focus:ring-[var(--warning)]',
        'border border-[var(--warning)]',
      ],
      danger: [
        'bg-gradient-to-r from-[var(--danger)] to-[var(--danger-dark)] text-white',
        'hover:from-[var(--danger-dark)] hover:to-[var(--danger)]',
        'hover:shadow-xl hover:shadow-[var(--danger)]/25',
        'focus:ring-[var(--danger)]',
        'border border-[var(--danger)]',
      ],
      ghost: [
        'bg-transparent text-[var(--primary)]',
        'hover:bg-[var(--primary-50)] hover:text-[var(--primary-dark)]',
        'focus:ring-[var(--primary)]',
      ],
      outline: [
        'bg-white text-[var(--foreground)] border border-[var(--border)]',
        'hover:bg-[var(--surface-hover)] hover:border-[var(--primary)] hover:text-[var(--primary)]',
        'focus:ring-[var(--primary)]',
      ],
    };

    const sizeClasses = {
      sm: ['px-3 py-1.5 text-sm gap-1.5 min-h-[32px]'],
      md: ['px-4 py-2.5 text-sm gap-2 min-h-[40px]'],
      lg: ['px-6 py-3 text-base gap-2.5 min-h-[48px]'],
      xl: ['px-8 py-4 text-lg gap-3 min-h-[56px]'],
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
        {/* Ripple effect container */}
        <span className="absolute inset-0 overflow-hidden rounded-xl">
          <span className="absolute inset-0 bg-white/20 scale-0 rounded-full transition-transform duration-500 button-ripple"></span>
        </span>

        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
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
        <span className="relative z-10 flex items-center gap-2">
          {icon && iconPosition === 'left' && !loading && (
            <span className="flex-shrink-0">{icon}</span>
          )}
          <span className={loading ? 'opacity-70' : ''}>{children}</span>
          {icon && iconPosition === 'right' && !loading && (
            <span className="flex-shrink-0">{icon}</span>
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
