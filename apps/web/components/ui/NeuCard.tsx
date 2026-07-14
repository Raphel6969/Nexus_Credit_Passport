import React from 'react';

interface NeuCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export function NeuCard({ children, className = '', padding = 'p-6' }: NeuCardProps) {
  return (
    <div className={`bg-brand-navy rounded-2xl shadow-neu-up ${padding} ${className}`}>
      {children}
    </div>
  );
}
