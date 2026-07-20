'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NeuButton } from '../../components/ui/NeuButton';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuInput } from '../../components/ui/NeuInput';
import { triggerIngest } from '../../lib/api';

const DEMO_BUSINESS_ID =
  process.env.NEXT_PUBLIC_BUSINESS_ID || '00000000-0000-0000-0000-000000000001';

const securityBadges = [
  { icon: 'security', label: '256-bit AES' },
  { icon: 'account_balance', label: 'RBI AA Framework' },
  { icon: 'verified_user', label: 'Consent-Based' },
];

export default function LoginPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState(DEMO_BUSINESS_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (id: string) => {
    const trimmedBusinessId = id.trim();
    if (!trimmedBusinessId) {
      setError('Please enter a business ID to continue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await triggerIngest(trimmedBusinessId);
      router.replace(`/dashboard?businessId=${encodeURIComponent(trimmedBusinessId)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'We could not start the consent flow.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSubmit(businessId);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neu-surface px-5 py-12">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-teal/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-gold/5 blur-3xl" />

      <div className="relative w-full max-w-md animate-slide-up">
        <NeuCard padding="p-8 sm:p-10" className="rounded-[2rem]">
          <header className="mb-8 text-center">
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-neu-surface shadow-neu-raised-sm">
              <span
                className="material-symbols-outlined text-4xl text-brand-teal"
                style={{ fontVariationSettings: 'FILL 1' }}
              >
                shield_person
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">
              Nexus Credit Passport
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-neu-on-surface-variant">
              Portable credit identity for MSMEs
            </p>
          </header>

          <form onSubmit={handleFormSubmit} className="flex w-full flex-col gap-6">
            <NeuInput
              id="businessId"
              label="Business ID"
              icon="corporate_fare"
              type="text"
              autoComplete="off"
              value={businessId}
              onChange={(event) => {
                setBusinessId(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your GSTIN, PAN, or UUID"
            />

            {error ? (
              <p className="rounded-xl bg-neu-error-light px-4 py-3 text-sm text-neu-error">
                {error}
              </p>
            ) : null}

            <NeuButton
              type="submit"
              disabled={isSubmitting || !businessId.trim()}
              size="lg"
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  Linking via Account Aggregator...
                </>
              ) : (
                <>
                  Link Account &amp; Continue
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </NeuButton>
          </form>

          <footer className="mt-8 flex items-center justify-center gap-2 text-center">
            <span className="material-symbols-outlined text-base text-brand-teal">lock</span>
            <p className="text-xs text-neu-on-surface-variant">
              Secure, revocable consent-based data linking
            </p>
          </footer>
        </NeuCard>

        <div className="mt-8 flex items-center justify-center gap-8 opacity-60">
          {securityBadges.map((badge) => (
            <div key={badge.label} className="flex flex-col items-center gap-1 text-center">
              <span className="material-symbols-outlined text-2xl text-brand-navy">
                {badge.icon}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-neu-on-surface-variant">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
