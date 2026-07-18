'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/score-board', icon: 'dashboard', label: 'Score Board' },
  { href: '/share-history', icon: 'history', label: 'Share History' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

interface NeuSidebarProps {
  businessId?: string;
}

export function NeuSidebar({ businessId }: NeuSidebarProps) {
  const pathname = usePathname();

  const buildHref = (base: string) =>
    businessId ? `${base}?businessId=${encodeURIComponent(businessId)}` : base;

  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col gap-8 bg-neu-surface px-6 pb-6 pt-8 shadow-neu-raised"
      aria-label="Main navigation"
    >
      <div className="select-none">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neu-surface shadow-neu-raised-sm">
            <span
              className="material-symbols-outlined text-xl text-brand-teal"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield_person
            </span>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-brand-navy">
              Nexus Credit Passport
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant">
              MSME Fintech
            </p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              className={`
                flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-neu-surface text-brand-teal shadow-neu-inset-sm'
                  : 'text-neu-on-surface-variant hover:text-brand-teal hover:shadow-neu-raised-xs'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-neu-outline-variant pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neu-surface shadow-neu-raised-sm">
          <span
            className="material-symbols-outlined text-xl text-brand-teal"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            corporate_fare
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neu-on-surface">
            {businessId ?? 'MSME Admin'}
          </p>
          <p className="truncate text-xs text-neu-on-surface-variant">Business Owner</p>
        </div>
      </div>
    </aside>
  );
}
