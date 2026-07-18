'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell, LoadingState, ErrorState } from '../../components/layout/AppShell';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';
import {
  fetchShareHistory,
  revokeShareToken,
  type ShareToken,
} from '../../lib/api';

const SCOPE_LABELS: Record<string, string> = {
  SCORE_ONLY: 'Score Only',
  FULL_PROFILE: 'Full Profile',
  SNAPSHOT: 'One-Time Snapshot',
};

const SCOPE_ICONS: Record<string, string> = {
  SCORE_ONLY: 'analytics',
  FULL_PROFILE: 'person',
  SNAPSHOT: 'camera_alt',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      dateStyle: 'medium',
    });
  } catch {
    return dateStr;
  }
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false; // null = never expires
  return new Date(expiresAt) < new Date();
}

function getStatus(share: ShareToken): 'active' | 'expired' | 'revoked' {
  if (share.status === 'REVOKED') return 'revoked';
  if (share.status === 'EXPIRED') return 'expired';
  if (share.expires_at && isExpired(share.expires_at)) return 'expired';
  return 'active';
}

function ShareHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [shares, setShares] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const tokens = await fetchShareHistory(businessId);
      setShares(tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch share history.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      router.push('/login');
      return;
    }
    loadShares();
  }, [businessId, router, loadShares]);

  const handleRevoke = async (token: string) => {
    if (!businessId) return;
    setRevoking(token);
    try {
      await revokeShareToken(businessId, token);
      setShares((prev) =>
        prev.map((s) => (s.token === token ? { ...s, status: 'REVOKED' } : s))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke token.');
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = async (token: string) => {
    const link = `${window.location.origin}/shares/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const filteredShares = shares.filter((s) => {
    const status = getStatus(s);
    if (filter === 'ACTIVE') return status === 'active';
    if (filter === 'EXPIRED') return status !== 'active';
    return true;
  });

  if (!businessId) return null;

  return (
    <AppShell title="Share History" businessId={businessId}>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-neu-on-surface">Passport Share History</h2>
            <p className="mt-1 text-sm text-neu-on-surface-variant">
              All tokens minted for lenders and partners.
            </p>
          </div>
          <NeuButton
            variant="ghost"
            onClick={() => router.push(`/score-board?businessId=${encodeURIComponent(businessId)}`)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Mint New Token
          </NeuButton>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['ALL', 'ACTIVE', 'EXPIRED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`
                rounded-xl px-4 py-2 text-sm font-semibold transition-all
                ${filter === f
                  ? 'bg-neu-surface text-brand-teal shadow-neu-inset-sm'
                  : 'bg-neu-surface text-neu-on-surface-variant shadow-neu-raised-sm hover:text-brand-teal'
                }
              `}
            >
              {f === 'ALL' ? 'All Tokens' : f === 'ACTIVE' ? 'Active' : 'Expired / Revoked'}
            </button>
          ))}
        </div>

        {loading && <LoadingState message="Loading share history..." />}

        {!loading && error && (
          <ErrorState message={error} onRetry={loadShares} />
        )}

        {!loading && !error && filteredShares.length === 0 && (
          <NeuCard className="flex flex-col items-center py-16 text-center">
            <span className="material-symbols-outlined mb-4 text-5xl text-neu-on-surface-variant/40">
              history
            </span>
            <p className="text-sm text-neu-on-surface-variant">
              {filter === 'ALL'
                ? 'No tokens minted yet. Go to Score Board to create your first share link.'
                : `No ${filter.toLowerCase()} tokens found.`}
            </p>
          </NeuCard>
        )}

        {!loading && !error && filteredShares.length > 0 && (
          <div className="space-y-4">
            {filteredShares.map((share) => {
              const status = getStatus(share);
              return (
                <div
                  key={share.token}
                  className="flex flex-col gap-5 rounded-2xl bg-neu-surface p-6 shadow-neu-raised-sm md:flex-row md:items-center"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neu-surface shadow-neu-raised-sm">
                    <span className="material-symbols-outlined text-xl text-brand-teal">
                      {SCOPE_ICONS[share.scope] ?? 'token'}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-neu-on-surface">
                        {SCOPE_LABELS[share.scope] ?? share.scope}
                      </span>
                      <StatusBadge status={status} />
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-neu-on-surface-variant">
                      <span>Created: {formatDate(share.created_at)}</span>
                      <span>Expires: {share.expires_at ? formatDate(share.expires_at) : 'Never (revoke to deactivate)'}</span>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-neu-surface px-3 py-2 shadow-neu-inset-sm">
                      <code className="flex-1 truncate text-xs text-brand-teal">
                        {share.token}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(share.token)}
                        aria-label="Copy link"
                        className="text-neu-on-surface-variant transition-colors hover:text-brand-teal"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedToken === share.token ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {status === 'active' && (
                    <NeuButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevoke(share.token)}
                      disabled={revoking === share.token}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {revoking === share.token ? 'sync' : 'block'}
                      </span>
                      {revoking === share.token ? 'Revoking...' : 'Revoke'}
                    </NeuButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: 'active' | 'expired' | 'revoked' }) {
  const styles = {
    active: 'bg-brand-teal/10 text-brand-teal',
    expired: 'bg-brand-gold/10 text-brand-gold',
    revoked: 'bg-neu-error-light text-neu-error',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export default function ShareHistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neu-surface" />}>
      <ShareHistoryContent />
    </Suspense>
  );
}
