'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell, LoadingState, ErrorState } from '../../components/layout/AppShell';
import { NeuCard } from '../../components/ui/NeuCard';
import {
  fetchDashboard,
  type DashboardData,
  type MonthlyDataPoint,
  type ModeBreakdown,
  type RecentTransaction,
} from '../../lib/api';
import { LoanSimulator } from '../../components/LoanSimulator';
import { OcenBroadcastModal } from '../../components/OcenBroadcastModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert paise → formatted rupee string */
function formatRupees(paise: number): string {
  const rupees = paise / 100;
  if (Math.abs(rupees) >= 1_00_00_000) {
    return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (Math.abs(rupees) >= 1_00_000) {
    return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1).toLocaleString('en-IN', { month: 'short' });
}

const MODE_COLORS: Record<string, string> = {
  UPI: '#14b8a6',
  NEFT: '#6366f1',
  RTGS: '#8b5cf6',
  IMPS: '#f59e0b',
  NACH: '#ec4899',
  ATM: '#ef4444',
  CARD: '#f97316',
  CHEQUE: '#84cc16',
  ECS: '#06b6d4',
  OTHERS: '#94a3b8',
};

function modeColor(mode: string) {
  return MODE_COLORS[mode] ?? '#94a3b8';
}

// ─── Mini SVG Area/Line Chart ────────────────────────────────────────────────

interface TrendChartProps {
  monthly: MonthlyDataPoint[];
}

function TrendChart({ monthly }: TrendChartProps) {
  const W = 640, H = 220, PX = 48, PY = 24;
  const innerW = W - PX * 2;
  const innerH = H - PY * 2;

  const maxVal = useMemo(
    () => Math.max(...monthly.flatMap((m) => [m.earned, m.spent]), 1),
    [monthly]
  );

  const pts = (key: 'earned' | 'spent') =>
    monthly.map((m, i) => {
      const x = PX + (i / Math.max(monthly.length - 1, 1)) * innerW;
      const y = PY + innerH - (m[key] / maxVal) * innerH;
      return `${x},${y}`;
    });

  const area = (key: 'earned' | 'spent', color: string) => {
    if (monthly.length === 0) return null;
    const points = monthly.map((m, i) => ({
      x: PX + (i / Math.max(monthly.length - 1, 1)) * innerW,
      y: PY + innerH - (m[key] / maxVal) * innerH,
    }));
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x},${PY + innerH} L${points[0].x},${PY + innerH} Z`;
    const id = `grad-${key}`;
    return (
      <g key={key}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${id})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} />
        ))}
      </g>
    );
  };

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = (maxVal * i) / yTicks;
    const y = PY + innerH - (val / maxVal) * innerH;
    return { val, y };
  });

  if (monthly.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neu-on-surface-variant">
        No monthly data available
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
      {/* Grid lines */}
      {gridLines.map(({ y, val }, i) => (
        <g key={i}>
          <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
          <text x={PX - 6} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.45">
            {val === 0 ? '0' : formatRupees(val).replace('₹', '')}
          </text>
        </g>
      ))}
      {/* X-axis labels */}
      {monthly.map((m, i) => {
        const x = PX + (i / Math.max(monthly.length - 1, 1)) * innerW;
        return (
          <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.5">
            {shortMonth(m.month)}
          </text>
        );
      })}
      {area('earned', '#14b8a6')}
      {area('spent', '#f43f5e')}
    </svg>
  );
}

// ─── Mode Bar Chart ───────────────────────────────────────────────────────────

interface ModeChartProps {
  modes: ModeBreakdown[];
}

function ModeChart({ modes }: ModeChartProps) {
  const max = useMemo(() => Math.max(...modes.map((m) => m.amount), 1), [modes]);
  if (modes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-neu-on-surface-variant">No payment mode data</p>
    );
  }
  return (
    <div className="space-y-3">
      {modes.slice(0, 8).map((m) => {
        const pct = (m.amount / max) * 100;
        const color = modeColor(m.mode);
        return (
          <div key={m.mode} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
              {m.mode}
            </span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-neu-surface-low shadow-neu-inset-sm">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-[11px] text-neu-on-surface-variant">
              {formatRupees(m.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  gradient: string;
  subtitle?: string;
}

function StatCard({ label, value, icon, color, gradient, subtitle }: StatCardProps) {
  return (
    <NeuCard className="relative overflow-hidden rounded-3xl border border-white/40">
      {/* Decorative glow blob */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl"
        style={{ background: gradient }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent" />
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-neu-surface-low/70 shadow-neu-inset-sm"
            style={{ color }}
          >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </span>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
            {label}
          </p>
        </div>
        <p className="text-3xl font-extrabold tracking-tight" style={{ color }}>
          {formatRupees(value)}
        </p>
        {subtitle && (
          <p className="text-[11px] text-neu-on-surface-variant">{subtitle}</p>
        )}
      </div>
    </NeuCard>
  );
}

// ─── Recent Transactions Table ────────────────────────────────────────────────

interface TransactionTableProps {
  transactions: RecentTransaction[];
}

function TransactionTable({ transactions }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-neu-on-surface-variant">
        <span className="material-symbols-outlined text-4xl">receipt_long</span>
        <p className="text-sm">No recent transactions</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neu-outline-variant">
            <th className="pb-3 pl-2 text-left text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Type
            </th>
            <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Mode
            </th>
            <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Amount
            </th>
            <th className="pb-3 pr-2 text-right text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const isCredit = txn.type === 'CREDIT';
            return (
              <tr
                key={txn.id}
                className="group border-b border-neu-outline-variant/30 transition-colors last:border-none hover:bg-neu-surface-low/40"
              >
                <td className="py-3 pl-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      isCredit
                        ? 'bg-brand-teal/10 text-brand-teal'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isCredit ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                    {txn.type}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      color: modeColor(txn.mode),
                      background: `${modeColor(txn.mode)}18`,
                    }}
                  >
                    {txn.mode}
                  </span>
                </td>
                <td className={`py-3 text-right font-semibold ${isCredit ? 'text-brand-teal' : 'text-rose-500'}`}>
                  {isCredit ? '+' : '−'} {formatRupees(txn.amount)}
                </td>
                <td className="py-3 pr-2 text-right text-[11px] text-neu-on-surface-variant">
                  {new Date(txn.timestamp).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Dashboard Content ───────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ocenModalOpen, setOcenModalOpen] = useState(false);

  useEffect(() => {
    if (!businessId) {
      router.push('/login');
      return;
    }
    fetchDashboard(businessId)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [businessId, router]);

  if (!businessId) return null;

  if (loading) {
    return (
      <AppShell title="Dashboard" businessId={businessId}>
        <LoadingState message="Crunching your financial data…" />
      </AppShell>
    );
  }

  if (error || !data) {
    const isNoData = error.includes('NO_DATA') || error.includes('No transaction');
    return (
      <AppShell title="Dashboard" businessId={businessId}>
        <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl bg-neu-surface p-10 text-center shadow-neu-raised">
          <span className="material-symbols-outlined mb-4 block text-5xl text-neu-error">
            {isNoData ? 'search_off' : 'error'}
          </span>
          <h2 className="mb-2 text-lg font-bold text-neu-on-surface">
            {isNoData ? 'No Financial Data' : 'Something went wrong'}
          </h2>
          <p className="mb-6 text-sm text-neu-on-surface-variant">
            {isNoData
              ? 'No transactions were found for this business. Use the Adapters tab to ingest data first.'
              : error}
          </p>
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

  const { summary, monthly, modes, recent_transactions, monthly_kpis, trend_insights, budget_guidance } = data;
  const savingsRate =
    summary.total_earned > 0
      ? ((summary.total_saved / summary.total_earned) * 100).toFixed(1)
      : '0.0';

  // Month-over-month trend for the last two months
  const lastTwo = monthly.slice(-2);
  const momEarned =
    lastTwo.length === 2 && lastTwo[0].earned > 0
      ? (((lastTwo[1].earned - lastTwo[0].earned) / lastTwo[0].earned) * 100).toFixed(1)
      : null;
  const momSpent =
    lastTwo.length === 2 && lastTwo[0].spent > 0
      ? (((lastTwo[1].spent - lastTwo[0].spent) / lastTwo[0].spent) * 100).toFixed(1)
      : null;

  const fixedCostHealth =
    trend_insights.fixed_cost_ratio_pct <= budget_guidance.fixed_cost_ratio_threshold_pct
      ? 'Healthy'
      : 'Needs Attention';

  return (
    <AppShell title="Dashboard" businessId={businessId}>
      <div className="mx-auto max-w-6xl space-y-10">
        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-neu-surface px-6 py-6 shadow-neu-raised sm:px-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-teal/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-brand-gold/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-neu-surface-low px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-teal shadow-neu-inset-sm">
                <span className="material-symbols-outlined text-[14px]">insights</span>
                Merchant Overview
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
                Earnings and cash-flow control, at a glance
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-neu-on-surface-variant">
                Monitor earnings trends, spending concentration, and hybrid budget targets from one place.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-neu-surface-low/60 px-4 py-3 shadow-neu-inset-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Avg Saved / Month</p>
                <p className="mt-1 text-sm font-bold text-brand-teal">{formatRupees(trend_insights.avg_monthly_saved)}</p>
              </div>
              <div className="rounded-2xl bg-neu-surface-low/60 px-4 py-3 shadow-neu-inset-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Fixed-Cost Ratio</p>
                <p className="mt-1 text-sm font-bold text-neu-on-surface">{trend_insights.fixed_cost_ratio_pct.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl bg-neu-surface-low/60 px-4 py-3 shadow-neu-inset-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Top Spend Mode</p>
                <p className="mt-1 text-sm font-bold text-neu-on-surface">
                  {trend_insights.top_spend_mode ?? 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── OCEN Network Broadcast CTA Banner ───────────────────────────── */}
        <section>
          <NeuCard className="relative overflow-hidden rounded-3xl border border-brand-teal/30 bg-gradient-to-r from-neu-surface via-neu-surface-low to-brand-teal/10 p-6 shadow-neu-raised">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-teal/20 text-brand-teal shadow-neu-inset">
                  <span className="material-symbols-outlined text-3xl">hub</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-teal/20 px-2.5 py-0.5 text-[10px] font-bold text-brand-teal uppercase tracking-wider">
                      India Stack Protocol
                    </span>
                    <span className="text-[10px] text-neu-on-surface-variant font-medium">OCEN 4.0 Enabled</span>
                  </div>
                  <h3 className="text-lg font-bold text-neu-on-surface mt-1">Broadcast Passport to OCEN Network</h3>
                  <p className="text-xs text-neu-on-surface-variant max-w-xl mt-0.5">
                    Transmit an encrypted snapshot of your Credit Passport to SBI, HDFC, ICICI &amp; Bajaj Finserv to trigger an instant multi-lender loan auction.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOcenModalOpen(true)}
                className="shrink-0 flex items-center gap-2 rounded-2xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow-neu-raised hover:brightness-110 active:shadow-neu-inset transition-all"
              >
                <span className="material-symbols-outlined text-base">cell_tower</span>
                Broadcast to Network
              </button>
            </div>
          </NeuCard>
        </section>

        {/* ── Hero: 3 stat cards ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatCard
            label="Total Earned"
            value={summary.total_earned}
            icon="trending_up"
            color="#14b8a6"
            gradient="linear-gradient(135deg, #14b8a6, #0d9488)"
            subtitle={momEarned !== null ? `${Number(momEarned) >= 0 ? '+' : ''}${momEarned}% vs last month` : 'Last 12 months'}
          />
          <StatCard
            label="Total Spent"
            value={summary.total_spent}
            icon="trending_down"
            color="#f43f5e"
            gradient="linear-gradient(135deg, #f43f5e, #e11d48)"
            subtitle={momSpent !== null ? `${Number(momSpent) >= 0 ? '+' : ''}${momSpent}% vs last month` : 'Last 12 months'}
          />
          <StatCard
            label="Net Saved"
            value={summary.total_saved}
            icon="savings"
            color={summary.total_saved >= 0 ? '#a78bfa' : '#fb923c'}
            gradient="linear-gradient(135deg, #a78bfa, #7c3aed)"
            subtitle={`Savings rate: ${savingsRate}%`}
          />
        </section>

        {/* ── Earnings insights ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <NeuCard className="rounded-3xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Avg Monthly Earned</p>
            <p className="mt-2 text-2xl font-extrabold text-brand-teal">{formatRupees(trend_insights.avg_monthly_earned)}</p>
            <p className="mt-1 text-xs text-neu-on-surface-variant">
              Avg Monthly Spent: {formatRupees(trend_insights.avg_monthly_spent)}
            </p>
          </NeuCard>
          <NeuCard className="rounded-3xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Best / Tough Month</p>
            <p className="mt-2 text-sm font-semibold text-neu-on-surface">
              {trend_insights.best_month ? shortMonth(trend_insights.best_month) : 'N/A'} /{' '}
              {trend_insights.worst_month ? shortMonth(trend_insights.worst_month) : 'N/A'}
            </p>
            <p className="mt-1 text-xs text-neu-on-surface-variant">
              Based on monthly net savings.
            </p>
          </NeuCard>
          <NeuCard className="rounded-3xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Spend Concentration</p>
            <p className="mt-2 text-sm font-semibold text-neu-on-surface">
              {trend_insights.top_spend_mode ?? 'N/A'} · {trend_insights.top_spend_mode_share_pct.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-neu-on-surface-variant">
              Your biggest spend channel.
            </p>
          </NeuCard>
        </section>

        {/* ── Monthly trend chart ───────────────────────────────────────── */}
        <section>
          <NeuCard className="rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-neu-on-surface">
                <span className="material-symbols-outlined text-brand-teal">show_chart</span>
                12-Month Trend
              </h3>
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-brand-teal">
                  <span className="inline-block h-2.5 w-6 rounded-full bg-brand-teal" /> Earned
                </span>
                <span className="flex items-center gap-1.5 text-rose-500">
                  <span className="inline-block h-2.5 w-6 rounded-full bg-rose-500" /> Spent
                </span>
              </div>
            </div>
            <TrendChart monthly={monthly} />
          </NeuCard>
        </section>

        {/* ── Bottom bento: Mode chart + Recent transactions ────────────── */}
        <section className="grid grid-cols-1 gap-8 pb-8 lg:grid-cols-2">

          {/* Spending by mode */}
          <NeuCard className="rounded-3xl">
            <div className="mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-gold">payments</span>
              <h3 className="text-lg font-semibold text-neu-on-surface">Spending by Mode</h3>
            </div>
            <ModeChart modes={modes} />

            {/* Savings health indicator */}
            <div className="mt-6 rounded-2xl bg-neu-surface-low/50 p-4 shadow-neu-inset-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">
                Savings Health
              </p>
              <div className="flex items-center gap-3">
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-neu-surface-low shadow-neu-inset-sm">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-teal to-indigo-500 transition-all duration-700"
                    style={{ width: `${Math.min(Math.max(+savingsRate, 0), 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-sm font-bold text-brand-teal">{savingsRate}%</span>
              </div>
              <p className="mt-1.5 text-[11px] text-neu-on-surface-variant">
                {+savingsRate >= 30
                  ? '🟢 Excellent savings discipline'
                  : +savingsRate >= 15
                  ? '🟡 Moderate — aim for 20%+'
                  : '🔴 Low savings rate — review expenses'}
              </p>
            </div>
          </NeuCard>

          {/* Recent transactions */}
          <NeuCard className="rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-neu-on-surface-variant">receipt_long</span>
                <h3 className="text-lg font-semibold text-neu-on-surface">Recent Transactions</h3>
              </div>
              <span className="rounded-full bg-neu-surface-low px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant shadow-neu-inset-sm">
                Last 20
              </span>
            </div>
            <TransactionTable transactions={recent_transactions} />
          </NeuCard>

        </section>

        {/* ── Hybrid budgeting guidance ─────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-8 pb-8 lg:grid-cols-2">
          <NeuCard className="rounded-3xl">
            <div className="mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-teal">savings</span>
              <h3 className="text-lg font-semibold text-neu-on-surface">Budget Targets</h3>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-neu-surface-low/50 p-4 shadow-neu-inset-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Savings Floor</p>
                <p className="mt-1 text-xl font-extrabold text-brand-teal">{formatRupees(budget_guidance.savings_floor_target)}</p>
                <p className="mt-1 text-xs text-neu-on-surface-variant">Recommended minimum monthly savings target.</p>
              </div>
              <div className="rounded-2xl bg-neu-surface-low/50 p-4 shadow-neu-inset-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neu-on-surface-variant">Fixed-Cost Ratio</p>
                <p className="mt-1 text-xl font-extrabold text-neu-on-surface">
                  {trend_insights.fixed_cost_ratio_pct.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-neu-on-surface-variant">
                  Threshold: {budget_guidance.fixed_cost_ratio_threshold_pct.toFixed(0)}% · {fixedCostHealth}
                </p>
              </div>
            </div>
          </NeuCard>

          <NeuCard className="rounded-3xl">
            <div className="mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-gold">tune</span>
              <h3 className="text-lg font-semibold text-neu-on-surface">Variable Spend Caps</h3>
            </div>
            {budget_guidance.variable_caps.length === 0 ? (
              <p className="py-6 text-center text-sm text-neu-on-surface-variant">No variable spend data yet</p>
            ) : (
              <div className="space-y-3">
                {budget_guidance.variable_caps.map((cap) => (
                  <div key={cap.mode} className="rounded-xl bg-neu-surface-low/40 p-3 shadow-neu-inset-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-neu-on-surface">{cap.mode}</p>
                      <p className="text-xs text-neu-on-surface-variant">{cap.share_pct.toFixed(1)}% share</p>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-brand-teal">{formatRupees(cap.cap_amount)} / month</p>
                  </div>
                ))}
              </div>
            )}
          </NeuCard>
        </section>

        {/* ── Actionable insights ────────────────────────────────────────────── */}
        <section className="pb-6">
          <NeuCard className="rounded-3xl border border-brand-gold/20 bg-gradient-to-br from-neu-surface via-neu-surface to-brand-gold/5">
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-gold">auto_awesome</span>
              <h3 className="text-lg font-semibold text-neu-on-surface">AI Financial Analyst</h3>
            </div>
            {data.ai_insight ? (
              <p className="text-sm font-medium leading-relaxed text-neu-on-surface">
                {data.ai_insight}
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-neu-on-surface-variant">
                <li>Set aside at least {formatRupees(budget_guidance.savings_floor_target)} monthly before discretionary spends.</li>
                <li>
                  {trend_insights.fixed_cost_ratio_pct > budget_guidance.fixed_cost_ratio_threshold_pct
                    ? 'Your fixed-cost ratio is above threshold; renegotiate recurring obligations if possible.'
                    : 'Your fixed-cost ratio is within threshold; keep variable expenses under the suggested caps.'}
                </li>
                <li>
                  Focus on reducing spend concentration in {trend_insights.top_spend_mode ?? 'top modes'} to improve cash-flow resilience.
                </li>
                <li>
                  Latest monthly savings rate: {monthly_kpis.length ? `${monthly_kpis[monthly_kpis.length - 1].savings_rate_pct.toFixed(1)}%` : 'N/A'}.
                </li>
              </ul>
            )}
          </NeuCard>
        </section>

        {/* ── Phase 1: Loan Simulator ──────────────────────────────────────── */}
        <section className="pb-12">
          <LoanSimulator businessId={businessId} />
        </section>

        {/* ── Phase 3: OCEN Broadcast Modal ────────────────────────────────── */}
        <OcenBroadcastModal
          businessId={businessId}
          isOpen={ocenModalOpen}
          onClose={() => setOcenModalOpen(false)}
        />
      </div>
    </AppShell>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neu-surface" />}>
      <DashboardContent />
    </Suspense>
  );
}
