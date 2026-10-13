'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { canManageBusiness } from '../lib/manageBusiness';
import {
  Building2,
  Search,
  RefreshCw,
  ChevronRight,
  Eye,
  Users,
  IndianRupee,
  Zap,
  BellRing,
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'BASIC' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus?: string;
  maxFreeInvoices?: number;
  upgradeRequested?: boolean;
  daysRemaining?: number | null;
  isExpired?: boolean;
  email: string | null;
  phone: string | null;
  createdAt: string;
  deletedAt: string | null;
  users?: { email: string; role: string }[];
  _count: { users: number; invoices: number; customers: number; purchaseInvoices: number };
}

interface Stats {
  totalTenants: number;
  totalUsers: number;
  totalRevenue: number;
  upgradeRequestsPending: number;
  planStats: Record<string, number>;
}

const currency = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);

const shortDate = (val?: string | null) =>
  val
    ? new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

const planClass = (plan: string) =>
  plan === 'FREE'
    ? 'border-zinc-700 bg-zinc-800 text-zinc-300'
    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';

export default function ManageBusinessPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const allowed = canManageBusiness(user);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, dash] = await Promise.all([
        api.get('/platform/tenants'),
        api.get('/platform/dashboard'),
      ]);
      setTenants(list);
      setStats(dash);
    } catch (err: any) {
      setError(err.message || 'Failed to load businesses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [user, allowed, router, load]);

  if (!allowed) return null;

  const q = search.toLowerCase();
  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      t.users?.some((u) => u.email.toLowerCase().includes(q)),
  );

  const statCards = stats
    ? [
        { label: 'Businesses', value: stats.totalTenants, icon: Building2, color: 'text-emerald-400' },
        { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-sky-400' },
        { label: 'Total Revenue', value: currency(stats.totalRevenue), icon: IndianRupee, color: 'text-emerald-400' },
        { label: 'Upgrade Requests', value: stats.upgradeRequestsPending, icon: BellRing, color: 'text-amber-400' },
        { label: 'Paid Plans', value: stats.totalTenants - (stats.planStats?.FREE || 0), icon: Zap, color: 'text-violet-400' },
      ]
    : [];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white">
              <Building2 className="h-7 w-7 text-emerald-400" /> Manage Business
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Platform par registered sabhi businesses. Naya business register hote hi yahan aa jayega.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <span className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <Eye className="h-3.5 w-3.5" /> View only
            </span>
            <button
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Platform stats */}
        {statCards.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((s) => (
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
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business name, slug or email..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-emerald-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="py-3 pl-5 font-bold">Business</th>
                    <th className="py-3 font-bold">Owner Login</th>
                    <th className="py-3 font-bold">Plan</th>
                    <th className="py-3 text-center font-bold">Users</th>
                    <th className="py-3 text-center font-bold">Clients</th>
                    <th className="py-3 text-center font-bold">Bills</th>
                    <th className="py-3 font-bold">Joined</th>
                    <th className="py-3 pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-zinc-500">
                        {search ? 'Is search se koi business nahi mila.' : 'Abhi koi business nahi hai.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t) => {
                      const owner = t.users?.find((u) => u.role === 'ADMIN')?.email || t.email || '—';
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-zinc-800/60 transition hover:bg-zinc-800/30"
                        >
                          <td className="py-3 pl-5">
                            <p className="font-semibold text-white">{t.name}</p>
                            <p className="text-[11px] text-zinc-500">{t.slug}</p>
                          </td>
                          <td className="py-3 text-zinc-400">{owner}</td>
                          <td className="py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${planClass(t.plan)}`}
                              >
                                {t.plan}
                              </span>
                              {t.subscriptionStatus === 'EXPIRED' && (
                                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                                  Expired
                                </span>
                              )}
                              {t.upgradeRequested && (
                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                  Upgrade Req
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-center font-mono text-zinc-300">{t._count.users}</td>
                          <td className="py-3 text-center font-mono text-zinc-300">{t._count.customers}</td>
                          <td className="py-3 text-center font-mono text-zinc-300">{t._count.invoices}</td>
                          <td className="py-3 text-zinc-400">{shortDate(t.createdAt)}</td>
                          <td className="py-3 pr-5 text-right">
                            <Link
                              href={`/manage-business/${t.id}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                            >
                              View <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11px] text-zinc-500">
          Ye section sirf dekhne ke liye hai — plan, limits aur feature access platform admin
          manage karte hain.
        </p>
      </div>
    </SidebarLayout>
  );
}
