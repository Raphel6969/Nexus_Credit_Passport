import React from 'react';

interface NeuCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  inset?: boolean;
}

export function NeuCard({
  children,
  className = '',
  padding = 'p-6',
  inset = false,
}: NeuCardProps) {
  return (
    <div
      className={`
        rounded-2xl bg-neu-surface
        ${inset ? 'shadow-neu-inset' : 'shadow-neu-raised'}
        ${padding} ${className}
      `}
    >
      {children}
    </div>
  );
}
