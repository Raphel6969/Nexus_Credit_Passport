'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';
import { NeuToggle } from '../../components/ui/NeuToggle';
import { fetchShareHistory, type ShareToken } from '../../lib/api';

interface ConsentPref {
  id: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
}

const DEFAULT_PREFS: ConsentPref[] = [
  {
    id: 'bank_statements',
    label: 'Bank Statements',
    description: 'Allow read access to the last 12 months of bank transactions.',
    icon: 'account_balance',
    enabled: true,
  },
  {
    id: 'gst_returns',
    label: 'GST Returns',
    description: 'Allow access to your GST filing history for income verification.',
    icon: 'receipt_long',
    enabled: true,
  },
  {
    id: 'itr_filing',
    label: 'ITR Filing',
    description: 'Provide access to your Income Tax Return data for scoring.',
    icon: 'description',
    enabled: false,
  },
  {
    id: 'udyam_registration',
    label: 'Udyam Registration',
    description: 'Share your MSME Udyam certificate for business verification.',
    icon: 'verified',
    enabled: true,
  },
  {
    id: 'third_party_sharing',
    label: 'Third-Party Sharing',
    description: 'Allow Nexus to share anonymized data with partner lenders.',
    icon: 'share',
    enabled: false,
  },
  {
    id: 'score_alerts',
    label: 'Score Change Alerts',
    description: 'Get notified when your credit score changes significantly.',
    icon: 'notifications_active',
    enabled: true,
  },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [prefs, setPrefs] = useState<ConsentPref[]>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTokensCount, setActiveTokensCount] = useState<number | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const isExpired = (expiresAt: string | null) => {
      if (!expiresAt) return false;
      return new Date(expiresAt) < new Date();
    };
    
    const getStatus = (share: ShareToken): 'active' | 'expired' | 'revoked' => {
      if (share.status === 'REVOKED') return 'revoked';
      if (share.status === 'EXPIRED') return 'expired';
      if (share.expires_at && isExpired(share.expires_at)) return 'expired';
      return 'active';
    };

    fetchShareHistory(businessId)
      .then((tokens) => {
        const activeCount = tokens.filter((t) => getStatus(t) === 'active').length;
        setActiveTokensCount(activeCount);
      })
      .catch((err) => {
        console.error('Failed to load active tokens:', err);
        setActiveTokensCount(0);
      });
  }, [businessId]);

  if (!businessId) {
    router.push('/login');
    return null;
  }

  const togglePref = (id: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const enabledCount = prefs.filter((p) => p.enabled).length;

  return (
    <AppShell title="Settings" businessId={businessId}>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h2 className="text-xl font-bold text-neu-on-surface">Account Settings</h2>
          <p className="mt-1 text-sm text-neu-on-surface-variant">
            Manage data consent preferences and account information.
          </p>
        </div>

        <section aria-labelledby="profile-heading">
          <h2
            id="profile-heading"
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant"
          >
            Business Profile
          </h2>

          <NeuCard className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neu-surface shadow-neu-raised-sm">
                <span
                  className="material-symbols-outlined text-3xl text-brand-teal"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  corporate_fare
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-neu-on-surface">{businessId}</p>
                <p className="text-sm text-neu-on-surface-variant">
                  MSME · Account Aggregator Linked
                </p>
              </div>
            </div>

            <div className="h-px bg-neu-outline-variant" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Business ID', value: businessId, icon: 'badge' },
                { label: 'Consent Status', value: 'Active', icon: 'verified_user' },
                { label: 'Data Freshness', value: 'Last synced: Today', icon: 'sync' },
                {
                  label: 'Active Tokens',
                  value: activeTokensCount !== null ? String(activeTokensCount) : 'Loading...',
                  icon: 'vpn_key',
                },
              ].map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl bg-neu-surface px-4 py-3 shadow-neu-inset-sm"
                >
                  <span className="material-symbols-outlined text-[18px] text-brand-teal">
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neu-on-surface-variant">
                      {label}
                    </p>
                    <p className="truncate text-sm font-medium text-neu-on-surface">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </NeuCard>
        </section>

        <section aria-labelledby="consent-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="consent-heading"
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant"
            >
              Data Consent ({enabledCount}/{prefs.length} active)
            </h2>
            <span className="rounded-full bg-neu-surface px-3 py-1 font-mono text-xs shadow-neu-inset-sm text-neu-on-surface-variant">
              RBI AA Framework
            </span>
          </div>

          <NeuCard padding="p-0" className="overflow-hidden divide-y divide-neu-outline-variant/40">
            {prefs.map((pref) => (
              <div
                key={pref.id}
                className="flex items-start gap-4 p-5 transition-colors hover:bg-neu-surface-low/30"
              >
                <div
                  className={`
                    mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neu-surface
                    ${pref.enabled ? 'shadow-neu-raised-xs' : 'shadow-neu-inset-sm opacity-60'}
                  `}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${pref.enabled ? 'text-brand-teal' : 'text-neu-on-surface-variant'}`}
                  >
                    {pref.icon}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neu-on-surface">{pref.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neu-on-surface-variant">
                    {pref.description}
                  </p>
                </div>

                <NeuToggle
                  checked={pref.enabled}
                  onChange={() => togglePref(pref.id)}
                />
              </div>
            ))}
          </NeuCard>
        </section>

        <section aria-labelledby="danger-heading">
          <h2
            id="danger-heading"
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant"
          >
            Danger Zone
          </h2>
          <NeuCard className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-neu-on-surface">Revoke All Data Access</p>
              <p className="mt-1 text-xs text-neu-on-surface-variant">
                Permanently revoke all consents and delete your passport data.
              </p>
            </div>
            <NeuButton
              variant="danger"
              onClick={() => alert('Contact support to revoke all data access.')}
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              Revoke Access
            </NeuButton>
          </NeuCard>
        </section>

        <div className="flex items-center justify-end gap-4 pb-8">
          {saved && (
            <div className="flex items-center gap-2 text-sm font-medium text-brand-teal">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Settings saved
            </div>
          )}
          <NeuButton onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Preferences
              </>
            )}
          </NeuButton>
        </div>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neu-surface" />}>
      <SettingsContent />
    </Suspense>
  );
}
