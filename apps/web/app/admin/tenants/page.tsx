'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { Building2, Mail, Phone, Search, RefreshCw, Ban, Zap, ChevronRight } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'BASIC' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus?: string;
  maxFreeInvoices?: number;
  upgradeRequested?: boolean;
  daysRemaining?: number | null;
  email: string | null;
  phone: string | null;
  deletedAt: string | null;
  users?: { email: string; role: string }[];
  _count: {
    users: number;
    invoices: number;
    customers: number;
  };
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function loadTenants() {
    try {
      setTenants(await api.get('/admin/tenants'));
    } catch (err: any) {
      setError(err.message || 'Failed to load business tenants.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  const q = search.toLowerCase();
  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      t.users?.some((u) => u.email.toLowerCase().includes(q)),
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Building2 className="h-8 w-8 text-purple-400" /> Manage Businesses
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Click a business to manage its plan, feature gates, users and bills.
            </p>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              loadTenants();
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition duration-150 self-start"
          >
            <RefreshCw className="h-4 w-4" /> Refresh List
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-zinc-550" />
          <input
            type="text"
            placeholder="Search by business name, slug or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {loading ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
            <p className="text-sm text-zinc-400 font-medium">Loading tenants database...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 shadow-xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-900/40">
                    <th className="py-4 pl-6">Business</th>
                    <th className="py-4">Owner Login</th>
                    <th className="py-4">Plan</th>
                    <th className="py-4 text-center">Users</th>
                    <th className="py-4 text-center">Clients</th>
                    <th className="py-4 text-center">Bills</th>
                    <th className="py-4 pr-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-sm">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-medium">
                        No businesses found.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => {
                      const isSuspended = !!t.deletedAt;
                      const owner = t.users?.find((u) => u.role === 'ADMIN');
                      return (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/admin/tenants/${t.id}`)}
                          className={`cursor-pointer hover:bg-zinc-900/60 transition-colors ${
                            isSuspended ? 'bg-red-950/5 opacity-75' : ''
                          }`}
                        >
                          <td className="py-4 pl-6">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-white text-base flex items-center gap-2">
                                {t.name}
                                {isSuspended && (
                                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-extrabold text-red-400 uppercase border border-red-500/20 flex items-center gap-1">
                                    <Ban className="h-2.5 w-2.5" /> Suspended
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-zinc-500 font-mono">{t.slug}</span>
                              {t.phone && (
                                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                                  <Phone className="h-3.5 w-3.5 text-zinc-600" /> {t.phone}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4">
                            {owner ? (
                              <span className="flex items-center gap-1.5 text-xs font-mono text-zinc-300">
                                <Mail className="h-3.5 w-3.5 text-zinc-600" /> {owner.email}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border uppercase ${
                                    t.plan === 'BASIC'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : t.plan === 'FREE'
                                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  }`}
                                >
                                  {t.plan}
                                </span>
                                <span
                                  className={`text-[10px] font-bold ${
                                    t.subscriptionStatus === 'EXPIRED' ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {t.subscriptionStatus}
                                </span>
                                {t.upgradeRequested && (
                                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-extrabold text-amber-300 border border-amber-500/30 animate-pulse flex items-center gap-1">
                                    <Zap className="h-2.5 w-2.5 fill-current" /> Requested
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-500">
                                {t.plan === 'FREE'
                                  ? `Trial bills ${t._count.invoices}/${t.maxFreeInvoices ?? 7}`
                                  : t.daysRemaining !== null && t.daysRemaining !== undefined
                                  ? `${t.daysRemaining}d left`
                                  : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-center font-bold text-white">{t._count.users}</td>
                          <td className="py-4 text-center font-bold text-white">{t._count.customers}</td>
                          <td className="py-4 text-center font-bold text-white">{t._count.invoices}</td>
                          <td className="py-4 pr-6 text-right">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-300">
                              Open <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
