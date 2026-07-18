'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NeuButton } from './NeuButton';

interface NeuTopBarProps {
  title: string;
  businessId?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  icon: string;
  iconColor: string;
  unread: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Score Refreshed',
    message: 'Your MSME credit score has been successfully computed as 712 (Good).',
    time: '2 hrs ago',
    icon: 'analytics',
    iconColor: 'text-brand-teal',
    unread: true,
  },
  {
    id: '2',
    title: 'GST Returns Synced',
    message: 'GSTN filing history verified for FY 2025-26.',
    time: '1 day ago',
    icon: 'receipt_long',
    iconColor: 'text-brand-teal',
    unread: true,
  },
  {
    id: '3',
    title: 'Share Link Active',
    message: 'A FULL_PROFILE share link was generated for business verification.',
    time: '2 days ago',
    icon: 'link',
    iconColor: 'text-brand-gold',
    unread: false,
  },
];

export function NeuTopBar({ title, businessId }: NeuTopBarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const hasUnread = notifications.some((n) => n.unread);

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

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
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setIsOpen(!isOpen)}
            className="
              relative flex h-10 w-10 items-center justify-center rounded-full
              bg-neu-surface text-neu-on-surface-variant shadow-neu-raised-sm
              transition-all hover:text-brand-teal active:shadow-neu-inset-sm
            "
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {hasUnread && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(15,158,143,0.6)] animate-pulse" />
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-14 w-80 rounded-2xl bg-neu-surface p-4 shadow-neu-raised z-50 border border-neu-outline-variant/40 animate-slide-up">
              <div className="mb-3 flex items-center justify-between border-b border-neu-outline-variant/40 pb-2">
                <h4 className="text-sm font-bold text-brand-navy">Notifications</h4>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-brand-teal hover:text-brand-teal/80 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-neu-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl mb-1 opacity-45">notifications_off</span>
                    <p className="text-xs font-medium">All caught up!</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleMarkAsRead(n.id)}
                      className={`
                        w-full flex gap-3 rounded-xl p-2.5 transition-all text-left
                        ${n.unread ? 'bg-neu-surface-low/50 shadow-neu-inset-sm' : 'hover:bg-neu-surface-low/30'}
                      `}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neu-surface shadow-neu-raised-xs">
                        <span className={`material-symbols-outlined text-lg ${n.iconColor}`}>
                          {n.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-neu-on-surface">{n.title}</p>
                          <span className="shrink-0 text-[10px] text-neu-on-surface-variant">{n.time}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-neu-on-surface-variant line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                      {n.unread && (
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <NeuButton variant="ghost" size="sm" onClick={() => router.push('/login')}>
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="hidden sm:inline">Sign Out</span>
        </NeuButton>
      </div>
    </header>
  );
}
