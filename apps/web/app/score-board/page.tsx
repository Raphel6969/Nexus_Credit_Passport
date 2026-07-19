'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell, LoadingState, ErrorState } from '../../components/layout/AppShell';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';
import { NeuGauge } from '../../components/ui/NeuGauge';
import { NeuSegmentedControl } from '../../components/ui/NeuSegmentedControl';
import { ScoreDriverList } from '../../components/ui/ScoreDriverList';
import {
  fetchScore,
  mintShareToken,
  type ScoreData,
} from '../../lib/api';

type ShareScope = 'score' | 'profile' | 'snapshot';

const SCOPE_OPTIONS = [
  { value: 'score' as const, label: 'Score Only' },
  { value: 'profile' as const, label: 'Full Profile' },
  { value: 'snapshot' as const, label: 'Snapshot' },
];

const SCOPE_MAP: Record<ShareScope, 'SCORE_ONLY' | 'FULL_PROFILE' | 'SNAPSHOT'> = {
  score: 'SCORE_ONLY',
  profile: 'FULL_PROFILE',
  snapshot: 'SNAPSHOT',
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [shareScope, setShareScope] = useState<ShareScope>('score');
  const [mintingToken, setMintingToken] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Expiry: user picks a datetime or checks "never expires"
  const [neverExpires, setNeverExpires] = useState(false);
  const [expiryDatetime, setExpiryDatetime] = useState('');

  useEffect(() => {
    if (!businessId) {
      router.push('/login');
      return;
    }

    fetchScore(businessId)
      .then(setScoreData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [businessId, router]);

  const handleMintToken = async () => {
    if (!businessId) return;
    setMintingToken(true);
    setShareLink('');
    setCopied(false);
    setError('');

    try {
      let ttlHours: number | null = null;
      if (!neverExpires && expiryDatetime) {
        // Parse date (e.g. YYYY-MM-DD) and set hours to end of day (23:59:59) so it expires then
        const chosenDate = new Date(expiryDatetime + 'T23:59:59');
        const diffMs = chosenDate.getTime() - Date.now();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours <= 0) {
          setError('Expiry date must be in the future.');
          setMintingToken(false);
          return;
        }
        ttlHours = diffHours;
      }
      // neverExpires=true OR no datetime set → ttlHours stays null → backend stores expires_at=null
      const data = await mintShareToken(businessId, SCOPE_MAP[shareScope], ttlHours);
      setShareLink(`${window.location.origin}/shares/${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mint token');
    } finally {
      setMintingToken(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!businessId) return null;

  if (loading) {
    return (
      <AppShell title="Overview" businessId={businessId}>
        <LoadingState message="Loading your credit passport..." />
      </AppShell>
    );
  }

  if (error && !scoreData) {
    const isNoData = error.includes('NO_DATA') || error.includes('No transaction data');
    return (
      <AppShell title="Overview" businessId={businessId}>
        <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl bg-neu-surface p-10 text-center shadow-neu-raised">
          <span className="material-symbols-outlined mb-4 block text-5xl text-neu-error">
            {isNoData ? 'search_off' : 'error'}
          </span>
          <h2 className="mb-2 text-lg font-bold text-neu-on-surface">
            {isNoData ? 'No Data Found for This Business' : 'Something went wrong'}
          </h2>
          <p className="mb-2 text-sm text-neu-on-surface-variant">
            {isNoData
              ? `Business ID "${businessId?.slice(0, 8)}..." has no financial data linked yet. This usually means the ID is not in the demo database.`
              : error}
          </p>
          {isNoData && (
            <p className="mb-6 rounded-xl bg-brand-teal/5 px-4 py-3 text-xs text-brand-teal">
              💡 Use the pre-seeded demo account: <br />
              <code className="font-mono font-bold">00000000-0000-0000-0000-000000000001</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="rounded-xl bg-neu-surface px-6 py-3 text-sm font-semibold text-brand-teal shadow-neu-raised active:shadow-neu-inset"
          >
            Back to Login
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Overview" businessId={businessId}>
      <div className="mx-auto max-w-5xl space-y-12">
        {/* Score gauge hero */}
        <section className="flex justify-center py-6">
          <NeuGauge
            score={scoreData?.score ?? 0}
            confidence={scoreData?.confidence ?? 'HIGH'}
            modelVersion={scoreData?.model_version}
          />
        </section>

        {/* Bento panels */}
        <section className="grid grid-cols-1 gap-8 pb-8 lg:grid-cols-2">
          <NeuCard className="rounded-3xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-neu-on-surface">
                <span className="material-symbols-outlined text-brand-teal">analytics</span>
                Score Drivers
              </h3>
              <span className="rounded-full bg-brand-teal/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal">
                SHAP Explainability
              </span>
            </div>
            <ScoreDriverList drivers={scoreData?.drivers ?? []} />
          </NeuCard>

          <NeuCard className="flex flex-col rounded-3xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-gold">ios_share</span>
              <h3 className="text-lg font-semibold text-neu-on-surface">Share Passport</h3>
            </div>
            <p className="mb-5 text-sm text-neu-on-surface-variant">
              Select what to share with lenders, suppliers, or insurers. Links are
              revocable and time-limited.
            </p>

            <NeuSegmentedControl<ShareScope>
              options={SCOPE_OPTIONS}
              value={shareScope}
              onChange={setShareScope}
              className="mb-5"
            />

            {/* ── Link Expiry Picker ── */}
            {shareScope !== 'snapshot' && (
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neu-on-surface-variant">
                  Link Expiry
                </p>

                {/* Never-expires toggle */}
                <label className="mb-3 flex cursor-pointer items-center gap-2.5">
                  <span
                    onClick={() => setNeverExpires((v) => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                      neverExpires ? 'bg-brand-teal' : 'bg-neu-surface-low shadow-neu-inset-sm'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        neverExpires ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span className="text-xs text-neu-on-surface-variant">
                    Never expires <span className="text-neu-on-surface-variant/60">(revoke manually from Share History)</span>
                  </span>
                </label>

                {/* Date picker — shown only when not neverExpires */}
                {!neverExpires && (
                  <input
                    type="date"
                    value={expiryDatetime}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setExpiryDatetime(e.target.value)}
                    className="w-full rounded-xl bg-neu-surface-low px-3 py-2 text-xs text-neu-on-surface shadow-neu-inset-sm outline-none ring-1 ring-transparent focus:ring-brand-teal [color-scheme:dark]"
                  />
                )}
              </div>
            )}

            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-neu-surface-low/50 p-4 shadow-neu-inset-sm">
              <span className="material-symbols-outlined text-lg text-neu-on-surface-variant">
                lock
              </span>
              <p className="text-xs leading-relaxed text-neu-on-surface-variant">
                {shareScope === 'snapshot'
                  ? 'One-time snapshot — link expires immediately after first view.'
                  : neverExpires
                  ? 'Link never auto-expires — revoke it anytime from Share History.'
                  : expiryDatetime
                  ? `Link expires on ${new Date(expiryDatetime).toLocaleDateString(undefined, { dateStyle: 'medium' })}. Revoke anytime from Share History.`
                  : 'Pick an expiry date above, or enable "Never expires".'}
              </p>
            </div>

            <div className="mt-auto space-y-4">
              <NeuButton
                onClick={handleMintToken}
                disabled={mintingToken}
                className="w-full"
                size="lg"
              >
                {mintingToken ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">sync</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">link</span>
                    Generate Share Link
                  </>
                )}
              </NeuButton>

              {shareLink ? (
                <div className="rounded-2xl bg-neu-surface p-4 shadow-neu-inset-sm">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
                    Share link
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all text-xs text-brand-teal">{shareLink}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-label="Copy link"
                      className="shrink-0 rounded-lg p-2 text-neu-on-surface-variant shadow-neu-raised-xs transition-colors hover:text-brand-teal active:shadow-neu-inset-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {copied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </NeuCard>
        </section>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neu-surface" />}>
      <DashboardContent />
    </Suspense>
  );
}
