'use client';

import React from 'react';
import { useAuthStore } from '../store/authStore';
import { KeyRound } from 'lucide-react';

interface FeatureGateProps {
  featureKey: 'billingEnabled' | 'productsEnabled' | 'paymentsEnabled' | 'reportsEnabled';
  featureName: string;
  children: React.ReactNode;
}

export default function FeatureGate({ featureKey, featureName, children }: FeatureGateProps) {
  const { user } = useAuthStore();

  // Super Admin bypasses all gating limits
  if (user?.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Retrieve setting, default to enabled if undefined
  const isEnabled = user?.tenant?.[featureKey] !== false;

  if (!isEnabled) {
    return (
      <div className="relative w-full min-h-[60vh] flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/10 p-8 text-center overflow-hidden">
        {/* Blurred backdrop mockup showing children locked beneath */}
        <div className="absolute inset-0 filter blur-sm opacity-20 select-none pointer-events-none">
          {children}
        </div>

        {/* Upgrade Block Card */}
        <div className="relative z-10 max-w-md mx-auto p-8 rounded-2xl border border-purple-500/20 bg-zinc-950/80 backdrop-blur-md shadow-2xl flex flex-col items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">{featureName} Locked</h3>
            <p className="mt-2 text-sm text-zinc-400 font-medium leading-relaxed">
              Access to this module has been deactivated under your current organization plan. Contact your platform Super Admin to upgrade.
            </p>
          </div>
          <a
            href="mailto:admin@billnova.com?subject=Feature Upgrade: Sharma Traders"
            className="mt-2 rounded-xl bg-purple-500 px-6 py-3 text-xs font-extrabold text-zinc-950 hover:bg-purple-400 transition duration-150"
          >
            Contact Platform Admin
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
