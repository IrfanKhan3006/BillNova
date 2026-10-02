'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../components/AdminLayout';
import { api } from '../../../lib/api';
import { toast, showConfirm } from '../../../store/uiStore';
import {
  ArrowLeft,
  Building2,
  FileSpreadsheet,
  Users,
  Key,
  ShoppingBag,
  IndianRupee,
  Trash2,
  Zap,
  Clock,
  Check,
  X,
  Sliders,
  AlertTriangle,
  Ban,
  Mail,
  Phone,
  Search,
  Pencil,
} from 'lucide-react';

type Plan = 'FREE' | 'BASIC' | 'STARTER' | 'PRO' | 'ENTERPRISE';

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  subscriptionStatus: string;
  planExpiresAt: string | null;
  maxFreeInvoices: number;
  maxUsers?: number;
  upgradeRequested: boolean;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  billingEnabled: boolean;
  productsEnabled: boolean;
  paymentsEnabled: boolean;
  reportsEnabled: boolean;
  purchasesEnabled: boolean;
  businessType: string;
  trackInventory: boolean;
  theme: string;
  deletedAt: string | null;
  users: TenantUser[];
  _count: { invoices: number; purchaseInvoices: number; customers: number; products: number };
  totalBilled: number;
  deletedInvoices: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  status: string;
  totalAmount: number;
  amountDue: number;
  isAdvance?: boolean;
  customer: { name: string };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', USER: 'User' };

const card = 'rounded-2xl border border-zinc-800 bg-zinc-900/20 shadow-xl';
const cardHead = 'flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6 py-4';

