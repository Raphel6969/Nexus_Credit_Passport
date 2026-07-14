'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NeuCard } from '../../components/ui/NeuCard';
import { NeuButton } from '../../components/ui/NeuButton';

export default function LoginPage() {
  const [businessId, setBusinessId] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessId.trim()) {
      router.push(`/dashboard?businessId=${encodeURIComponent(businessId.trim())}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-brand-navy">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Nexus Portal</h1>
          <p className="text-brand-teal text-sm uppercase tracking-widest font-semibold">Credit Passport</p>
        </div>
        
        <NeuCard>
          <form onSubmit={handleLogin} className="flex flex-col space-y-6">
            <div className="flex flex-col space-y-2">
              <label htmlFor="businessId" className="text-sm font-medium text-gray-300">
                Business ID
              </label>
              <input
                id="businessId"
                type="text"
                required
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="Enter your UUID..."
                className="w-full bg-brand-navy shadow-neu-down rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-teal transition-all"
              />
            </div>
            
            <NeuButton type="submit" className="w-full">
              Access Dashboard
            </NeuButton>
          </form>
        </NeuCard>
      </div>
    </main>
  );
}
