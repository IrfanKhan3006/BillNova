'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import {
  Building2,
  Users,
  IndianRupee,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalTenants: number;
  totalUsers: number;
  totalRevenue: number;
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  planStats: {
    FREE: number;
    STARTER: number;
    PRO: number;
    ENTERPRISE: number;
  };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.get('/admin/dashboard');
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load platform stats.');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
          <p className="text-sm text-zinc-400 font-medium">Fetching platform analytics...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error || !stats) {
    return (
      <AdminLayout>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-red-400 font-semibold">{error || 'An error occurred.'}</p>
        </div>
      </AdminLayout>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const statCards = [
    {
      title: 'Total Businesses',
      value: stats.totalTenants,
      icon: Building2,
      color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/20',
      description: 'Active companies registered',
    },
    {
      title: 'Platform Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/20',
      description: 'Active staff & owner profiles',
    },
    {
      title: 'Aggregate Revenue Generated',
      value: formatCurrency(stats.totalRevenue),
      icon: IndianRupee,
      color: 'from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/20',
      description: 'Platform wide invoice billing',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header section */}
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Platform Overview</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time operations, tenant growth metrics, and aggregate platform sales audits.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-zinc-700/60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {card.title}
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-white tracking-tight">
                      {card.value}
                    </p>
                  </div>
                  <div className={`rounded-xl border bg-gradient-to-br p-3 ${card.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-zinc-500 font-medium">{card.description}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Tenants Table */}
          <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Recent Business Registrations</h3>
              </div>
              <Link
                href="/admin/tenants"
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="pb-3 pl-2">Business Name</th>
                    <th className="pb-3">Contact Email</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3 pr-2 text-right">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-sm">
                  {stats.recentTenants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500">
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    stats.recentTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-850/20 transition-colors">
                        <td className="py-4 pl-2 font-medium text-white">{t.name}</td>
                        <td className="py-4 text-zinc-400">{t.email || t.phone || 'N/A'}</td>
                        <td className="py-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border uppercase ${
                              t.plan === 'PRO' || t.plan === 'ENTERPRISE'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {t.plan}
                          </span>
                        </td>
                        <td className="py-4 pr-2 text-right text-zinc-500 text-xs font-medium">
                          {new Date(t.createdAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subscriptions breakdown */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Layers className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Subscription Split</h3>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'Free Tier', value: stats.planStats.FREE, total: stats.totalTenants, color: 'bg-zinc-700' },
                  { name: 'Starter Tier', value: stats.planStats.STARTER, total: stats.totalTenants, color: 'bg-blue-500' },
                  { name: 'Professional Tier', value: stats.planStats.PRO, total: stats.totalTenants, color: 'bg-purple-500' },
                  { name: 'Enterprise Tier', value: stats.planStats.ENTERPRISE, total: stats.totalTenants, color: 'bg-pink-500' },
                ].map((tier, idx) => {
                  const pct = tier.total > 0 ? (tier.value / tier.total) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-zinc-400">{tier.name}</span>
                        <span className="text-white font-bold">{tier.value} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${tier.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-t border-zinc-800/80 pt-6 flex items-center justify-between text-xs font-semibold text-zinc-500">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <TrendingUp className="h-4 w-4" /> Healthy Growth
              </span>
              <span>100% Platform Uptime</span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
