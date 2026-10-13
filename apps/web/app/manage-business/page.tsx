'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { canManageBusiness } from '../lib/manageBusiness';
import {
  Building2,
  IndianRupee,
  Users,
  FileText,
  ShoppingBag,
  Package,
  Trash2,
  Zap,
  Eye,
  CheckCircle2,
  XCircle,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

interface OverviewUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Overview {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  planExpiresAt?: string | null;
  maxFreeInvoices: number;
  maxUsers: number;
  upgradeRequested: boolean;
  gstin?: string | null;
  stateCode?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  businessType: string;
  trackInventory: boolean;
  invoicePrefix: string;
  purchasePrefix: string;
  advancePrefix: string;
  dueDays: number;
  billingEnabled: boolean;
  productsEnabled: boolean;
  paymentsEnabled: boolean;
  reportsEnabled: boolean;
  purchasesEnabled: boolean;
  createdAt: string;
  users: OverviewUser[];
  _count: {
    invoices: number;
    purchaseInvoices: number;
    customers: number;
    products: number;
  };
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalPurchased: number;
  deletedInvoices: number;
}

const currency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);

const longDate = (val?: string | null) =>
  val
    ? new Date(val).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export default function ManageBusinessPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const allowed = canManageBusiness(user);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    api
      .get('/business/overview')
      .then((res: Overview) => setData(res))
      .catch((err: Error) => setError(err.message || 'Failed to load the business overview.'))
      .finally(() => setLoading(false));
  }, [user, allowed, router]);

  if (!allowed) return null;

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-emerald-500" />
        </div>
      </SidebarLayout>
    );
  }

  if (error || !data) {
    return (
      <SidebarLayout>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
          {error}
        </div>
      </SidebarLayout>
    );
  }

  const stats = [
    { label: 'Total Billed', value: currency(data.totalBilled), icon: IndianRupee, color: 'text-emerald-400' },
    { label: 'Collected', value: currency(data.totalCollected), icon: Wallet, color: 'text-emerald-400' },
    { label: 'Outstanding', value: currency(data.totalOutstanding), icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Total Purchased', value: currency(data.totalPurchased), icon: ShoppingBag, color: 'text-sky-400' },
    { label: 'Invoices', value: data._count.invoices, icon: FileText, color: 'text-sky-400' },
    { label: 'Purchase Invoices', value: data._count.purchaseInvoices, icon: ShoppingBag, color: 'text-amber-400' },
    { label: 'Customers', value: data._count.customers, icon: Users, color: 'text-violet-400' },
    { label: 'Products', value: data._count.products, icon: Package, color: 'text-violet-400' },
    { label: 'Users', value: data.users.length, icon: Users, color: 'text-sky-400' },
    { label: 'Deleted Bills', value: data.deletedInvoices, icon: Trash2, color: 'text-red-400' },
  ];

  const features = [
    { label: 'Billing Engine', on: data.billingEnabled },
    { label: 'Products & Inventory', on: data.productsEnabled },
    { label: 'Payments', on: data.paymentsEnabled },
    { label: 'Reports', on: data.reportsEnabled },
    { label: 'Purchase Invoices', on: data.purchasesEnabled },
  ];

  const planExpired =
    !!data.planExpiresAt && new Date(data.planExpiresAt).getTime() < Date.now();

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{data.name}</h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                {data.slug} · Joined {longDate(data.createdAt)}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Eye className="h-3.5 w-3.5" />
            View only
          </span>
        </div>

        <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-relaxed text-zinc-400">
          Ye section sirf dekhne ke liye hai — yahan se kuch badla nahi ja sakta. Plan, limits
          aur feature access platform admin manage karte hain. Business details badalne ke liye{' '}
          <span className="font-semibold text-zinc-300">Business Settings</span> use karein.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {s.label}
                </p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="mt-2 text-lg font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Plan */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <Zap className="h-5 w-5 text-emerald-400" /> Subscription Plan
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Plan</dt>
                <dd className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  {data.plan}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Status</dt>
                <dd
                  className={`font-semibold ${
                    planExpired ? 'text-red-400' : 'text-zinc-200'
                  }`}
                >
                  {planExpired ? 'EXPIRED' : data.subscriptionStatus}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Valid till</dt>
                <dd className="font-semibold text-zinc-200">{longDate(data.planExpiresAt)}</dd>
              </div>
              {data.plan === 'FREE' && (
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-400">Free bills used</dt>
                  <dd className="font-mono font-bold text-zinc-200">
                    {data._count.invoices}/{data.maxFreeInvoices}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-zinc-400">Team users allowed</dt>
                <dd className="font-mono font-bold text-zinc-200">
                  {data.users.filter((u) => u.role === 'USER').length}/{data.maxUsers}
                </dd>
              </div>
              {data.upgradeRequested && (
                <div className="flex items-center justify-between">
                  <dt className="text-zinc-400">Upgrade request</dt>
                  <dd className="font-semibold text-amber-400">Pending with admin</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Features */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="font-bold text-white">Module Access</h2>
            <p className="mt-1 text-[11px] text-zinc-500">Platform admin dwara control kiya jata hai.</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {features.map((f) => (
                <li key={f.label} className="flex items-center justify-between">
                  <span className="text-zinc-300">{f.label}</span>
                  {f.on ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                      <XCircle className="h-4 w-4" /> Disabled
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Business details */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="font-bold text-white">Business Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ['GSTIN', data.gstin],
                ['State Code', data.stateCode],
                ['Phone', data.phone],
                ['Email', data.email],
                ['Address', data.address],
                ['Business Type', data.businessType],
                ['Inventory Tracking', data.trackInventory ? 'On' : 'Off'],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-zinc-400">{label}</dt>
                  <dd className="text-right font-medium text-zinc-200">{val || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Numbering */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="font-bold text-white">Bill Numbering</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ['Invoice Prefix', data.invoicePrefix],
                ['Advance Prefix', data.advancePrefix],
                ['Purchase Prefix', data.purchasePrefix],
                ['Payment Due Days', String(data.dueDays)],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="font-mono font-semibold text-zinc-200">{val || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Users */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="font-bold text-white">Users ({data.users.length})</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-3 font-bold">Name</th>
                  <th className="pb-2 pr-3 font-bold">Email</th>
                  <th className="pb-2 pr-3 font-bold">Role</th>
                  <th className="pb-2 pr-3 font-bold">Status</th>
                  <th className="pb-2 font-bold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-800/60">
                    <td className="py-2.5 pr-3 font-semibold text-zinc-200">{u.name}</td>
                    <td className="py-2.5 pr-3 text-zinc-400">{u.email}</td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`text-xs font-semibold ${
                          u.isActive ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-400">{longDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
