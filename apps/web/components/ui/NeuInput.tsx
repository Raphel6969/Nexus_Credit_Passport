import React from 'react';

interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  label?: string;
}

export function NeuInput({ icon, label, className = '', id, ...props }: NeuInputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label
          htmlFor={id}
          className="ml-1 text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant"
        >
          {label}
        </label>
      ) : null}
      <div className="relative neu-inset-focus rounded-xl">
        {icon ? (
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-neu-on-surface-variant">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          className={`
            h-14 w-full rounded-xl bg-neu-surface text-base text-neu-on-surface
            shadow-neu-inset placeholder:text-neu-on-surface-variant/60
            focus:outline-none
            ${icon ? 'pl-12 pr-4' : 'px-4'}
            ${className}
          `}
          {...props}
        />
      </div>
    </div>
  );
}
