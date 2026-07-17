'use client';

import React from 'react';

interface NeuToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export function NeuToggle({ checked, onChange, label, id }: NeuToggleProps) {
  return (
    <div className="flex items-center gap-3">
      {label ? (
        <span className="text-sm font-medium text-neu-on-surface">{label}</span>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-8 w-14 shrink-0 items-center rounded-full
          bg-neu-surface transition-all duration-200
          ${checked ? 'shadow-neu-inset-sm' : 'shadow-neu-inset-sm'}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40
        `}
      >
        <span
          className={`
            inline-block h-6 w-6 rounded-full bg-neu-surface shadow-neu-raised-sm
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-7 shadow-neu-teal-glow' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
