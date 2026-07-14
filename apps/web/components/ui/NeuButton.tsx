import React from 'react';

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function NeuButton({ children, className = '', variant = 'primary', ...props }: NeuButtonProps) {
  let textColor = 'text-white';
  if (variant === 'primary') textColor = 'text-brand-teal';
  if (variant === 'secondary') textColor = 'text-gray-300';
  if (variant === 'danger') textColor = 'text-red-400';

  return (
    <button
      className={`
        bg-brand-navy rounded-xl px-6 py-3 font-semibold transition-all duration-200
        shadow-neu-up hover:shadow-neu-down active:shadow-neu-down active:scale-95
        ${textColor} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
