'use client';

import React, { useState, useEffect } from 'react';
import ScoreGauge from './ScoreGauge';

interface ScoreData {
  business_id: string;
  score: number;
  confidence: string;
  note: string;
  model_version: string;
}

export default function Dashboard() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);

  const businessId = '00000000-0000-0000-0000-000000000001'; // Mock Business UUID

  const fetchScore = async () => {
    try {
      setLoading(true);
      setError(null);
      setNoData(false);
      const res = await fetch('/api/score');
      if (res.status === 404) {
        setNoData(true);
        setScoreData(null);
      } else if (!res.ok) {
        throw new Error('Failed to load score data');
      } else {
        const data = await res.json();
        setScoreData(data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch('/api/ingest', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to trigger Setu AA ingestion');
      }
      // Wait 1.5s for write simulation, then refresh score
      setTimeout(async () => {
        await fetchScore();
        setSyncing(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred during sync');
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchScore();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center font-bold text-slate-950">
              N
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Nexus Credit Passport
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
              Business ID: {businessId.slice(0, 8)}...
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        {loading && !syncing ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400 animate-pulse">Retrieving Passport data...</span>
          </div>
        ) : noData ? (
          /* Empty / Unconnected State */
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-12 text-center flex flex-col items-center max-w-xl mx-auto shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent pointer-events-none" />
            
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6 text-teal-400 text-2xl">
              🔑
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Create your Credit Passport</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Nexus uses India&apos;s Account Aggregator framework to securely analyze your bank records. Connect your AA account to calculate your portable credit score.
            </p>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-teal-500/20 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Ingesting Sandbox AA Rails...</span>
                </>
              ) : (
                <span>Connect via Account Aggregator</span>
              )}
            </button>

            {error && (
              <p className="mt-4 text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                {error}
              </p>
            )}
          </div>
        ) : (
          /* Connected Dashboard State */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Left Column: Gauge */}
            <div className="md:col-span-1 flex flex-col gap-6">
              {scoreData && (
                <ScoreGauge score={scoreData.score} confidence={scoreData.confidence} />
              )}
              
              {/* Sync Trigger Action Card */}
              <div className="p-5 bg-slate-900/30 border border-slate-900 rounded-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AA Data Source</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  Calculated using mock bank records simulated via Setu AA Sandbox APIs.
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all duration-200 border border-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <span>Refresh Records</span>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Passport Breakdown */}
            <div className="md:col-span-2 flex flex-col gap-6">
              {/* Business Identity */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Passport Identification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/50">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Company PAN Hash</span>
                    <span className="font-mono text-xs text-slate-300">sha256_bcdef2345g...</span>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/50">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">GSTIN Verification</span>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <span>✓</span> Active GSTIN
                    </span>
                  </div>
                </div>
              </div>

              {/* Scoring Summary Explanation */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Scoring Metadata</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2">
                    <span className="text-slate-400">Model Engine</span>
                    <span className="font-mono text-slate-200">{scoreData?.model_version}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-900 pb-2">
                    <span className="text-slate-400">Score Range</span>
                    <span className="text-slate-200">300 - 850</span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs pt-1">
                    <span className="text-slate-400">Model Explanation / System Note</span>
                    <p className="text-slate-300 leading-relaxed italic bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                      &quot;{scoreData?.note}&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
