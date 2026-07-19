'use client';

import React, { useState, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';
import { triggerIngest, fetchScore, ScoreData } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Adapter {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: string;
  type: string;
  keysConfigured: boolean;
  requiredKeys: string[];
}

interface RazorpayPayment {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
  email: string;
  created_at: number;
}

// ─── Adapter definitions ─────────────────────────────────────────────────────

const ADAPTERS: Adapter[] = [
  { id: 'razorpay', name: 'Razorpay Gateway', description: 'Extracts real-time merchant transaction volumes, payouts, customer emails, and settlements.', icon: 'payments', source: 'razorpay', type: 'Payment Processing', keysConfigured: true, requiredKeys: [] },
  { id: 'zoho_books', name: 'Zoho Books', description: 'Syncs dynamic invoicing, accounts receivables, bills outstanding, and overall business cash flow.', icon: 'description', source: 'zoho', type: 'Accounting Software', keysConfigured: true, requiredKeys: [] },
  { id: 'setu_aa', name: 'Setu Account Aggregator', description: 'Ingests bank statements, transaction history, and account balances directly from the RBI AA framework.', icon: 'account_balance', source: 'aa', type: 'Bank Data', keysConfigured: false, requiredKeys: ['SETU_CLIENT_ID', 'SETU_CLIENT_SECRET', 'SETU_PRODUCT_INSTANCE_ID', 'SETU_FIU_ENTITY_ID'] },
  { id: 'gstn', name: 'GSTN Portal', description: 'Retrieves tax filing compliance, monthly sales data, and business turnover certificates.', icon: 'receipt_long', source: 'gstn', type: 'Tax & Compliance', keysConfigured: false, requiredKeys: ['GSTN_API_KEY', 'BUSINESS_GSTIN'] },
  { id: 'shopify', name: 'Shopify Store', description: 'Ingests customer orders, sales volume, discounts, and product categories to evaluate business health.', icon: 'storefront', source: 'shopify', type: 'E-Commerce', keysConfigured: false, requiredKeys: ['SHOPIFY_STORE_URL', 'SHOPIFY_API_ACCESS_TOKEN'] },
  { id: 'hdfc_bank', name: 'HDFC Corporate Banking API', description: 'Direct integration with HDFC Bank accounts for real-time statement feed and settlement reconciliation.', icon: 'account_balance', source: 'hdfc', type: 'Direct Bank Feed', keysConfigured: false, requiredKeys: ['HDFC_CLIENT_ID', 'HDFC_CLIENT_SECRET', 'HDFC_CLIENT_CERT_PATH'] },
  { id: 'icici_bank', name: 'ICICI Corporate Banking API', description: 'Direct statement pull and bank account validation via ICICI bank corporate channels.', icon: 'account_balance', source: 'icici', type: 'Direct Bank Feed', keysConfigured: false, requiredKeys: ['ICICI_CLIENT_ID', 'ICICI_CLIENT_SECRET', 'ICICI_CLIENT_CERT_PATH'] },
  { id: 'phonepe_merchant', name: 'PhonePe Merchant API', description: 'Syncs store QR code collections, direct peer-to-merchant settlements, and customer payment details.', icon: 'qr_code_2', source: 'phonepe', type: 'UPI Payments', keysConfigured: false, requiredKeys: ['PHONEPE_MERCHANT_ID', 'PHONEPE_SALT_KEY', 'PHONEPE_SALT_INDEX'] },
  { id: 'khatabook', name: 'Khatabook Ledger', description: 'Syncs customer debt books, credit ledgers, daily collections, and business accounts receivable.', icon: 'menu_book', source: 'khatabook', type: 'Accounting Software', keysConfigured: false, requiredKeys: ['KHATABOOK_CLIENT_ID', 'KHATABOOK_API_KEY'] },
  { id: 'stripe', name: 'Stripe Gateway', description: 'Extracts multi-currency international transaction history, customer profiles, and subscription billing analytics.', icon: 'credit_card', source: 'stripe', type: 'Payment Processing', keysConfigured: false, requiredKeys: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'] },
];

// ─── Record Payment Modal ─────────────────────────────────────────────────────

interface RecordModalProps {
  onClose: () => void;
  onRecord: (data: { amount: number; email: string; payerName: string; upiRef: string }) => Promise<void>;
}

function RecordPaymentModal({ onClose, onRecord }: RecordModalProps) {
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [payerName, setPayerName] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) { setError('Enter a valid amount'); return; }
    if (!email) { setError('Enter payer email or UPI ID'); return; }
    setSubmitting(true);
    try {
      await onRecord({
        amount: Math.round(amtNum * 100), // convert to paise
        email,
        payerName,
        upiRef,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md">
      <div className="relative mx-4 w-full max-w-md rounded-3xl bg-neu-surface p-7 shadow-neu-raised">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-neu-surface shadow-neu-raised-sm text-neu-on-surface-variant hover:text-brand-teal"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10">
            <span className="material-symbols-outlined text-xl text-brand-teal" style={{ fontVariationSettings: "'FILL' 1" }}>
              receipt_long
            </span>
          </div>
          <div>
            <h3 className="font-bold text-neu-on-surface">Record Payment</h3>
            <p className="text-[11px] text-neu-on-surface-variant">Enter the details from your scanned payment</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Amount Paid (₹) <span className="text-brand-teal">*</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-neu-surface px-3 py-2.5 shadow-neu-inset-sm">
              <span className="text-sm font-bold text-neu-on-surface-variant">₹</span>
              <input
                autoFocus
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-neu-on-surface outline-none placeholder:font-normal placeholder:text-neu-on-surface-variant/50"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Payer Name */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Payer Name
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-neu-surface px-3 py-2.5 shadow-neu-inset-sm">
              <span className="material-symbols-outlined text-sm text-neu-on-surface-variant">person</span>
              <input
                type="text"
                value={payerName}
                onChange={e => setPayerName(e.target.value)}
                className="w-full bg-transparent text-sm text-neu-on-surface outline-none placeholder:text-neu-on-surface-variant/50"
                placeholder="e.g. Rahul Sharma"
              />
            </div>
          </div>

          {/* Email / UPI ID */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Payer Email / UPI ID <span className="text-brand-teal">*</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-neu-surface px-3 py-2.5 shadow-neu-inset-sm">
              <span className="material-symbols-outlined text-sm text-neu-on-surface-variant">alternate_email</span>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm text-neu-on-surface outline-none placeholder:text-neu-on-surface-variant/50"
                placeholder="rahul@upi or rahul@email.com"
              />
            </div>
          </div>

          {/* UPI Ref */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              UPI Reference / Transaction ID
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-neu-surface px-3 py-2.5 shadow-neu-inset-sm">
              <span className="material-symbols-outlined text-sm text-neu-on-surface-variant">tag</span>
              <input
                type="text"
                value={upiRef}
                onChange={e => setUpiRef(e.target.value)}
                className="w-full bg-transparent font-mono text-sm text-neu-on-surface outline-none placeholder:font-normal placeholder:text-neu-on-surface-variant/50"
                placeholder="e.g. 423178645321"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-neu-error-light px-3 py-2 text-xs text-neu-error">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-neu-outline-variant py-2.5 text-sm font-bold text-neu-on-surface-variant hover:border-brand-teal/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white shadow-neu-raised-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? (
                <span className="material-symbols-outlined animate-spin text-base">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base">add_circle</span>
              )}
              {submitting ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Razorpay Demo Panel ──────────────────────────────────────────────────────

function RazorpayDemoPanel({ businessId }: { businessId: string }) {
  const [transactions, setTransactions] = useState<RazorpayPayment[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastRecorded, setLastRecorded] = useState<RazorpayPayment | null>(null);
  const [flashRecord, setFlashRecord] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ before: number | null; after: number | null }>({ before: null, after: null });

  // Customizable UPI configurations
  const [upiId, setUpiId] = useState('nexusdemo@upi');
  const [merchantName, setMerchantName] = useState('Acme MSME Solutions');
  const [isEditingUpi, setIsEditingUpi] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      setLoadingTxns(true);
      const res = await fetch('/api/razorpay/transactions');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTransactions(data.items ?? []);
    } catch { /* silently fail */ } finally {
      setLoadingTxns(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleRecord = async (data: { amount: number; email: string; payerName: string; upiRef: string }) => {
    const res = await fetch('/api/razorpay/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: data.amount,
        email: data.email || 'anonymous@upi',
        currency: 'INR',
        status: 'captured',
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record payment');
    }
    const created: RazorpayPayment = await res.json();
    setLastRecorded(created);
    setFlashRecord(true);
    setShowModal(false);
    await loadTransactions();

    setTimeout(() => {
      setFlashRecord(false);
    }, 4000);
  };

  const handleSyncAndScore = async () => {
    setSyncing(true);
    setSyncMsg('');
    setScoreResult({ before: null, after: null });
    try {
      let before: number | null = null;
      try { before = ((await fetchScore(businessId)) as ScoreData).score; } catch { /* ignore */ }
      setSyncMsg('Syncing Razorpay data…');
      await triggerIngest(businessId, 'razorpay');
      setSyncMsg('Ingested ✓ — Computing new score…');
      await new Promise(r => setTimeout(r, 1500));
      let after: number | null = null;
      try { after = ((await fetchScore(businessId)) as ScoreData).score; } catch { /* ignore */ }
      setScoreResult({ before, after });
      setSyncMsg('');
    } catch (err: any) {
      setSyncMsg(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setScoreResult({ before: null, after: null });
    setLastRecorded(null);
    setSyncMsg('');
    try {
      await fetch('/api/razorpay/transactions', { method: 'DELETE' });
      await loadTransactions();
    } catch { /* ignore */ } finally {
      setResetting(false);
    }
  };

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (unix: number) => new Date(unix * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const scoreDelta = scoreResult.before !== null && scoreResult.after !== null ? scoreResult.after - scoreResult.before : null;

  // Generate deep link based on user config
  const currentUpiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&cu=INR`;
  const currentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0d5c4a&bgcolor=f4f7f6&qzone=2&data=${encodeURIComponent(currentUpiDeepLink)}`;

  return (
    <>
      {showModal && (
        <RecordPaymentModal
          onClose={() => setShowModal(false)}
          onRecord={handleRecord}
        />
      )}

      <div className="mt-6 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-brand-teal">qr_code_scanner</span>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-teal">
              Live UPI QR Integration
            </h4>
          </div>
          <button
            onClick={() => setIsEditingUpi(!isEditingUpi)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-brand-teal border border-brand-teal/20 bg-brand-teal/5 hover:bg-brand-teal/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xs">edit</span>
            {isEditingUpi ? 'Done Configuring' : 'Configure Live UPI ID'}
          </button>
        </div>

        {/* ── UPI Configuration panel ── */}
        {isEditingUpi && (
          <div className="mb-5 rounded-xl border border-dashed border-brand-teal/30 bg-brand-teal/5 p-4 animate-slide-down">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-brand-teal mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">settings_input_component</span>
              Set Your Real UPI credentials to test live scans
            </h5>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
                  UPI VPA ID (e.g. name@okaxis)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  className="w-full rounded-lg bg-neu-surface px-3 py-1.5 text-xs text-neu-on-surface border border-neu-outline-variant outline-none"
                  placeholder="name@okaxis"
                />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
                  Display Business / Display Name
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={e => setMerchantName(e.target.value)}
                  className="w-full rounded-lg bg-neu-surface px-3 py-1.5 text-xs text-neu-on-surface border border-neu-outline-variant outline-none"
                  placeholder="Acme Solutions"
                />
              </div>
            </div>
            <p className="text-[9px] text-neu-on-surface-variant mt-2.5 leading-relaxed">
              * By setting a real UPI ID above, scanning the QR code with GPay/PhonePe will safely trigger a real fund transfer (e.g. ₹1) directly to your account.
            </p>
          </div>
        )}

        {/* ── QR + instructions side-by-side ── */}
        <div className="mb-6 flex flex-col gap-6 md:flex-row md:items-stretch">
          {/* QR Section */}
          <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-neu-outline-variant bg-neu-surface p-6 shadow-neu-inset-sm">
            <div className="overflow-hidden rounded-2xl bg-white p-3 shadow-md border border-neu-outline-variant">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentQrUrl}
                alt="UPI Payment QR Code"
                width={160}
                height={160}
                className="rounded-xl"
              />
            </div>
            <span className="font-mono text-[10px] font-bold text-brand-teal bg-brand-teal/5 px-3 py-1 rounded-full mt-3 border border-brand-teal/20">
              {upiId}
            </span>
          </div>

          {/* Instructions and CTA */}
          <div className="flex-1 flex flex-col justify-between rounded-2xl border border-neu-outline-variant bg-neu-surface p-5 shadow-neu-inset-sm">
            <div className="space-y-3.5">
              {[
                { step: '1', title: 'Configure and Scan', desc: 'Ensure your UPI ID is set above. Scan the code using GPay, PhonePe, or Paytm.' },
                { step: '2', title: 'Complete Transaction', desc: 'Transfer any test amount (e.g. ₹1) safely to your configured account.' },
                { step: '3', title: 'Record Transaction', desc: 'Click "Record Payment" and key in the transfer details to log it.' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-[9px] font-bold text-brand-teal">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neu-on-surface">{s.title}</p>
                    <p className="text-[9px] leading-tight text-neu-on-surface-variant">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white shadow-neu-raised-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              Record Payment After Scan
            </button>
          </div>
        </div>

        {/* ── Transaction success flash alert ── */}
        {lastRecorded && (
          <div className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-500 ${
            flashRecord
              ? 'border-brand-teal/40 bg-brand-teal/10 scale-102 shadow-lg animate-pulse'
              : 'border-brand-teal/20 bg-brand-teal/5'
          }`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-xl text-brand-teal animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <div>
                <p className="text-[10px] font-bold text-brand-teal">Payment Successfully Recorded!</p>
                <p className="text-[10px] text-neu-on-surface-variant mt-0.5">
                  Registered **{fmt(lastRecorded.amount)}** from **{lastRecorded.email}**
                </p>
              </div>
            </div>
            <span className="font-mono text-[9px] text-neu-on-surface-variant bg-neu-surface px-2 py-0.5 rounded-lg border border-neu-outline-variant">
              {lastRecorded.id}
            </span>
          </div>
        )}

        {/* ── Transaction table ── */}
        <div className="mb-4 overflow-hidden rounded-xl border border-neu-outline-variant bg-neu-surface shadow-neu-inset-sm">
          <div className="flex items-center justify-between border-b border-neu-outline-variant px-4 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              {loadingTxns ? 'Loading…' : transactions.length === 0 ? 'No transactions yet' : `${transactions.length} Recorded Transaction${transactions.length !== 1 ? 's' : ''}`}
            </span>
            <button
              onClick={loadTransactions}
              disabled={loadingTxns}
              className="flex items-center gap-1 text-[10px] font-bold text-brand-teal hover:opacity-75 disabled:opacity-40"
            >
              <span className={`material-symbols-outlined text-sm ${loadingTxns ? 'animate-spin' : ''}`}>refresh</span>
              Refresh
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {transactions.length === 0 && !loadingTxns ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="material-symbols-outlined text-3xl text-neu-on-surface-variant/40">qr_code_scanner</span>
                <p className="text-xs text-neu-on-surface-variant">
                  No transaction recorded. Scan the QR code and record details to begin.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-neu-surface-low">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-neu-on-surface-variant">ID</th>
                    <th className="px-4 py-2 text-right font-bold text-neu-on-surface-variant">Amount</th>
                    <th className="px-4 py-2 text-left font-bold text-neu-on-surface-variant">From</th>
                    <th className="px-4 py-2 text-left font-bold text-neu-on-surface-variant">Status</th>
                    <th className="px-4 py-2 text-left font-bold text-neu-on-surface-variant">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, i) => (
                    <tr
                      key={txn.id}
                      className={`border-t border-neu-outline-variant/40 transition-colors ${
                        i === 0 && flashRecord ? 'bg-brand-teal/15 animate-pulse font-bold' : i === 0 ? 'bg-brand-teal/5' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-mono text-[10px] text-neu-on-surface-variant">{txn.id}</td>
                      <td className="px-4 py-2 text-right font-bold text-brand-teal">{fmt(txn.amount)}</td>
                      <td className="px-4 py-2 text-neu-on-surface">{txn.email}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-teal">
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-neu-on-surface-variant">{fmtDate(txn.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Score update result ── */}
        {scoreResult.before !== null && scoreResult.after !== null && (
          <div className={`mb-4 flex items-center justify-between rounded-2xl border px-5 py-4 ${
            scoreDelta! >= 0 ? 'border-brand-teal/30 bg-brand-teal/10' : 'border-red-400/30 bg-red-50'
          }`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-brand-teal" style={{ fontVariationSettings: "'FILL' 1" }}>
                credit_score
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Score Updated</p>
                <p className="text-lg font-bold text-neu-on-surface">{scoreResult.before} → {scoreResult.after}</p>
              </div>
            </div>
            <div className={`rounded-xl px-4 py-2 text-center font-bold ${scoreDelta! >= 0 ? 'bg-brand-teal text-white' : 'bg-red-500 text-white'}`}>
              <p className="text-[10px] uppercase tracking-wider">Change</p>
              <p className="text-lg">{scoreDelta! >= 0 ? '+' : ''}{scoreDelta}</p>
            </div>
          </div>
        )}

        {syncMsg && (
          <p className="mb-3 flex items-center gap-2 text-xs text-brand-teal">
            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
            {syncMsg}
          </p>
        )}

        {/* ── Action buttons ── */}
        <div className="flex gap-3">
          <button
            onClick={handleSyncAndScore}
            disabled={syncing || transactions.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white shadow-neu-raised-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {syncing ? (
              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
            ) : (
              <span className="material-symbols-outlined text-sm">bolt</span>
            )}
            {syncing ? 'Processing…' : 'Sync & Refresh Score'}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 rounded-xl border border-neu-outline-variant px-4 py-2.5 text-xs font-bold text-neu-on-surface-variant hover:border-red-400/40 hover:text-red-500 disabled:opacity-40 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            Clear All
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Adapters Page ───────────────────────────────────────────────────────

function AdaptersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>('razorpay');

  if (!businessId) {
    router.push('/login');
    return null;
  }

  const handleSync = async (adapter: Adapter) => {
    setSyncing(prev => ({ ...prev, [adapter.id]: true }));
    setSuccess(prev => ({ ...prev, [adapter.id]: '' }));
    setError(prev => ({ ...prev, [adapter.id]: '' }));
    try {
      await triggerIngest(businessId, adapter.source);
      setSuccess(prev => ({ ...prev, [adapter.id]: `Successfully synced ${adapter.name} data!` }));
    } catch (err: any) {
      setError(prev => ({ ...prev, [adapter.id]: err.message || `Failed to sync ${adapter.name}` }));
    } finally {
      setSyncing(prev => ({ ...prev, [adapter.id]: false }));
    }
  };

  const configured = ADAPTERS.filter(a => a.keysConfigured);
  const notConfigured = ADAPTERS.filter(a => !a.keysConfigured);

  const renderCard = (adapter: Adapter) => {
    const isSyncing = syncing[adapter.id];
    const syncSuccess = success[adapter.id];
    const syncError = error[adapter.id];
    const isExpanded = expanded === adapter.id;
    const isRazorpay = adapter.id === 'razorpay';

    return (
      <NeuCard
        key={adapter.id}
        className={`flex flex-col justify-between rounded-3xl p-6 transition-all ${
          !adapter.keysConfigured ? 'opacity-70' : ''
        } ${isExpanded && isRazorpay ? 'col-span-1 md:col-span-2' : ''}`}
      >
        <div>
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-brand-teal/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal">
              {adapter.type}
            </span>
            <div className="flex items-center gap-2">
              {isRazorpay && adapter.keysConfigured && (
                <button
                  onClick={() => setExpanded(isExpanded ? null : adapter.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-brand-teal hover:bg-brand-teal/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                  {isExpanded ? 'Hide' : 'Pay Demo'}
                </button>
              )}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neu-surface shadow-neu-raised-xs ${adapter.keysConfigured ? 'text-brand-teal' : 'text-neu-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-[22px]">{adapter.icon}</span>
              </div>
            </div>
          </div>

          <h3 className="mb-2 text-base font-bold text-neu-on-surface">{adapter.name}</h3>
          <p className="mb-6 min-h-[48px] text-xs leading-relaxed text-neu-on-surface-variant">
            {adapter.description}
          </p>
        </div>

        <div className="space-y-3">
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
            <NeuButton onClick={() => handleSync(adapter)} disabled={isSyncing} className="w-full justify-center" size="sm">
              {isSyncing ? (
                <><span className="material-symbols-outlined animate-spin text-sm">sync</span>Syncing...</>
              ) : (
                <><span className="material-symbols-outlined text-sm">sync</span>Sync Data</>
              )}
            </NeuButton>
          ) : (
            <div className="rounded-xl border border-dashed border-neu-outline-variant bg-neu-surface-low/40 px-4 py-3 shadow-neu-inset-sm">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
                <span className="material-symbols-outlined text-sm">key_off</span>
                Keys not configured
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-neu-on-surface-variant">
                Set the following env vars in <code className="font-mono">.env.local</code> to enable sync:
              </p>
              <ul className="space-y-0.5">
                {adapter.requiredKeys.map(k => (
                  <li key={k} className="font-mono text-[10px] text-neu-on-surface-variant">• {k}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {isRazorpay && isExpanded && <RazorpayDemoPanel businessId={businessId} />}
      </NeuCard>
    );
  };

  return (
    <AppShell title="Adapters" businessId={businessId}>
      <div className="mx-auto max-w-4xl space-y-10">
        <div>
          <h2 className="text-xl font-bold text-neu-on-surface">Data Connectors &amp; Adapters</h2>
          <p className="mt-1 text-sm text-neu-on-surface-variant">
            Connect and synchronize financial data from diverse business sources to update your credit passport.
          </p>
        </div>

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