export default function TenantDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingPlan, setEditingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('FREE');
  const [billSearch, setBillSearch] = useState('');
  const [maxUsersInput, setMaxUsersInput] = useState<string>('');
  const [now] = useState(() => Date.now()); // read once, not on every render

  const load = async () => {
    try {
      const [t, inv] = await Promise.all([
        api.get(`/admin/tenants/${id}`),
        api.get(`/admin/tenants/${id}/invoices`),
      ]);
      setTenant(t);
      setMaxUsersInput(String(t.maxUsers ?? 2));
      setInvoices(inv);
    } catch (err: any) {
      setError(err.message || 'Failed to load business.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  // PATCH /admin/tenants/:id and merge the result into the page state.
  const patchTenant = async (payload: Record<string, any>, message: string) => {
    try {
      const updated = await api.patch(`/admin/tenants/${id}`, payload);
      setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success(message);
    } catch (err: any) {
      toast.error(err.message || 'Update failed.');
    }
  };

  const handleBusinessType = (type: string) => {
    const payload: any = { businessType: type };
    if (type === 'SERVICES_TRAVEL' || type === 'SERVICES_GENERAL') payload.trackInventory = false;
    patchTenant(payload, 'Business model updated.');
  };

  const handleActivatePlan = async () => {
    if (!tenant) return;
    const renewing = tenant.plan === 'BASIC';
    const ok = await showConfirm({
      title: renewing ? 'Renew Basic Plan' : 'Activate Basic Plan',
      message: `${renewing ? 'Renew' : 'Activate'} Basic Plan (₹3,000 / year) for "${tenant.name}" for 365 days?`,
      confirmText: renewing ? 'Renew +1 Year' : 'Activate Plan (₹3,000/yr)',
      danger: false,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/tenants/${id}/activate-plan`, { plan: 'BASIC', durationDays: 365, price: 3000 });
      toast.success(renewing ? 'Plan renewed for 1 year.' : 'Basic Plan activated.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate plan.');
    }
  };

  const handleResetTrial = async () => {
    if (!tenant) return;
    const ok = await showConfirm({
      title: 'Reset Free Trial',
      message: `Reset free trial to 7 bills for "${tenant.name}"?`,
      confirmText: 'Reset to 7 Free Bills',
      danger: false,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/tenants/${id}/reset-trial`, { maxFreeInvoices: 7 });
      toast.success('Free trial reset to 7 bills.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset trial.');
    }
  };

  const handlePlanSave = async () => {
    await patchTenant({ plan: selectedPlan }, 'Plan changed.');
    setEditingPlan(false);
  };

  const handleSuspendToggle = async () => {
    if (!tenant) return;
    const suspended = !!tenant.deletedAt;
    const ok = await showConfirm({
      title: `${suspended ? 'Reactivate' : 'Suspend'} Business`,
      message: suspended
        ? 'They will regain system access.'
        : 'All users of this business will be locked out until reactivated.',
      confirmText: suspended ? 'Reactivate' : 'Suspend Business',
      danger: !suspended,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/tenants/${id}`);
      toast.success(`Business ${suspended ? 'reactivated' : 'suspended'}.`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Suspension toggle failed.');
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    const ok = await showConfirm({
      title: 'Delete Business',
      message: `Delete "${tenant.name}"? It moves to the Recycle Bin and its users can no longer log in. The owner's email can be used to register again.`,
      confirmText: 'Delete Business',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/tenants/${id}/permanent`);
      toast.success('Business deleted.');
      router.push('/admin/tenants');
    } catch (err: any) {
      toast.error(err.message || 'Delete failed.');
    }
  };

  const handlePassword = async (userId: string) => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      await api.patch(`/admin/users/${userId}/password`, { password: newPassword });
      toast.success('Password updated.');
      setPasswordFor(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password.');
    }
  };

  if (loading || error || !tenant) {
    return (
      <AdminLayout>
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
          </div>
        ) : (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-semibold text-red-400">{error}</div>
        )}
      </AdminLayout>
    );
  }

  const isSuspended = !!tenant.deletedAt;
  const expiry = tenant.planExpiresAt ? new Date(tenant.planExpiresAt) : null;
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - now) / 86400000)) : null;
  const isExpired = tenant.plan !== 'FREE' && expiry !== null && daysLeft === 0;

  const stats = [
    { label: 'Bills Created', value: tenant._count.invoices, icon: FileSpreadsheet, color: 'text-purple-400' },
    { label: 'Total Billed', value: formatCurrency(tenant.totalBilled), icon: IndianRupee, color: 'text-emerald-400' },
    { label: 'Users', value: tenant.users.length, icon: Users, color: 'text-sky-400' },
    { label: 'Clients', value: tenant._count.customers, icon: Building2, color: 'text-zinc-300' },
    { label: 'Purchase Invoices', value: tenant._count.purchaseInvoices, icon: ShoppingBag, color: 'text-amber-400' },
    { label: 'Deleted Bills', value: tenant.deletedInvoices, icon: Trash2, color: 'text-red-400' },
  ];

  const features = [
    { label: 'Billing Engine', key: 'billingEnabled', val: tenant.billingEnabled },
    { label: 'Product Catalog', key: 'productsEnabled', val: tenant.productsEnabled },
    { label: 'Purchase Invoices', key: 'purchasesEnabled', val: tenant.purchasesEnabled !== false },
    {
      label: tenant.trackInventory !== false ? 'Track Stock / Qty' : 'Stock (Service Mode)',
      key: 'trackInventory',
      val: tenant.trackInventory !== false,
    },
    { label: 'Payments Ledger', key: 'paymentsEnabled', val: tenant.paymentsEnabled },
    { label: 'Reports Console', key: 'reportsEnabled', val: tenant.reportsEnabled },
  ];

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(billSearch.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(billSearch.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        <Link href="/admin/tenants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> All Businesses
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex flex-wrap items-center gap-3 text-3xl font-extrabold tracking-tight text-white">
              <Building2 className="h-8 w-8 text-purple-400" /> {tenant.name}
              {isSuspended && (
                <span className="flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-red-400">
                  <Ban className="h-3 w-3" /> Suspended
                </span>
              )}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span className="font-mono text-zinc-500">slug: {tenant.slug}</span>
              {tenant.gstin && <span className="font-mono">GST: {tenant.gstin}</span>}
              {tenant.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-zinc-600" /> {tenant.email}
                </span>
              )}
              {tenant.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-zinc-600" /> {tenant.phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSuspendToggle}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isSuspended
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10'
                  : 'border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10'
              }`}
            >
              {isSuspended ? 'Reactivate' : (<><AlertTriangle className="h-3.5 w-3.5" /> Suspend</>)}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <p className="mt-2 text-2xl font-extrabold text-white">{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Plan */}
          <div className={card}>
            <div className={cardHead}>
              <span className="flex items-center gap-2 font-bold text-white">
                <Zap className="h-5 w-5 text-emerald-400" /> Subscription Plan
              </span>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                    tenant.plan === 'BASIC'
                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                      : tenant.plan === 'FREE'
                      ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                      : 'border-purple-500/20 bg-purple-500/10 text-purple-400'
                  }`}
                >
                  {tenant.plan === 'BASIC' ? 'BASIC (₹3,000/yr)' : tenant.plan}
                </span>
                <span className={`text-[11px] font-bold ${isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {tenant.plan === 'FREE' ? 'Free Trial' : isExpired ? 'Expired' : 'Active'}
                </span>
                {tenant.upgradeRequested && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                    <Zap className="h-2.5 w-2.5 fill-current" /> Requested
                  </span>
                )}
              </div>

              <p className="text-sm text-zinc-400">
                {tenant.plan === 'FREE' ? (
                  <>
                    Trial bills:{' '}
                    <span className="font-mono font-bold text-white">
                      {tenant._count.invoices}/{tenant.maxFreeInvoices}
                    </span>
                  </>
                ) : (
                  <>
                    Valid till:{' '}
                    <span className="font-semibold text-white">
                      {expiry ? expiry.toLocaleDateString('en-IN') : 'No expiry'}
                    </span>
                    {daysLeft !== null && <span className="ml-1 font-mono text-xs text-zinc-500">({daysLeft}d left)</span>}
                  </>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleActivatePlan}
                  className={
                    tenant.plan === 'BASIC'
                      ? 'flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-zinc-800 transition'
                      : 'flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition'
                  }
                >
                  {tenant.plan === 'BASIC' ? (
                    <><Clock className="h-3.5 w-3.5" /> +1 Yr Renewal</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5 fill-current" /> Activate Basic (₹3,000/yr)</>
                  )}
                </button>
                {tenant.plan === 'FREE' && tenant._count.invoices > 0 && (
                  <button onClick={handleResetTrial} className="text-xs text-zinc-500 underline hover:text-zinc-300">
                    Reset Trial
                  </button>
                )}
              </div>

              {/* Team user limit — how many USER accounts this business may create */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-zinc-400">Team users allowed:</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={maxUsersInput}
                  onChange={(e) => setMaxUsersInput(e.target.value)}
                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-center font-mono font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
                {Number(maxUsersInput) !== (tenant.maxUsers ?? 2) && (
                  <button
                    onClick={() => {
                      const n = parseInt(maxUsersInput, 10);
                      if (isNaN(n) || n < 0 || n > 100) {
                        toast.error('Enter a number between 0 and 100.');
                        return;
                      }
                      patchTenant({ maxUsers: n }, `Team user limit set to ${n}.`);
                    }}
                    className="rounded-lg bg-emerald-500 px-2.5 py-1 font-bold text-zinc-950 hover:bg-emerald-400"
                  >
                    Save
                  </button>
                )}
              </div>

              {editingPlan ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as Plan)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {['FREE', 'BASIC', 'STARTER', 'PRO', 'ENTERPRISE'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button onClick={handlePlanSave} className="rounded-lg bg-emerald-500 p-1.5 text-zinc-950 hover:bg-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingPlan(false)} className="rounded-lg bg-zinc-800 p-1.5 text-zinc-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedPlan(tenant.plan);
                    setEditingPlan(true);
                  }}
                  className="text-xs font-semibold text-zinc-500 hover:text-purple-400 transition"
                >
                  Change plan manually...
                </button>
              )}
            </div>
          </div>

          {/* Business setup */}
          <div className={card}>
            <div className={cardHead}>
              <span className="flex items-center gap-2 font-bold text-white">
                <Building2 className="h-5 w-5 text-purple-400" /> Business Setup
              </span>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Business Model / Type</label>
                <select
                  value={tenant.businessType || 'RETAIL'}
                  onChange={(e) => handleBusinessType(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-purple-500/30 bg-purple-950/20 px-3 py-2 text-sm font-medium text-purple-300 focus:border-purple-400 focus:outline-none"
                >
                  <option value="RETAIL" className="bg-zinc-950 text-white">🛒 Rashan / Grocery / Retail</option>
                  <option value="SERVICES_TRAVEL" className="bg-zinc-950 text-white">✈️ Tourist / Travel / Packages</option>
                  <option value="WHOLESALE" className="bg-zinc-950 text-white">📦 Wholesale / Distribution</option>
                  <option value="SERVICES_GENERAL" className="bg-zinc-950 text-white">🛠️ General Services / Agency</option>
                  <option value="MANUFACTURING" className="bg-zinc-950 text-white">🏭 Manufacturing</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Theme</label>
                <select
                  value={tenant.theme || 'DARK'}
                  onChange={(e) => patchTenant({ theme: e.target.value }, 'Business theme updated.')}
                  className="mt-1.5 w-full rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm font-medium text-amber-300 focus:border-amber-400 focus:outline-none"
                >
                  <option value="DARK" className="bg-zinc-950 text-white">🌙 Dark Mode</option>
                  <option value="LIGHT" className="bg-zinc-950 text-white">☀️ Light Mode</option>
                </select>
              </div>
              {tenant.address && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Address</label>
                  <p className="mt-1 text-sm text-zinc-300">{tenant.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Feature gates */}
          <div className={card}>
            <div className={cardHead}>
              <span className="flex items-center gap-2 font-bold text-white">
                <Sliders className="h-5 w-5 text-purple-400" /> Feature Gates
              </span>
            </div>
            <div className="space-y-3 p-6">
              {features.map((f) => (
                <div key={f.key} className="flex items-center justify-between text-sm">
                  <span
                    className={
                      f.key === 'trackInventory'
                        ? f.val ? 'text-emerald-400' : 'font-semibold text-amber-400'
                        : 'text-zinc-300'
                    }
                  >
                    {f.label}
                  </span>
                  <button
                    onClick={() => patchTenant({ [f.key]: !f.val }, 'Feature gate updated.')}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      f.val ? 'bg-purple-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        f.val ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Users */}
        <div className={`${card} overflow-hidden`}>
          <div className={cardHead}>
            <span className="flex items-center gap-2 font-bold text-white">
              <Users className="h-5 w-5 text-sky-400" /> Users & Logins
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              {tenant.users.filter((u) => u.role === 'USER').length} / {tenant.maxUsers ?? 2} team users
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pl-6">Name</th>
                  <th className="py-3">Login Email</th>
                  <th className="py-3">Role</th>
                  <th className="py-3">Created</th>
                  <th className="py-3 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {tenant.users.map((u) => (
                  <React.Fragment key={u.id}>
                    <tr>
                      <td className="py-3 pl-6 font-semibold text-white">
                        {u.name || '—'}
                        {!u.isActive && <span className="ml-2 text-[10px] font-bold uppercase text-red-400">inactive</span>}
                      </td>
                      <td className="py-3 font-mono text-xs text-zinc-300">{u.email}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            u.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-300' : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-400">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 pr-6 text-right">
                        <button
                          onClick={() => {
                            setPasswordFor(passwordFor === u.id ? null : u.id);
                            setNewPassword('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
                        >
                          <Key className="h-3.5 w-3.5" /> Reset Password
                        </button>
                      </td>
                    </tr>
                    {passwordFor === u.id && (
                      <tr>
                        <td colSpan={5} className="px-6 pb-4">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="New password (min 6)"
                              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handlePassword(u.id)}
                              className="rounded-lg bg-purple-500 px-4 text-xs font-semibold text-white hover:bg-purple-400"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bills */}
        <div className={`${card} overflow-hidden`}>
          <div className={`${cardHead} flex-wrap gap-3`}>
            <span className="flex items-center gap-2 font-bold text-white">
              <FileSpreadsheet className="h-5 w-5 text-purple-400" /> Bills ({invoices.length})
            </span>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                placeholder="Search bill no. or client..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
          {filteredInvoices.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No bills found.</p>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-950">
                  <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="py-3 pl-6">Bill No.</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Client</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 text-right">Amount</th>
                    <th className="py-3 text-right">Due</th>
                    <th className="py-3 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/admin/tenants/${id}/invoices/${inv.id}`)}
                      className="cursor-pointer hover:bg-zinc-900/60 transition"
                    >
                      <td className="py-3 pl-6 font-mono font-bold text-white">
                        {inv.invoiceNumber}
                        {inv.isAdvance && <span className="ml-1.5 text-[9px] font-bold uppercase text-amber-400">adv</span>}
                      </td>
                      <td className="py-3 text-zinc-400">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 text-zinc-200">{inv.customer?.name}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : inv.status === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-white">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-3 text-right text-zinc-400">{formatCurrency(inv.amountDue || 0)}</td>
                      <td className="py-3 pr-6 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 px-2.5 py-1 text-xs font-semibold text-purple-300">
                          <Pencil className="h-3 w-3" /> View / Edit
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
