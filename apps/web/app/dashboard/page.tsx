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
    <NeuCard className="relative overflow-hidden rounded-3xl">
      {/* Decorative glow blob */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl"
        style={{ background: gradient }}
      />
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px]" style={{ color }}>
            {icon}
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

  const { summary, monthly, modes, recent_transactions } = data;
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

  return (
    <AppShell title="Dashboard" businessId={businessId}>
      <div className="mx-auto max-w-5xl space-y-10">

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
