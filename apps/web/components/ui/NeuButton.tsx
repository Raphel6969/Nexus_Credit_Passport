import React from 'react';

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function NeuButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: NeuButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  const variantClasses = {
    primary:
      'bg-neu-surface text-brand-teal shadow-neu-raised hover:shadow-neu-teal-glow active:shadow-neu-inset font-semibold',
    secondary:
      'bg-neu-surface text-brand-gold shadow-neu-raised active:shadow-neu-inset font-semibold',
    ghost:
      'bg-neu-surface text-neu-on-surface-variant shadow-neu-raised-sm active:shadow-neu-inset font-medium',
    danger:
      'bg-neu-surface text-neu-error shadow-neu-raised-sm active:shadow-neu-inset font-semibold',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl
        transition-all duration-200 active:scale-[0.98]
        disabled:cursor-not-allowed disabled:opacity-60
        ${sizeClasses[size]} ${variantClasses[variant]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
