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
  Key,
  X,
  Zap,
  Clock,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { toast, showConfirm } from '../../store/uiStore';

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'BASIC' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus?: string;
  planExpiresAt?: string | null;
  maxFreeInvoices?: number;
  planPrice?: number;
  upgradeRequested?: boolean;
  upgradeRequestedAt?: string | null;
  isLimitReached?: boolean;
  daysRemaining?: number | null;
  invoicesRemaining?: number;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  billingEnabled: boolean;
  productsEnabled: boolean;
  paymentsEnabled: boolean;
  reportsEnabled: boolean;
  purchasesEnabled?: boolean;
  businessType?: string;
  trackInventory?: boolean;
  theme?: string;
  createdAt: string;
  deletedAt: string | null;
  users?: TenantUser[];
  _count: {
    users: number;
    invoices: number;
    customers: number;
    purchaseInvoices?: number;
  };
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Modals / Status controls
  const [isEditingPlan, setIsEditingPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'BASIC' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('FREE');

  // Credentials / logins controls
  const [activeTenantForLogins, setActiveTenantForLogins] = useState<Tenant | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [isResetting, setIsResetting] = useState(false);

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
      toast.success('Feature gate updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update feature gating.');
    }
  };

  const handleBusinessTypeChange = async (tenantId: string, newType: string) => {
    try {
      const isServiceType = newType === 'SERVICES_TRAVEL' || newType === 'SERVICES_GENERAL';
      const payload: any = { businessType: newType };
      if (isServiceType) {
        payload.trackInventory = false;
      }
      const updated = await api.patch(`/admin/tenants/${tenantId}`, payload);
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
      toast.success('Business model updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update business type.');
    }
  };

  const handleThemeChange = async (tenantId: string, theme: string) => {
    try {
      const updated = await api.patch(`/admin/tenants/${tenantId}`, { theme });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
      toast.success('Business theme updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update business theme.');
    }
  };

  const handlePlanSave = async (tenantId: string) => {
    try {
      const updated = await api.patch(`/admin/tenants/${tenantId}`, { plan: selectedPlan });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
      setIsEditingPlan(null);
      toast.success('Plan changed successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change business plan.');
    }
  };

  const handleQuickActivatePlan = async (tenantId: string, businessName: string) => {
    const ok = await showConfirm({
      title: 'Activate Basic Plan',
      message: `Activate Basic Plan (₹3,000 / year) for "${businessName}"? This will enable unlimited billing & ERP features for 365 days.`,
      confirmText: 'Activate Plan (₹3,000/yr)',
      danger: false,
    });
    if (!ok) return;

    try {
      const res = await api.post(`/admin/tenants/${tenantId}/activate-plan`, {
        plan: 'BASIC',
        durationDays: 365,
        price: 3000,
      });
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? {
                ...t,
                plan: 'BASIC',
                subscriptionStatus: 'ACTIVE',
                planExpiresAt: res.tenant.planExpiresAt,
                upgradeRequested: false,
                billingEnabled: true,
                purchasesEnabled: true,
              }
            : t
        )
      );
      toast.success(`Basic Plan (₹3,000/yr) activated for "${businessName}"! Valid for 365 days.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate plan.');
    }
  };

  const handleResetTrial = async (tenantId: string, businessName: string) => {
    const ok = await showConfirm({
      title: 'Reset Free Trial',
      message: `Reset free trial to 7 bills for "${businessName}"?`,
      confirmText: 'Reset to 7 Free Bills',
      danger: false,
    });
    if (!ok) return;

    try {
      await api.post(`/admin/tenants/${tenantId}/reset-trial`, {
        maxFreeInvoices: 7,
      });
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? {
                ...t,
                plan: 'FREE',
                subscriptionStatus: 'TRIAL',
                planExpiresAt: null,
                maxFreeInvoices: 7,
                upgradeRequested: false,
                isLimitReached: (t._count?.invoices || 0) >= 7,
              }
            : t
        )
      );
      toast.success(`Free trial reset to 7 bills for "${businessName}".`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset trial.');
    }
  };

  const handleSuspendToggle = async (tenantId: string, isCurrentlySuspended: boolean) => {
    const actionText = isCurrentlySuspended ? 'reactivate' : 'suspend';
    const ok = await showConfirm({
      title: `${isCurrentlySuspended ? 'Reactivate' : 'Suspend'} Business`,
      message: `Are you sure you want to ${actionText} this business? ${isCurrentlySuspended ? 'They will regain system access.' : 'Their users will be locked out until reactivated.'}`,
      confirmText: isCurrentlySuspended ? 'Reactivate' : 'Suspend Business',
      danger: !isCurrentlySuspended,
    });
    if (!ok) return;

    try {
      const updated = await api.delete(`/admin/tenants/${tenantId}`);
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
      );
      toast.success(`Business ${isCurrentlySuspended ? 'reactivated' : 'suspended'} successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Suspension toggle failed.');
    }
  };

  const handlePasswordResetSubmit = async (userId: string) => {
    if (!newPasswordValue || newPasswordValue.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsResetting(true);
      await api.patch(`/admin/users/${userId}/password`, {
        password: newPasswordValue,
      });
      toast.success('Password updated successfully!');
      
      // Clear values
      setResetPasswordUserId(null);
      setNewPasswordValue('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password.');
    } finally {
      setIsResetting(false);
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
                              
                              {/* Business Type Selector */}
                              <div className="mt-1.5 flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Business Model / Type:</label>
                                <select
                                  value={t.businessType || 'RETAIL'}
                                  onChange={(e) => handleBusinessTypeChange(t.id, e.target.value)}
                                  className="rounded-lg border border-purple-500/30 bg-purple-950/20 px-2 py-1 text-xs text-purple-300 font-medium focus:outline-none focus:border-purple-400"
                                >
                                  <option value="RETAIL" className="bg-zinc-950 text-white">🛒 Rashan / Grocery / Retail</option>
                                  <option value="SERVICES_TRAVEL" className="bg-zinc-950 text-white">✈️ Tourist / Travel / Packages</option>
                                  <option value="WHOLESALE" className="bg-zinc-950 text-white">📦 Wholesale / Distribution</option>
                                  <option value="SERVICES_GENERAL" className="bg-zinc-950 text-white">🛠️ General Services / Agency</option>
                                  <option value="MANUFACTURING" className="bg-zinc-950 text-white">🏭 Manufacturing</option>
                                </select>
                              </div>

                              {/* Theme Selector */}
                              <div className="mt-1 flex items-center gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Theme:</label>
                                <select
                                  value={t.theme || 'DARK'}
                                  onChange={(e) => handleThemeChange(t.id, e.target.value)}
                                  className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-2 py-0.5 text-xs text-amber-300 font-medium focus:outline-none focus:border-amber-400"
                                >
                                  <option value="DARK" className="bg-zinc-950 text-white">🌙 Dark Mode</option>
                                  <option value="LIGHT" className="bg-zinc-950 text-white">☀️ Light Mode</option>
                                </select>
                              </div>

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

                          {/* Subscription Plan & Limits */}
                          <td className="py-5">
                            <div className="flex flex-col gap-2 min-w-[210px]">
                              {/* Plan & Status Badges */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border uppercase ${
                                    t.plan === 'BASIC'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : t.plan === 'PRO' || t.plan === 'ENTERPRISE'
                                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  }`}
                                >
                                  {t.plan === 'BASIC' ? 'BASIC (₹3,000/yr)' : t.plan}
                                </span>

                                {t.subscriptionStatus === 'ACTIVE' && (
                                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                                    Active
                                  </span>
                                )}

                                {t.upgradeRequested && (
                                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-extrabold text-amber-300 border border-amber-500/30 animate-pulse flex items-center gap-1">
                                    <Zap className="h-2.5 w-2.5 fill-current" /> Requested
                                  </span>
                                )}
                              </div>

                              {/* Free Trial or Expiry Details */}
                              <div className="text-[11px] text-zinc-400">
                                {t.plan === 'FREE' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span>Trial Bills:</span>
                                    <span
                                      className={`font-mono font-bold ${
                                        (t._count?.invoices || 0) >= (t.maxFreeInvoices || 7)
                                          ? 'text-rose-400'
                                          : 'text-zinc-200'
                                      }`}
                                    >
                                      {t._count?.invoices || 0}/{t.maxFreeInvoices || 7}
                                    </span>
                                    {(t._count?.invoices || 0) >= (t.maxFreeInvoices || 7) && (
                                      <span className="text-[10px] text-rose-400 font-semibold">(Limit Reached)</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span>Valid till:</span>
                                    <span className="font-semibold text-zinc-200">
                                      {t.planExpiresAt
                                        ? new Date(t.planExpiresAt).toLocaleDateString('en-IN')
                                        : '365 Days'}
                                    </span>
                                    {t.daysRemaining !== null && t.daysRemaining !== undefined && (
                                      <span className="text-[10px] text-zinc-500 font-mono">({t.daysRemaining}d left)</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Super Admin 1-Click Action Controls */}
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {t.plan !== 'BASIC' && (
                                  <button
                                    onClick={() => handleQuickActivatePlan(t.id, t.name)}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-2.5 py-1 text-[11px] font-bold shadow-xs transition"
                                    title="Activate Basic Plan ₹3,000/year for 365 days"
                                  >
                                    <Zap className="h-3 w-3 fill-current" /> Activate Basic (₹3,000/yr)
                                  </button>
                                )}

                                {t.plan === 'BASIC' && (
                                  <button
                                    onClick={() => handleQuickActivatePlan(t.id, t.name)}
                                    className="flex items-center gap-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-emerald-400 px-2 py-1 text-[11px] font-semibold border border-zinc-700/60 transition"
                                    title="Renew for another 1 year"
                                  >
                                    <Clock className="h-3 w-3" /> +1 Yr Renewal
                                  </button>
                                )}

                                {t.plan === 'FREE' && (t._count?.invoices || 0) > 0 && (
                                  <button
                                    onClick={() => handleResetTrial(t.id, t.name)}
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                                  >
                                    Reset Trial
                                  </button>
                                )}

                                {isEditingPlan === t.id ? (
                                  <div className="flex items-center gap-1 mt-1">
                                    <select
                                      value={selectedPlan}
                                      onChange={(e) => setSelectedPlan(e.target.value as any)}
                                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white focus:outline-none"
                                    >
                                      <option value="FREE">FREE</option>
                                      <option value="BASIC">BASIC</option>
                                      <option value="STARTER">STARTER</option>
                                      <option value="PRO">PRO</option>
                                      <option value="ENTERPRISE">ENTERPRISE</option>
                                    </select>
                                    <button
                                      onClick={() => handlePlanSave(t.id)}
                                      className="rounded-lg bg-emerald-500 p-1 text-zinc-950 hover:bg-emerald-400 transition"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => setIsEditingPlan(null)}
                                      className="rounded-lg bg-zinc-800 p-1 text-zinc-400 hover:text-white transition"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedPlan(t.plan);
                                      setIsEditingPlan(t.id);
                                    }}
                                    className="text-[11px] font-semibold text-zinc-500 hover:text-purple-400 transition"
                                  >
                                    Edit...
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Feature Gating Switches */}
                          <td className="py-5">
                            <div className="flex flex-col gap-2 max-w-[210px] mx-auto">
                              {[
                                { label: 'Billing Engine', key: 'billingEnabled', val: t.billingEnabled },
                                { label: 'Product Catalog', key: 'productsEnabled', val: t.productsEnabled },
                                { label: 'Purchase Invoices', key: 'purchasesEnabled', val: t.purchasesEnabled !== false },
                                { 
                                  label: t.trackInventory !== false ? 'Track Stock / Qty' : 'Stock (Service Mode)', 
                                  key: 'trackInventory', 
                                  val: t.trackInventory !== false 
                                },
                                { label: 'Payments Ledger', key: 'paymentsEnabled', val: t.paymentsEnabled },
                                { label: 'Reports Console', key: 'reportsEnabled', val: t.reportsEnabled },
                              ].map((f) => (
                                <div key={f.key} className="flex items-center justify-between text-xs font-medium">
                                  <span className={`text-xs ${f.key === 'trackInventory' ? (f.val ? 'text-emerald-400' : 'text-amber-400 font-semibold') : 'text-zinc-400'}`}>
                                    {f.label}
                                  </span>
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
                              <button
                                onClick={() => setActiveTenantForLogins(t)}
                                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                              >
                                <Key className="h-3.5 w-3.5 text-purple-400" /> Logins
                              </button>

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

        {/* Logins & Credentials Modal */}
        {activeTenantForLogins && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="h-5 w-5 text-purple-400" /> Logins & Credentials
                </h3>
                <button
                  onClick={() => {
                    setActiveTenantForLogins(null);
                    setResetPasswordUserId(null);
                    setNewPasswordValue('');
                  }}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-zinc-400">
                  Registered users/owners for <strong className="text-white">{activeTenantForLogins.name}</strong>. Passwords are cryptographically hashed and cannot be decrypted, but you can set a new password.
                </p>

                {activeTenantForLogins.users && activeTenantForLogins.users.length > 0 ? (
                  <div className="space-y-3.5">
                    {activeTenantForLogins.users.map((u) => (
                      <div key={u.id} className="rounded-xl border border-zinc-850 bg-zinc-950/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-white">{u.name}</p>
                            <p className="text-xs text-zinc-400 font-mono mt-0.5">{u.email}</p>
                          </div>
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider">
                            {u.role}
                          </span>
                        </div>

                        {resetPasswordUserId === u.id ? (
                          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-900">
                            <label className="text-[10px] text-purple-400 font-bold uppercase tracking-wider font-mono">New Password</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Min 6 characters (e.g. TempPass@123)"
                                value={newPasswordValue}
                                onChange={(e) => setNewPasswordValue(e.target.value)}
                                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                              />
                              <button
                                onClick={() => handlePasswordResetSubmit(u.id)}
                                disabled={isResetting}
                                className="rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-bold text-white transition disabled:opacity-50"
                              >
                                {isResetting ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setResetPasswordUserId(null);
                                  setNewPasswordValue('');
                                }}
                                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setResetPasswordUserId(u.id)}
                            className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-4"
                          >
                            Reset Password
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-4">No users associated with this tenant account.</p>
                )}
              </div>

              <div className="flex justify-end border-t border-zinc-800 pt-4">
                <button
                  onClick={() => {
                    setActiveTenantForLogins(null);
                    setResetPasswordUserId(null);
                    setNewPasswordValue('');
                  }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-850 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
