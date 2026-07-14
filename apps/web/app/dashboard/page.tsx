'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';
import { NeuGauge } from '../../components/ui/NeuGauge';
import { NeuToggle } from '../../components/ui/NeuToggle';

interface ScoreDriver {
  feature: string;
  label: string;
  direction: 'positive' | 'negative';
  impact: number;
  raw_value: number;
  human_note: string;
}

interface ScoreData {
  score: number;
  confidence: string;
  model_version: string;
  drivers: ScoreDriver[];
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const businessId = searchParams.get('businessId');

  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [shareScope, setShareScope] = useState<'SCORE_ONLY' | 'FULL_PROFILE' | 'SNAPSHOT'>('SCORE_ONLY');
  const [mintingToken, setMintingToken] = useState(false);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    if (!businessId) {
      router.push('/login');
      return;
    }

    const fetchScore = async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/score`, {
          headers: {
            'X-API-Key': 'dev-secret-change-me-in-prod',
          }
        });
        if (!res.ok) {
          throw new Error('Failed to fetch score or no data exists.');
        }
        const data = await res.json();
        setScoreData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, [businessId, router]);

  const handleMintToken = async () => {
    if (!businessId) return;
    setMintingToken(true);
    setShareLink('');
    try {
      const res = await fetch(`/api/shares?business_id=${businessId}`, {
        method: 'POST',
        headers: {
          'X-API-Key': 'dev-secret-change-me-in-prod',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scope: shareScope,
          ttl_hours: 72
        })
      });
      if (!res.ok) throw new Error('Failed to mint token');
      const data = await res.json();
      
      // Assume frontend is hosted at same origin
      const link = `${window.location.origin}/api/shares/${data.token}`;
      setShareLink(link);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMintingToken(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-navy text-white">
        Loading passport...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-navy p-6">
        <NeuCard className="text-center max-w-md w-full">
          <p className="text-red-400 mb-6">{error}</p>
          <NeuButton onClick={() => router.push('/login')}>Go Back</NeuButton>
        </NeuCard>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-12 bg-brand-navy text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-700/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Business Passport</h1>
            <p className="text-gray-400 font-mono text-sm mt-1">{businessId}</p>
          </div>
          <NeuButton onClick={() => router.push('/login')} variant="secondary" className="mt-4 md:mt-0">
            Sign Out
          </NeuButton>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Score Gauge & Sharing */}
          <div className="space-y-8 lg:col-span-1">
            <NeuCard className="flex flex-col items-center py-10">
              <NeuGauge score={scoreData?.score || 0} maxScore={1000} label="Credit Score" />
              
              <div className="mt-8 text-center space-y-1">
                <p className="text-gray-400 uppercase tracking-widest text-xs font-semibold">Confidence</p>
                <p className="text-brand-gold font-medium">{scoreData?.confidence}</p>
              </div>
            </NeuCard>

            <NeuCard className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Share Passport</h3>
                <p className="text-sm text-gray-400">Generate a secure token for lenders.</p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col space-y-3 p-4 bg-brand-navy shadow-neu-down rounded-xl">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={shareScope === 'SCORE_ONLY'} 
                      onChange={() => setShareScope('SCORE_ONLY')}
                      className="text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-sm text-gray-200">Score Only (72h)</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={shareScope === 'FULL_PROFILE'} 
                      onChange={() => setShareScope('FULL_PROFILE')}
                      className="text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-sm text-gray-200">Full Profile (72h)</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={shareScope === 'SNAPSHOT'} 
                      onChange={() => setShareScope('SNAPSHOT')}
                      className="text-brand-teal focus:ring-brand-teal"
                    />
                    <span className="text-sm text-gray-200">One-Time Snapshot</span>
                  </label>
                </div>

                <NeuButton onClick={handleMintToken} disabled={mintingToken} className="w-full">
                  {mintingToken ? 'Minting...' : 'Mint Token'}
                </NeuButton>

                {shareLink && (
                  <div className="mt-4 p-3 bg-brand-navy shadow-neu-down rounded-lg overflow-x-auto">
                    <p className="text-xs text-gray-400 mb-1">Share Link (Public Resolver):</p>
                    <code className="text-sm text-brand-teal select-all">{shareLink}</code>
                  </div>
                )}
              </div>
            </NeuCard>
          </div>

          {/* Right Column: Drivers */}
          <div className="lg:col-span-2">
            <NeuCard className="h-full">
              <h2 className="text-xl font-bold mb-6">Score Drivers</h2>
              <div className="space-y-4">
                {scoreData?.drivers?.map((driver, idx) => (
                  <div key={idx} className="bg-brand-navy shadow-neu-up-sm rounded-xl p-5 flex flex-col md:flex-row md:items-start gap-4">
                    
                    {/* Direction Icon / Impact Badge */}
                    <div className="flex-shrink-0 pt-1">
                      {driver.direction === 'positive' ? (
                        <div className="w-12 h-12 rounded-full bg-brand-navy shadow-neu-up flex items-center justify-center text-brand-teal font-bold">
                          +{driver.impact.toFixed(1)}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand-navy shadow-neu-down flex items-center justify-center text-brand-gold font-bold">
                          {driver.impact.toFixed(1)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-lg">{driver.label}</h4>
                        <span className="text-xs font-mono text-gray-500 bg-brand-navy shadow-neu-down px-2 py-1 rounded">
                          raw: {driver.raw_value.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed pt-1">
                        {driver.human_note}
                      </p>
                    </div>
                  </div>
                ))}
                
                {(!scoreData?.drivers || scoreData.drivers.length === 0) && (
                  <p className="text-gray-500 italic text-center py-10">No drivers available.</p>
                )}
              </div>
            </NeuCard>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-navy" />}>
      <DashboardContent />
    </Suspense>
  );
}
