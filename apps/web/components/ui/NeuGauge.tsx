'use client';

import React, { useEffect, useId, useState } from 'react';

interface NeuGaugeProps {
  score: number;
  maxScore?: number;
  confidence?: string;
  modelVersion?: string;
  size?: number;
}

export function NeuGauge({
  score,
  maxScore = 1000,
  confidence = 'HIGH',
  modelVersion,
  size = 320,
}: NeuGaugeProps) {
  const gradientId = useId();
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedScore(score), 150);
    return () => clearTimeout(timeout);
  }, [score]);

  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(animatedScore / maxScore, 1));
  const strokeDashoffset = circumference - progress * circumference;

  const innerSize = size * 0.62;

  return (
    <div className="flex flex-col items-center animate-fade-in">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer track — inset ring */}
        <div
          className="absolute rounded-full bg-neu-surface shadow-neu-inset"
          style={{ width: size, height: size }}
        />

        <svg
          className="absolute -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0F9E8F" />
              <stop offset="100%" stopColor="#D9A441" />
            </linearGradient>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#DDE2E8"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-[1.2s] ease-out drop-shadow-sm"
          />
        </svg>

        {/* Inner raised disc */}
        <div
          className="absolute z-10 flex flex-col items-center justify-center rounded-full bg-neu-surface shadow-neu-raised"
          style={{ width: innerSize, height: innerSize }}
        >
          <span className="text-5xl font-bold tracking-tight text-brand-teal tabular-nums">
            {Math.round(animatedScore)}
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-neu-on-surface-variant">
            of {maxScore}
          </span>
          <span className="mt-3 rounded-full bg-brand-teal/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-teal">
            {confidence} confidence
          </span>
        </div>
      </div>

      <div className="mt-8 text-center animate-slide-up">
        <h2 className="text-2xl font-bold text-neu-on-surface">Credit Passport Score</h2>
        {modelVersion && (
          <p className="mt-1 text-sm text-neu-on-surface-variant">
            Model{' '}
            <span className="font-mono font-medium text-brand-teal">{modelVersion}</span>
          </p>
        )}
      </div>
    </div>
  );
}
