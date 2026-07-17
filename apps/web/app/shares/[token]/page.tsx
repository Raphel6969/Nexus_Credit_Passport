'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NeuCard } from '../../../components/ui/NeuCard';
import { NeuButton } from '../../../components/ui/NeuButton';
import { NeuGauge } from '../../../components/ui/NeuGauge';
import { ScoreDriverList } from '../../../components/ui/ScoreDriverList';
import { resolveShareToken, type ScoreData } from '../../../lib/api';

interface ShareResponse {
  business_name: string;
  scope: 'SCORE_ONLY' | 'FULL_PROFILE' | 'SNAPSHOT';
  score_data: ScoreData;
  expires_at?: string;
  shared_at?: string;
  note?: string;
}

function ShareResolverContent() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [data, setData] = useState<ShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    resolveShareToken(token)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neu-surface text-neu-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-5xl text-brand-teal">
          sync
        </span>
        <p className="text-sm">Resolving credit passport...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neu-surface p-6">
        <NeuCard className="max-w-md text-center" padding="p-10">
          <span className="material-symbols-outlined mb-4 block text-5xl text-neu-error">
            lock_open
          </span>
          <h2 className="mb-2 text-xl font-bold text-neu-on-surface">
            Access Revoked or Expired
          </h2>
          <p className="mb-6 text-sm text-neu-on-surface-variant">
            {error || 'This share link could not be resolved.'}
          </p>
          <NeuButton onClick={() => router.push('/login')}>Go to Portal</NeuButton>
        </NeuCard>
      </div>
    );
  }

  const { business_name, scope, score_data, expires_at, shared_at, note } = data;
  const hasDrivers =
    (scope === 'FULL_PROFILE' || scope === 'SNAPSHOT') &&
    score_data?.drivers &&
    score_data.drivers.length > 0;

  const scopeLabel =
    scope === 'SCORE_ONLY'
      ? 'Score Only'
      : scope === 'FULL_PROFILE'
        ? 'Full Profile'
        : 'One-Time Snapshot';

  return (
    <div className="relative min-h-screen overflow-hidden bg-neu-surface py-10 px-4">
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-brand-teal/5 blur-[100px]" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[400px] w-[400px] rounded-full bg-brand-gold/5 blur-[100px]" />

      <div className="relative mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between rounded-2xl bg-neu-surface p-6 shadow-neu-raised">
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Nexus Credit Passport</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neu-on-surface-variant">
              Secure Lender Verification
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neu-on-surface-variant">
            <span className="material-symbols-outlined text-brand-teal">verified_user</span>
            Lender View
          </div>
        </header>

        <NeuCard className="rounded-3xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-teal">
                Shared Profile
              </span>
              <h2 className="text-2xl font-bold text-neu-on-surface md:text-3xl">
                {business_name}
              </h2>
              <p className="mt-1 text-sm text-neu-on-surface-variant">
                {scope === 'SNAPSHOT'
                  ? 'One-time secure snapshot'
                  : `Active ${scopeLabel.toLowerCase()} sharing token`}
              </p>
            </div>
            <span className="shrink-0 rounded-xl bg-neu-surface px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-teal shadow-neu-inset-sm">
              {scopeLabel}
            </span>
          </div>
        </NeuCard>

        <NeuCard className="flex flex-col items-center rounded-3xl py-10">
          <NeuGauge
            score={score_data?.score ?? 0}
            confidence={score_data?.confidence ?? 'HIGH'}
            modelVersion={score_data?.model_version}
            size={280}
          />
        </NeuCard>

        {hasDrivers && (
          <NeuCard className="rounded-3xl">
            <div className="mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-brand-teal">
                analytics
              </span>
              <h3 className="text-lg font-bold text-neu-on-surface">Verified Score Drivers</h3>
            </div>
            <ScoreDriverList drivers={score_data.drivers ?? []} />
          </NeuCard>
        )}

        <NeuCard className="space-y-3 text-center text-xs text-neu-on-surface-variant">
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm text-brand-teal">lock</span>
            <span>Cryptographically signed via Nexus Consent Protocol</span>
          </div>
          {note && <p className="italic text-brand-gold">{note}</p>}
          {expires_at && (
            <p>
              Expires on{' '}
              <strong className="text-neu-on-surface">
                {new Date(expires_at).toLocaleString()}
              </strong>
            </p>
          )}
          {shared_at && (
            <p>
              Shared on{' '}
              <strong className="text-neu-on-surface">
                {new Date(shared_at).toLocaleString()}
              </strong>
            </p>
          )}
        </NeuCard>
      </div>
    </div>
  );
}

export default function ShareResolverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neu-surface">
          <span className="material-symbols-outlined animate-spin text-5xl text-brand-teal">
            sync
          </span>
        </div>
      }
    >
      <ShareResolverContent />
    </Suspense>
  );
}
