import React from 'react';
import { NeuSidebar } from '../ui/NeuSidebar';
import { NeuTopBar } from '../ui/NeuTopBar';

interface AppShellProps {
  title: string;
  businessId?: string;
  children: React.ReactNode;
}

export function AppShell({ title, businessId, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-neu-surface font-sans text-neu-on-surface">
      <NeuSidebar businessId={businessId} />
      <NeuTopBar title={title} businessId={businessId} />
      <main className="ml-72 min-h-screen px-8 pb-12 pt-24 lg:px-12">{children}</main>
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-neu-on-surface-variant">
      <span className="material-symbols-outlined animate-spin text-5xl text-brand-teal">
        sync
      </span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Try Again' }: ErrorStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl bg-neu-surface p-10 text-center shadow-neu-raised">
      <span className="material-symbols-outlined mb-4 block text-4xl text-neu-error">
        error
      </span>
      <p className="mb-6 text-sm text-neu-on-surface-variant">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-neu-surface px-6 py-3 text-sm font-semibold text-brand-teal shadow-neu-raised active:shadow-neu-inset"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
