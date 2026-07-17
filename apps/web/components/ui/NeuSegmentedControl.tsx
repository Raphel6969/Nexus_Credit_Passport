'use client';

import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface NeuSegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function NeuSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: NeuSegmentedControlProps<T>) {
  return (
    <div
      className={`flex gap-1 rounded-2xl bg-neu-surface p-1.5 shadow-neu-inset ${className}`}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`
              flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-200
              ${active
                ? 'bg-neu-surface text-brand-teal shadow-neu-raised-sm'
                : 'text-neu-on-surface-variant hover:text-neu-on-surface'
              }
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
