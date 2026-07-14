'use client';
import React from 'react';

interface NeuToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function NeuToggle({ checked, onChange, label }: NeuToggleProps) {
  return (
    <div className="flex items-center space-x-4">
      {label && <span className="text-sm font-medium text-gray-300">{label}</span>}
      <button
        type="button"
        className={`
          relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none
          ${checked ? 'bg-brand-navy shadow-neu-down' : 'bg-brand-navy shadow-neu-down'}
        `}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`
            inline-block h-6 w-6 transform rounded-full transition-transform duration-200 ease-in-out
            bg-brand-navy shadow-neu-up-sm
            ${checked ? 'translate-x-9 shadow-[0_0_10px_#0F9E8F]' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
