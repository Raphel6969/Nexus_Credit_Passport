'use client';
import React, { useEffect, useState } from 'react';

interface NeuGaugeProps {
  score: number;
  maxScore?: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

export function NeuGauge({
  score,
  maxScore = 1000,
  label = 'Score',
  size = 200,
  strokeWidth = 16,
}: NeuGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    // Simple animation for the score
    const timeout = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timeout);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.max(0, Math.min(animatedScore / maxScore, 1));
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      {/* Neumorphic base ring */}
      <div 
        className="absolute rounded-full bg-brand-navy shadow-neu-down"
        style={{ width: size, height: size }}
      />
      
      {/* Neumorphic inner raised center */}
      <div 
        className="absolute rounded-full bg-brand-navy shadow-neu-up flex flex-col items-center justify-center"
        style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}
      >
        <span className="text-4xl font-bold text-brand-teal drop-shadow-[0_0_8px_rgba(15,158,143,0.8)]">
          {animatedScore}
        </span>
        <span className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wider">
          {label}
        </span>
      </div>

      {/* SVG progress ring */}
      <svg
        className="absolute transform -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Glow filter */}
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#0F9E8F" /* brand-teal */
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter="url(#glow)"
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
        />
      </svg>
    </div>
  );
}
