'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { NeuButton } from './NeuButton';

interface NeuTopBarProps {
  title: string;
  businessId?: string;
}

export function NeuTopBar({ title }: NeuTopBarProps) {
  const router = useRouter();

  return (
    <header
      className="
        fixed left-72 right-0 top-0 z-40 flex h-20 items-center justify-between
        bg-neu-surface/90 px-8 backdrop-blur-sm shadow-neu-topbar
      "
      aria-label="Top application bar"
    >
      <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="
            flex h-10 w-10 items-center justify-center rounded-full
            bg-neu-surface text-neu-on-surface-variant shadow-neu-raised-sm
            transition-all hover:text-brand-teal active:shadow-neu-inset-sm
          "
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
        </button>

        <NeuButton variant="ghost" size="sm" onClick={() => router.push('/login')}>
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="hidden sm:inline">Sign Out</span>
        </NeuButton>
      </div>
    </header>
  );
}
