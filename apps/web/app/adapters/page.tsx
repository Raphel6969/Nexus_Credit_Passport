'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';
import { triggerIngest } from '../../lib/api';

interface Adapter {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: string;
  type: string;
  /** true = real credentials are present; false = placeholder / missing keys */
  keysConfigured: boolean;
  /** env var names that need to be set before sync is enabled */
  requiredKeys: string[];
}

const ADAPTERS: Adapter[] = [
  // ─── Core adapters with real keys ──────────────────────────────────────────
  {
    id: 'razorpay',
    name: 'Razorpay Gateway',
    description:
      'Extracts real-time merchant transaction volumes, payouts, customer emails, and settlements.',
    icon: 'payments',
    source: 'razorpay',
    type: 'Payment Processing',
    keysConfigured: true,
    requiredKeys: [],
  },
  {
    id: 'zoho_books',
    name: 'Zoho Books',
    description:
      'Syncs dynamic invoicing, accounts receivables, bills outstanding, and overall business cash flow.',
    icon: 'description',
    source: 'zoho',
    type: 'Accounting Software',
    keysConfigured: true,
    requiredKeys: [],
  },

  // ─── Adapters using mock / placeholder keys — sync disabled ─────────────────
  {
    id: 'setu_aa',
    name: 'Setu Account Aggregator',
    description:
      'Ingests bank statements, transaction history, and account balances directly from the RBI AA framework.',
    icon: 'account_balance',
    source: 'aa',
    type: 'Bank Data',
    keysConfigured: false,
    requiredKeys: [
      'SETU_CLIENT_ID',
      'SETU_CLIENT_SECRET',
      'SETU_PRODUCT_INSTANCE_ID',
      'SETU_FIU_ENTITY_ID',
    ],
  },
  {
    id: 'gstn',
    name: 'GSTN Portal',
    description:
      'Retrieves tax filing compliance, monthly sales data, and business turnover certificates.',
    icon: 'receipt_long',
    source: 'gstn',
    type: 'Tax & Compliance',
    keysConfigured: false,
    requiredKeys: ['GSTN_API_KEY', 'BUSINESS_GSTIN'],
  },
  {
    id: 'shopify',
    name: 'Shopify Store',
    description:
      'Ingests customer orders, sales volume, discounts, and product categories to evaluate business health.',
    icon: 'storefront',
    source: 'shopify',
    type: 'E-Commerce',
    keysConfigured: false,
    requiredKeys: ['SHOPIFY_STORE_URL', 'SHOPIFY_API_ACCESS_TOKEN'],
  },
  {
    id: 'hdfc_bank',
    name: 'HDFC Corporate Banking API',
    description:
      'Direct integration with HDFC Bank accounts for real-time statement feed and settlement reconciliation.',
    icon: 'account_balance',
    source: 'hdfc',
    type: 'Direct Bank Feed',
    keysConfigured: false,
    requiredKeys: [
      'HDFC_CLIENT_ID',
      'HDFC_CLIENT_SECRET',
      'HDFC_CLIENT_CERT_PATH',
    ],
  },
  {
    id: 'icici_bank',
    name: 'ICICI Corporate Banking API',
    description:
      'Direct statement pull and bank account validation via ICICI bank corporate channels.',
    icon: 'account_balance',
    source: 'icici',
    type: 'Direct Bank Feed',
    keysConfigured: false,
    requiredKeys: [
      'ICICI_CLIENT_ID',
      'ICICI_CLIENT_SECRET',
      'ICICI_CLIENT_CERT_PATH',
    ],
  },
  {
    id: 'phonepe_merchant',
    name: 'PhonePe Merchant API',
    description:
      'Syncs store QR code collections, direct peer-to-merchant settlements, and customer payment details.',
    icon: 'qr_code_2',
    source: 'phonepe',
    type: 'UPI Payments',
    keysConfigured: false,
    requiredKeys: [
      'PHONEPE_MERCHANT_ID',
      'PHONEPE_SALT_KEY',
      'PHONEPE_SALT_INDEX',
    ],
  },
  {
    id: 'khatabook',
    name: 'Khatabook Ledger',
    description:
      'Syncs customer debt books, credit ledgers, daily collections, and business accounts receivable.',
    icon: 'menu_book',
    source: 'khatabook',
    type: 'Accounting Software',
    keysConfigured: false,
    requiredKeys: [
      'KHATABOOK_CLIENT_ID',
      'KHATABOOK_API_KEY',
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe Gateway',
    description:
      'Extracts multi-currency international transaction history, customer profiles, and subscription billing analytics.',
    icon: 'credit_card',
    source: 'stripe',
    type: 'Payment Processing',
    keysConfigured: false,
    requiredKeys: [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
    ],
  },
];

function AdaptersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [error, setError] = useState<Record<string, string>>({});

  if (!businessId) {
    router.push('/login');
    return null;
  }

  const handleSync = async (adapter: Adapter) => {
    setSyncing((prev) => ({ ...prev, [adapter.id]: true }));
    setSuccess((prev) => ({ ...prev, [adapter.id]: '' }));
    setError((prev) => ({ ...prev, [adapter.id]: '' }));

    try {
      await triggerIngest(businessId, adapter.source);
      setSuccess((prev) => ({
        ...prev,
        [adapter.id]: `Successfully synced ${adapter.name} data!`,
      }));
    } catch (err: any) {
      setError((prev) => ({
        ...prev,
        [adapter.id]: err.message || `Failed to sync ${adapter.name}`,
      }));
    } finally {
      setSyncing((prev) => ({ ...prev, [adapter.id]: false }));
    }
  };

  const configured = ADAPTERS.filter((a) => a.keysConfigured);
  const notConfigured = ADAPTERS.filter((a) => !a.keysConfigured);

  const renderCard = (adapter: Adapter) => {
    const isSyncing = syncing[adapter.id];
    const syncSuccess = success[adapter.id];
    const syncError = error[adapter.id];

    return (
      <NeuCard
        key={adapter.id}
        className={`flex flex-col justify-between rounded-3xl p-6 ${
          !adapter.keysConfigured ? 'opacity-70' : ''
        }`}
      >
        <div>
          {/* Header row */}
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-brand-teal/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal">
              {adapter.type}
            </span>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neu-surface shadow-neu-raised-xs ${
                adapter.keysConfigured ? 'text-brand-teal' : 'text-neu-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {adapter.icon}
              </span>
            </div>
          </div>

          <h3 className="mb-2 text-base font-bold text-neu-on-surface">
            {adapter.name}
          </h3>
          <p className="mb-6 min-h-[48px] text-xs leading-relaxed text-neu-on-surface-variant">
            {adapter.description}
          </p>
        </div>

        <div className="space-y-3">
          {/* Success / error feedback (only for configured adapters) */}
          {syncSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-2 text-xs font-medium text-brand-teal">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {syncSuccess}
            </div>
          )}
          {syncError && (
            <div className="flex items-start gap-2 rounded-xl bg-neu-error-light px-3 py-2 text-xs font-medium text-neu-error">
              <span className="material-symbols-outlined mt-0.5 text-sm">error</span>
              <span className="break-all">{syncError}</span>
            </div>
          )}

          {adapter.keysConfigured ? (
            /* ── Sync button for configured adapters ── */
            <NeuButton
              onClick={() => handleSync(adapter)}
              disabled={isSyncing}
              className="w-full justify-center"
              size="sm"
            >
              {isSyncing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  Syncing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">sync</span>
                  Sync Data
                </>
              )}
            </NeuButton>
          ) : (
            /* ── Keys not configured state ── */
            <div className="rounded-xl border border-dashed border-neu-outline-variant bg-neu-surface-low/40 px-4 py-3 shadow-neu-inset-sm">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
                <span className="material-symbols-outlined text-sm">key_off</span>
                Keys not configured
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-neu-on-surface-variant">
                Set the following env vars in <code className="font-mono">.env.local</code> to enable sync:
              </p>
              <ul className="space-y-0.5">
                {adapter.requiredKeys.map((k) => (
                  <li key={k} className="font-mono text-[10px] text-neu-on-surface-variant">
                    • {k}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </NeuCard>
    );
  };

  return (
    <AppShell title="Adapters" businessId={businessId}>
      <div className="mx-auto max-w-4xl space-y-10">
        <div>
          <h2 className="text-xl font-bold text-neu-on-surface">
            Data Connectors &amp; Adapters
          </h2>
          <p className="mt-1 text-sm text-neu-on-surface-variant">
            Connect and synchronize financial data from diverse business sources to update your credit passport.
          </p>
        </div>

        {/* ── Active / configured adapters ── */}
        {configured.length > 0 && (
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant">
              <span className="material-symbols-outlined text-sm text-brand-teal">check_circle</span>
              Active ({configured.length})
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {configured.map(renderCard)}
            </div>
          </section>
        )}

        {/* ── Adapters pending key setup ── */}
        {notConfigured.length > 0 && (
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant">
              <span className="material-symbols-outlined text-sm text-brand-gold">key_off</span>
              Awaiting Configuration ({notConfigured.length})
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {notConfigured.map(renderCard)}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

export default function AdaptersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neu-surface" />}>
      <AdaptersContent />
    </Suspense>
  );
}
