'use client';

import React, { useState, useEffect } from 'react';
import { NeuCard } from './ui/NeuCard';
import { NeuButton } from './ui/NeuButton';
import { fetchStressTest, StressTestData } from '../lib/api';

interface LoanSimulatorProps {
  businessId: string;
}

export function LoanSimulator({ businessId }: LoanSimulatorProps) {
  const [amount, setAmount] = useState<number>(100000);
  const [rate, setRate] = useState<number>(12);
  const [tenure, setTenure] = useState<number>(12);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StressTestData | null>(null);
  const [error, setError] = useState('');

  const runSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchStressTest(businessId, amount, rate, tenure);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to run simulation.');
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first mount
  useEffect(() => {
    runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  return (
    <div className="space-y-6">
      <NeuCard className="p-6">
        <h2 className="text-xl font-bold mb-4">Loan EMI Simulator</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-500 font-medium">
              Loan Amount: ₹{amount.toLocaleString()}
            </label>
            <input 
              type="range" 
              min="10000" 
              max="5000000" 
              step="10000"
              value={amount} 
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-500 font-medium">
              Interest Rate: {rate}%
            </label>
            <input 
              type="range" 
              min="5" 
              max="36" 
              step="0.5"
              value={rate} 
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-500 font-medium">
              Tenure: {tenure} months
            </label>
            <input 
              type="range" 
              min="3" 
              max="60" 
              step="1"
              value={tenure} 
              onChange={(e) => setTenure(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <NeuButton onClick={runSimulation} disabled={loading}>
            {loading ? 'Calculating...' : 'Run Stress Test'}
          </NeuButton>
        </div>
      </NeuCard>

      {error && (
        <div className="text-red-500 font-medium text-center">{error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <NeuCard className="p-6 lg:col-span-2 flex flex-col justify-end">
            <h3 className="text-lg font-bold mb-4">Free Cash Flow vs EMI</h3>
            
            <div className="flex items-end space-x-2 h-64 mt-4 w-full justify-between overflow-hidden">
              {data.fcf_history.map((m, i) => {
                const maxVal = Math.max(
                  1,
                  data.loan_details.emi,
                  ...data.fcf_history.map((x) => Math.max(x.fcf, x.earned, 0))
                );
                const fcfHeight = Math.min(100, Math.max((Math.max(0, m.fcf) / maxVal) * 100, 2));
                const emiHeight = Math.min(100, Math.max((data.loan_details.emi / maxVal) * 100, 2));
                
                return (
                  <div key={i} className="flex flex-col items-center justify-end h-full w-full group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs p-2 rounded pointer-events-none whitespace-nowrap z-20">
                      <div>FCF: ₹{m.fcf.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                      <div>EMI: ₹{Math.round(data.loan_details.emi).toLocaleString()}</div>
                    </div>
                    
                    <div className="flex space-x-1 w-full justify-center h-full items-end">
                      <div 
                        className={`w-1/2 rounded-t-sm transition-all duration-500 ${m.fcf < data.loan_details.emi ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ height: `${fcfHeight}%` }}
                      ></div>
                      <div 
                        className="w-1/2 bg-blue-500 rounded-t-sm transition-all duration-500"
                        style={{ height: `${emiHeight}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-2">{m.month.split('-')[1]}</span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center space-x-6 mt-6 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                <span>Free Cash Flow (FCF)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span>Projected EMI</span>
              </div>
            </div>
          </NeuCard>

          {/* AI Analysis Section */}
          <NeuCard className="p-6 flex flex-col justify-center">
            <h3 className="text-lg font-bold mb-4 text-center">AI Risk Analysis</h3>
            <div className="text-center mb-6">
              <div className="text-gray-500 text-sm">Monthly EMI</div>
              <div className="text-4xl font-black text-blue-500">
                ₹{Math.round(data.loan_details.emi).toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-gray-100 rounded-xl shadow-inner text-gray-700 leading-relaxed text-sm">
              <strong className="text-blue-600 block mb-2">Groq AI Verdict:</strong>
              {data.ai_analysis}
            </div>
          </NeuCard>
        </div>
      )}
    </div>
  );
}
