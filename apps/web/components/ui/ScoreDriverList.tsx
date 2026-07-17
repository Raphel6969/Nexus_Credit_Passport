import React from 'react';
import type { ScoreDriver } from '../../lib/api';

interface ScoreDriverListProps {
  drivers: ScoreDriver[];
  emptyMessage?: string;
}

export function ScoreDriverList({
  drivers,
  emptyMessage = 'No score drivers available yet.',
}: ScoreDriverListProps) {
  if (!drivers.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="material-symbols-outlined text-4xl text-neu-on-surface-variant/30">
          analytics
        </span>
        <p className="text-sm italic text-neu-on-surface-variant">{emptyMessage}</p>
      </div>
    );
  }

  const positives = drivers.filter((d) => d.direction === 'positive');
  const negatives = drivers.filter((d) => d.direction === 'negative');

  return (
    <div className="flex flex-col gap-6">
      {positives.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-teal">
            Strengths
          </p>
          <div className="flex flex-col gap-3">
            {positives.map((driver) => (
              <DriverRow key={driver.feature} driver={driver} />
            ))}
          </div>
        </div>
      )}

      {negatives.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-gold">
            Areas to Improve
          </p>
          <div className="flex flex-col gap-3">
            {negatives.map((driver) => (
              <DriverRow key={driver.feature} driver={driver} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DriverRow({ driver }: { driver: ScoreDriver }) {
  const isPositive = driver.direction === 'positive';
  const impactWidth = Math.min(Math.abs(driver.impact) * 10, 100);

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-neu-surface p-4 shadow-neu-inset-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neu-on-surface">{driver.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neu-on-surface-variant">
          {driver.human_note}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={`text-sm font-bold tabular-nums ${isPositive ? 'text-brand-teal' : 'text-brand-gold'}`}
        >
          {isPositive ? '+' : ''}
          {driver.impact.toFixed(1)}
        </span>
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-neu-surface-low shadow-neu-inset-sm">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isPositive ? 'bg-brand-teal' : 'bg-brand-gold'}`}
            style={{ width: `${impactWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}
