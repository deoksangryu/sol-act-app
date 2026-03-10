import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-200',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200',
  ghost: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}) => (
  <button
    className={`py-3 px-4 rounded-xl font-bold transition-colors ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        {children}
      </span>
    ) : children}
  </button>
);
