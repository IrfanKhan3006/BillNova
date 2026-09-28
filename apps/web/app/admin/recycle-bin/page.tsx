'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { Trash2, RotateCcw, Calendar, User as UserIcon, Building2 } from 'lucide-react';

interface DeletedInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  deletedAt: string;
  status: string;
  totalAmount: number;
  isAdvance: boolean;
  customer: { name: string };
}

interface DeletedTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  deletedAt: string;
  users: { id: string; name: string; email: string; role: string }[];
  _count: { invoices: number; customers: number };
}

interface BusinessGroup {
  tenant: { id: string; name: string; slug: string };
  invoices: DeletedInvoice[];
}

export default function RecycleBinPage() {
  const [groups, setGroups] = useState<BusinessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletedTenants, setDeletedTenants] = useState<DeletedTenant[]>([]);

  const load = async () => {
    try {
      const [bills, businesses] = await Promise.all([
        api.get('/admin/recycle-bin'),
        api.get('/admin/recycle-bin/businesses'),
      ]);
      setGroups(bills);
      setDeletedTenants(businesses);
    } catch (err: any) {
      setError(err.message || 'Failed to load recycle bin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const handleRestore = async (tenantId: string, inv: DeletedInvoice) => {
    if (!confirm(`Restore bill ${inv.invoiceNumber}?`)) return;
    setRestoringId(inv.id);
    setError(null);
    try {
      const res = await api.post(`/admin/tenants/${tenantId}/invoices/${inv.id}/restore`);
      setNotice(
        res.renumbered
          ? `Bill restored. ${res.previousInvoiceNumber} was already in use, so it is now ${res.invoiceNumber}.`
          : `Bill ${res.invoiceNumber} restored.`,
      );
      setTimeout(() => setNotice(null), 5000);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to restore bill.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreTenant = async (t: DeletedTenant) => {
    if (!confirm(`Restore business "${t.name}"? Its users will be able to log in again.`)) return;
    setRestoringId(t.id);
    setError(null);
    try {
      await api.post(`/admin/tenants/${t.id}/restore`);
      setNotice(`Business "${t.name}" restored.`);
      setTimeout(() => setNotice(null), 5000);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to restore business.');
    } finally {
      setRestoringId(null);
    }
  };

  const totalDeleted = groups.reduce((acc, g) => acc + g.invoices.length, 0);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Trash2 className="h-8 w-8 text-purple-400" /> Recycle Bin
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Deleted businesses and bills. Restore a business or bill to bring it back into the business&apos;s records and counts.
          </p>
        </div>

        {notice && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm font-semibold text-emerald-400">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm font-semibold text-red-400">
            {error}
          </div>
        )}

        {!loading && deletedTenants.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-900/20 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6 py-4">
              <span className="flex items-center gap-2 font-bold text-white">
                <Building2 className="h-5 w-5 text-red-400" /> Deleted Businesses
              </span>
              <span className="text-xs font-semibold text-zinc-400">{deletedTenants.length} deleted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="py-3 pl-6">Business</th>
                    <th className="py-3">Owner</th>
                    <th className="py-3">Plan</th>
                    <th className="py-3">Bills</th>
                    <th className="py-3">Deleted On</th>
                    <th className="py-3 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {deletedTenants.map((t) => {
                    const owner = t.users.find((u) => u.role === 'ADMIN') || t.users[0];
                    return (
                      <tr key={t.id}>
                        <td className="py-3 pl-6">
                          <p className="font-bold text-white">{t.name}</p>
                          <p className="font-mono text-xs text-zinc-500">{t.slug}</p>
                        </td>
                        <td className="py-3 text-zinc-300">
                          {owner ? (
                            <>
                              <p className="font-semibold">{owner.name}</p>
                              <p className="text-xs text-zinc-500">{owner.email}</p>
                            </>
                          ) : '—'}
                        </td>
                        <td className="py-3 text-zinc-400">{t.plan}</td>
                        <td className="py-3 text-zinc-400">{t._count.invoices}</td>
                        <td className="py-3 text-zinc-400">{new Date(t.deletedAt).toLocaleString('en-IN')}</td>
                        <td className="py-3 pr-6 text-right">
                          <button
                            onClick={() => handleRestoreTenant(t)}
                            disabled={restoringId === t.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {restoringId === t.id ? 'Restoring...' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
          </div>
        ) : totalDeleted === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 py-16 text-center">
            <Trash2 className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 font-semibold text-zinc-400">No deleted bills.</p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.tenant.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-400" />
                  <span className="font-bold text-white">{g.tenant.name}</span>
                  <span className="font-mono text-xs text-zinc-500">{g.tenant.slug}</span>
                </div>
                <span className="text-xs font-semibold text-zinc-400">
                  {g.invoices.length} deleted {g.invoices.length === 1 ? 'bill' : 'bills'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="py-3 pl-6">Invoice ID</th>
                      <th className="py-3">Billing Date</th>
                      <th className="py-3">Client Name</th>
                      <th className="py-3">Deleted On</th>
                      <th className="py-3 text-right">Amount</th>
                      <th className="py-3 pr-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {g.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-3 pl-6 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                        <td className="py-3 text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-zinc-600" />
                            {new Date(inv.date).toLocaleDateString('en-IN')}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="flex items-center gap-2 font-semibold text-zinc-200">
                            <UserIcon className="h-3.5 w-3.5 text-zinc-500" />
                            {inv.customer.name}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-400">{new Date(inv.deletedAt).toLocaleString('en-IN')}</td>
                        <td className="py-3 text-right font-extrabold text-white">{formatCurrency(inv.totalAmount)}</td>
                        <td className="py-3 pr-6 text-right">
                          <button
                            onClick={() => handleRestore(g.tenant.id, inv)}
                            disabled={restoringId === inv.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {restoringId === inv.id ? 'Restoring...' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
