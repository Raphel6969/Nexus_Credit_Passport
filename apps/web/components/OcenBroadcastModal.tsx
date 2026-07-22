'use client';

import React, { useState } from 'react';
import { NeuCard } from './ui/NeuCard';
import { NeuButton } from './ui/NeuButton';
import { broadcastToOcen, OcenBroadcastResponse, OcenOffer } from '../lib/api';

interface OcenBroadcastModalProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
}

const LENDER_LOGOS: Record<string, { bg: string; text: string; icon: string }> = {
  sbi: { bg: 'bg-blue-600', text: 'text-white', icon: 'account_balance' },
  hdfc: { bg: 'bg-red-600', text: 'text-white', icon: 'domain' },
  icici: { bg: 'bg-orange-500', text: 'text-white', icon: 'payments' },
  bajaj: { bg: 'bg-cyan-600', text: 'text-white', icon: 'electric_bolt' },
};

export function OcenBroadcastModal({ businessId, isOpen, onClose }: OcenBroadcastModalProps) {
  const [step, setStep] = useState<'idle' | 'broadcasting' | 'results' | 'success'>('idle');
  const [broadcastLog, setBroadcastLog] = useState<string[]>([]);
  const [data, setData] = useState<OcenBroadcastResponse | null>(null);
  const [error, setError] = useState('');
  const [acceptedOffer, setAcceptedOffer] = useState<OcenOffer | null>(null);

  if (!isOpen) return null;

  const startBroadcast = async () => {
    setStep('broadcasting');
    setError('');
    setBroadcastLog([]);

    const addLog = (msg: string) => setBroadcastLog((prev) => [...prev, msg]);

    try {
      addLog('🔐 Generating ZK-Attestation of Credit Passport...');
      await new Promise((r) => setTimeout(r, 600));

      addLog('🌐 Connecting to OCEN 4.0 Protocol Gateway...');
      await new Promise((r) => setTimeout(r, 600));

      addLog('📡 Broadcasting encrypted digest to SBI, HDFC, ICICI & Bajaj Finserv...');
      const res = await broadcastToOcen(businessId, 1500000);
      await new Promise((r) => setTimeout(r, 800));

      addLog(`⚡ Received ${res.offers.filter((o) => o.status === 'APPROVED').length} pre-approved bids!`);
      await new Promise((r) => setTimeout(r, 400));

      setData(res);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'OCEN network broadcast failed.');
      setStep('idle');
    }
  };

  const handleAccept = (offer: OcenOffer) => {
    setAcceptedOffer(offer);
    setStep('success');
  };

  const resetModal = () => {
    setStep('idle');
    setData(null);
    setAcceptedOffer(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-neu-surface p-6 shadow-2xl border border-brand-teal/20">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neu-surface-low pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal shadow-neu-inset-sm">
              <span className="material-symbols-outlined">hub</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-neu-on-surface">OCEN Network Broadcast</h2>
              <p className="text-xs text-neu-on-surface-variant">
                Broadcast your passport across India Stack lenders for real-time competing loan bids
              </p>
            </div>
          </div>
          <button
            onClick={resetModal}
            className="rounded-xl p-2 text-neu-on-surface-variant hover:bg-neu-surface-low transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* STEP: IDLE */}
        {step === 'idle' && (
          <div className="text-center py-8 space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal shadow-neu-raised">
              <span className="material-symbols-outlined text-4xl animate-pulse">cell_tower</span>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-bold text-neu-on-surface">One-Click Multi-Lender Auction</h3>
              <p className="text-sm text-neu-on-surface-variant">
                By clicking broadcast, your verified financial passport will be transmitted via OCEN APIs to 
                participating banks. Receive live, competing pre-approved offers in seconds.
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-neu-error bg-neu-error/10 p-3 rounded-xl max-w-md mx-auto">
                {error}
              </p>
            )}

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={resetModal}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-neu-on-surface-variant shadow-neu-raised hover:shadow-neu-inset transition-all"
              >
                Cancel
              </button>
              <NeuButton onClick={startBroadcast} size="lg">
                <span className="material-symbols-outlined mr-2">cell_tower</span>
                Start Network Broadcast
              </NeuButton>
            </div>
          </div>
        )}

        {/* STEP: BROADCASTING ANIMATION */}
        {step === 'broadcasting' && (
          <div className="py-12 text-center space-y-8">
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal shadow-neu-inset">
              <span className="material-symbols-outlined text-5xl animate-spin">sync</span>
              <span className="absolute inset-0 rounded-full border-2 border-brand-teal animate-ping opacity-25"></span>
            </div>

            <div className="max-w-lg mx-auto space-y-3">
              <h3 className="text-lg font-bold text-neu-on-surface">Broadcasting to OCEN Gateway...</h3>
              
              <div className="rounded-2xl bg-neu-surface-low p-4 shadow-neu-inset text-left space-y-2 font-mono text-xs text-brand-teal">
                {broadcastLog.map((log, index) => (
                  <div key={index} className="flex items-center gap-2 animate-fade-in">
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP: RESULTS / MARKETPLACE */}
        {step === 'results' && data && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl bg-brand-teal/5 p-4 border border-brand-teal/20">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-teal">verified</span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-teal">Broadcast ID</span>
                  <p className="font-mono text-xs font-bold text-neu-on-surface">{data.broadcast_id}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-neu-on-surface-variant">Credit Score</span>
                <p className="text-lg font-black text-brand-teal">{data.score} ({data.confidence})</p>
              </div>
            </div>

            <h3 className="text-md font-bold text-neu-on-surface">Live Lender Pre-Approved Offers</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.offers.map((offer) => {
                const logoInfo = LENDER_LOGOS[offer.lender_id] || { bg: 'bg-neu-surface-low', text: 'text-neu-on-surface', icon: 'account_balance' };
                const isApproved = offer.status === 'APPROVED';

                return (
                  <div
                    key={offer.lender_id}
                    className={`rounded-3xl p-5 border transition-all ${
                      isApproved
                        ? 'bg-neu-surface border-brand-teal/30 shadow-neu-raised'
                        : 'bg-neu-surface-low/50 border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${logoInfo.bg} ${logoInfo.text} font-bold shadow`}>
                          <span className="material-symbols-outlined">{logoInfo.icon}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-neu-on-surface text-sm">{offer.lender_name}</h4>
                          <span className="text-[10px] text-neu-on-surface-variant">{offer.lender_type}</span>
                        </div>
                      </div>

                      {isApproved ? (
                        <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-[10px] font-bold text-brand-teal">
                          {offer.badge}
                        </span>
                      ) : (
                        <span className="rounded-full bg-neu-error/10 px-2.5 py-1 text-[10px] font-bold text-neu-error">
                          Declined
                        </span>
                      )}
                    </div>

                    {isApproved ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs bg-neu-surface-low/50 p-3 rounded-2xl shadow-neu-inset-sm">
                          <div>
                            <span className="text-neu-on-surface-variant block text-[10px]">Pre-Approved Limit</span>
                            <strong className="text-sm text-brand-teal">₹{offer.max_amount.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-neu-on-surface-variant block text-[10px]">Interest Rate</span>
                            <strong className="text-sm text-neu-on-surface">{offer.interest_rate_pct}% APR</strong>
                          </div>
                          <div className="mt-1">
                            <span className="text-neu-on-surface-variant block text-[10px]">Tenure</span>
                            <strong className="text-neu-on-surface">{offer.tenure_months} months</strong>
                          </div>
                          <div className="mt-1">
                            <span className="text-neu-on-surface-variant block text-[10px]">Disbursal Speed</span>
                            <strong className="text-brand-gold">{offer.disbursal_time}</strong>
                          </div>
                        </div>

                        <NeuButton
                          onClick={() => handleAccept(offer)}
                          className="w-full"
                          size="sm"
                        >
                          <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
                          Select &amp; Initiate Disbursal
                        </NeuButton>
                      </div>
                    ) : (
                      <div className="p-3 bg-neu-error/5 rounded-2xl text-xs text-neu-error">
                        <strong>Reason:</strong> {offer.rejection_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === 'success' && acceptedOffer && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-500 shadow-neu-raised">
              <span className="material-symbols-outlined text-5xl">task_alt</span>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-neu-on-surface">Offer Accepted!</h3>
              <p className="text-sm text-neu-on-surface-variant">
                You have accepted the pre-approved offer from <strong>{acceptedOffer.lender_name}</strong> for{' '}
                <strong className="text-brand-teal">₹{acceptedOffer.max_amount.toLocaleString()}</strong> at{' '}
                <strong>{acceptedOffer.interest_rate_pct}% APR</strong>.
              </p>
            </div>

            <div className="max-w-md mx-auto rounded-2xl bg-neu-surface-low p-4 shadow-neu-inset text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neu-on-surface-variant">Disbursal ETA:</span>
                <strong className="text-brand-gold">{acceptedOffer.disbursal_time}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neu-on-surface-variant">Processing Fee:</span>
                <span>{acceptedOffer.processing_fee_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neu-on-surface-variant">Destination Account:</span>
                <span>Primary Bank Account (Verified)</span>
              </div>
            </div>

            <NeuButton onClick={resetModal} size="lg">
              Done
            </NeuButton>
          </div>
        )}

      </div>
    </div>
  );
}
