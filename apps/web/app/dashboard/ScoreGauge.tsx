'use client';

import React from 'react';

interface ScoreGaugeProps {
  score: number;
  confidence: string;
}

export default function ScoreGauge({ score, confidence }: ScoreGaugeProps) {
  // Score range: 300 to 850 (total range = 550)
  const minScore = 300;
  const maxScore = 850;
  const clampedScore = Math.max(minScore, Math.min(maxScore, score));
  const percentage = (clampedScore - minScore) / (maxScore - minScore);

  // SVG Gauge calculations
  const radius = 80;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  // We want a semi-circle/arc. Let's make it 270 degrees (3/4 of a circle)
  // Arc starts at 135 deg and ends at 405 deg.
  const angleRange = 270;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage * angleRange / 360) * circumference;

  // Determine color based on score
  let strokeColor = '#EF4444'; // Red for poor (< 550)
  let statusText = 'Poor';
  if (clampedScore >= 750) {
    strokeColor = '#10B981'; // Green for excellent
    statusText = 'Excellent';
  } else if (clampedScore >= 650) {
    strokeColor = '#F59E0B'; // Amber for good
    statusText = 'Good';
  } else if (clampedScore >= 550) {
    strokeColor = '#EAB308'; // Yellow for fair
    statusText = 'Fair';
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden group">
      {/* Glow Effect */}
      <div 
        className="absolute inset-0 opacity-10 blur-3xl transition-all duration-1000" 
        style={{
          background: `radial-gradient(circle, ${strokeColor} 0%, transparent 70%)`
        }}
      />
      
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* SVG Arc Gauge */}
        <svg className="w-full h-full transform -rotate-225" viewBox="0 0 200 200">
          {/* Background Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#1E293B"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (angleRange / 360) * circumference}
            strokeLinecap="round"
          />
          {/* Foreground Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Text Inside Gauge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Score</span>
          <span className="text-5xl font-extrabold text-white tracking-tight tabular-nums transition-all duration-500">
            {clampedScore}
          </span>
          <span 
            className="text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full uppercase tracking-wider transition-all duration-300"
            style={{ backgroundColor: `${strokeColor}20`, color: strokeColor }}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="mt-4 flex items-center gap-2 z-10">
        <span className="text-xs text-slate-400">Confidence:</span>
        <span 
          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
            confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400' :
            confidence === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
            'bg-rose-500/10 text-rose-400'
          }`}
        >
          {confidence}
        </span>
      </div>
    </div>
  );
}
