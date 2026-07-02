'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import {
  Building2,
  Mail,
  Phone,
  FileSpreadsheet,
  AlertTriangle,
  Search,
  Check,
  Ban,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  billingEnabled: boolean;
  productsEnabled: boolean;
  paymentsEnabled: boolean;
  reportsEnabled: boolean;
  createdAt: string;
  deletedAt: string | null;
  _count: {
    users: number;
    invoices: number;
    customers: number;
  };
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Modals / Status controls
  const [isEditingPlan, setIsEditingPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('FREE');

  async function loadTenants() {
    try {
      const data = await api.get('/admin/tenants');
      setTenants(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load business tenants.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  const handleFeatureToggle = async (tenantId: string, feature: string, currentValue: boolean) => {
    try {
      const payload = { [feature]: !currentValue };
      const updated = await api.patch(`/admin/tenants/${tenantId}`, payload);
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update feature gating.');
    }
  };

  const handlePlanSave = async (tenantId: string) => {
    try {
      const updated = await api.patch(`/admin/tenants/${tenantId}`, { plan: selectedPlan });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
      setIsEditingPlan(null);
    } catch (err: any) {
      alert(err.message || 'Failed to change business plan.');
    }
  };

  const handleSuspendToggle = async (tenantId: string, isCurrentlySuspended: boolean) => {
    const actionText = isCurrentlySuspended ? 'reactivate' : 'suspend';
    if (!confirm(`Are you sure you want to ${actionText} this business?`)) return;
    try {
      const updated = await api.delete(`/admin/tenants/${tenantId}`);
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
    } catch (err: any) {
      alert(err.message || 'Suspension toggle failed.');
    }
  };

  const filteredTenants = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    (t.email && t.email.toLowerCase().includes(search.toLowerCase()))
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
              Audit plans, toggle access module feature flags, view billing logs, and suspend tenant registrations.
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
                    <th className="py-4 pl-6">Business Profile</th>
                    <th className="py-4">Subscription Plan</th>
                    <th className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Sliders className="h-3 w-3 text-purple-400" /> Feature Gates
                      </div>
                    </th>
                    <th className="py-4 text-center">Activity Metrics</th>
                    <th className="py-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-sm">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-500 font-medium">
                        No businesses registered yet.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => {
                      const isSuspended = !!t.deletedAt;
                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-zinc-850/10 transition-colors ${
                            isSuspended ? 'bg-red-950/5 opacity-75' : ''
                          }`}
                        >
                          {/* Business Profile */}
                          <td className="py-5 pl-6">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-white text-base flex items-center gap-2">
                                {t.name}{' '}
                                {isSuspended && (
                                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-extrabold text-red-400 uppercase border border-red-500/20 flex items-center gap-1">
                                    <Ban className="h-2.5 w-2.5" /> Suspended
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-zinc-500 font-mono">slug: {t.slug}</span>
                              <div className="flex flex-col gap-1 mt-1 text-xs text-zinc-400">
                                {t.email && (
                                  <span className="flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-zinc-600" /> {t.email}
                                  </span>
                                )}
                                {t.phone && (
                                  <span className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 text-zinc-600" /> {t.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="py-5">
                            {isEditingPlan === t.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedPlan}
                                  onChange={(e) =>
                                    setSelectedPlan(e.target.value as any)
                                  }
                                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                >
                                  <option value="FREE">FREE</option>
                                  <option value="STARTER">STARTER</option>
                                  <option value="PRO">PRO</option>
                                  <option value="ENTERPRISE">ENTERPRISE</option>
                                </select>
                                <button
                                  onClick={() => handlePlanSave(t.id)}
                                  className="rounded-lg bg-emerald-500 p-1.5 text-zinc-950 hover:bg-emerald-400 transition"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold border uppercase ${
                                    t.plan === 'PRO' || t.plan === 'ENTERPRISE'
                                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  }`}
                                >
                                  {t.plan}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedPlan(t.plan);
                                    setIsEditingPlan(t.id);
                                  }}
                                  className="text-xs font-semibold text-zinc-500 hover:text-purple-400 transition"
                                >
                                  Edit Plan
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Feature Gating Switches */}
                          <td className="py-5">
                            <div className="flex flex-col gap-2 max-w-[200px] mx-auto">
                              {[
                                { label: 'Billing Engine', key: 'billingEnabled', val: t.billingEnabled },
                                { label: 'Product Catalog', key: 'productsEnabled', val: t.productsEnabled },
                                { label: 'Payments Ledger', key: 'paymentsEnabled', val: t.paymentsEnabled },
                                { label: 'Reports Console', key: 'reportsEnabled', val: t.reportsEnabled },
                              ].map((f) => (
                                <div key={f.key} className="flex items-center justify-between text-xs font-medium">
                                  <span className="text-zinc-400">{f.label}</span>
                                  <button
                                    onClick={() => handleFeatureToggle(t.id, f.key, f.val)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      f.val ? 'bg-purple-500' : 'bg-zinc-850'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        f.val ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Activity Metrics */}
                          <td className="py-5 text-center">
                            <div className="inline-grid grid-cols-3 gap-3 text-xs">
                              <div className="flex flex-col border border-zinc-800/80 rounded-lg p-1.5 bg-zinc-900/40">
                                <span className="font-bold text-white">{t._count.users}</span>
                                <span className="text-[9px] text-zinc-555">Users</span>
                              </div>
                              <div className="flex flex-col border border-zinc-800/80 rounded-lg p-1.5 bg-zinc-900/40">
                                <span className="font-bold text-white">{t._count.customers}</span>
                                <span className="text-[9px] text-zinc-555">Clients</span>
                              </div>
                              <div className="flex flex-col border border-zinc-800/80 rounded-lg p-1.5 bg-zinc-900/40">
                                <span className="font-bold text-white">{t._count.invoices}</span>
                                <span className="text-[9px] text-zinc-555">Bills</span>
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-5 pr-6 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href={`/admin/tenants/${t.id}/invoices`}
                                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" /> Audit Bills
                              </Link>
                              
                              <button
                                onClick={() => handleSuspendToggle(t.id, isSuspended)}
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                  isSuspended
                                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10'
                                    : 'border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10'
                                }`}
                              >
                                {isSuspended ? (
                                  <>Reactivate</>
                                ) : (
                                  <>
                                    <AlertTriangle className="h-3.5 w-3.5" /> Suspend
                                  </>
                                )}
                              </button>
                            </div>
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
