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

    try {
      const data = await mintShareToken(businessId, SCOPE_MAP[shareScope]);
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
    return (
      <AppShell title="Overview" businessId={businessId}>
        <ErrorState
          message={error}
          onRetry={() => router.push('/login')}
          retryLabel="Back to Login"
        />
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

            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-neu-surface-low/50 p-4 shadow-neu-inset-sm">
              <span className="material-symbols-outlined text-lg text-neu-on-surface-variant">
                lock
              </span>
              <p className="text-xs leading-relaxed text-neu-on-surface-variant">
                {shareScope === 'snapshot'
                  ? 'One-time snapshot — link expires immediately after first view.'
                  : 'Link expires in 72 hours. Revoke anytime from Share History.'}
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
