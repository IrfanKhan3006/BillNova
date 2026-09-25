'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import {
  Zap,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Search,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { toast, showConfirm } from '../../store/uiStore';

interface RequestedTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  phone: string | null;
  email: string | null;
  businessType?: string;
  upgradeRequested: boolean;
  upgradeRequestedAt?: string | null;
  maxFreeInvoices: number;
  createdAt: string;
  _count: {
    users: number;
    invoices: number;
    customers: number;
    purchaseInvoices?: number;
  };
}

export default function AdminActivationRequestsPage() {
  const [requests, setRequests] = useState<RequestedTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await api.get('/admin/requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load activation requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApproveAndActivate = async (tenant: RequestedTenant) => {
    const ok = await showConfirm({
      title: 'Approve & Activate Basic Plan',
      message: `Activate Basic Plan (₹3,000 / year) for "${tenant.name}"? This will enable unlimited billing & ERP access for 365 days and remove this business from the pending requests list.`,
      confirmText: '⚡ Approve & Activate (₹3,000/yr)',
      danger: false,
    });
    if (!ok) return;

    try {
      setProcessingId(tenant.id);
      await api.post(`/admin/tenants/${tenant.id}/activate-plan`, {
        plan: 'BASIC',
        durationDays: 365,
        price: 3000,
      });

      // Immediately remove from pending requests list
      setRequests((prev) => prev.filter((r) => r.id !== tenant.id));
      toast.success(
        `Basic Plan (₹3,000/yr) activated for "${tenant.name}"! Removed from pending list.`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate plan.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismissRequest = async (tenant: RequestedTenant) => {
    const ok = await showConfirm({
      title: 'Dismiss Upgrade Request',
      message: `Dismiss activation request for "${tenant.name}"? They will remain on their current plan.`,
      confirmText: 'Dismiss Request',
      danger: true,
    });
    if (!ok) return;

    try {
      setProcessingId(tenant.id);
      await api.delete(`/admin/requests/${tenant.id}`);
      setRequests((prev) => prev.filter((r) => r.id !== tenant.id));
      toast.success(`Request dismissed for "${tenant.name}".`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss request.');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase())) ||
      (r.phone && r.phone.includes(search))
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="h-5 w-5 fill-current" />
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                Activation Requests
              </h2>
              {requests.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-zinc-950 shadow-md animate-pulse">
                  {requests.length} Pending
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Businesses that have exhausted their free trial limit (7 bills) or requested manual activation for Basic Plan (₹3,000 / year).
            </p>
          </div>

          <button
            onClick={loadRequests}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition duration-150 self-start"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Search Bar */}
        {requests.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search requested businesses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}

        {/* Content State */}
        {loading ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
            <p className="text-sm text-zinc-400 font-medium">Checking pending activation requests...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          /* Empty state: No pending requests */
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-12 text-center shadow-xl backdrop-blur-xl max-w-2xl mx-auto space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white">All Caught Up!</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              No businesses currently have pending activation requests. All accounts are either active on paid plans or using their initial free trial.
            </p>
            <div className="pt-2">
              <Link
                href="/admin/tenants"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition"
              >
                <Building2 className="h-4 w-4" /> View All Businesses
              </Link>
            </div>
          </div>
        ) : (
          /* Pending Requests Cards / Table */
          <div className="grid gap-4">
            {filteredRequests.map((tenant) => {
              const invoicesCount = tenant._count.invoices;
              const maxBills = tenant.maxFreeInvoices || 7;
              const isOverLimit = invoicesCount >= maxBills;
              const requestedDate = tenant.upgradeRequestedAt
                ? new Date(tenant.upgradeRequestedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Recently';

              return (
                <div
                  key={tenant.id}
                  className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-zinc-900/60 to-zinc-900/40 p-6 shadow-xl backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition hover:border-amber-500/60"
                >
                  {/* Left: Business Profile & Request Info */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-purple-400" />
                        {tenant.name}
                      </h3>
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-500/30 flex items-center gap-1 uppercase tracking-wider">
                        <Zap className="h-3 w-3 fill-current" /> Activation Requested
                      </span>
                      <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-mono text-zinc-400 border border-zinc-700">
                        slug: {tenant.slug}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-400">
                      {tenant.phone && (
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Phone className="h-3.5 w-3.5 text-zinc-500" /> {tenant.phone}
                        </span>
                      )}
                      {tenant.email && (
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Mail className="h-3.5 w-3.5 text-zinc-500" /> {tenant.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-amber-400/90 font-medium">
                        <Clock className="h-3.5 w-3.5" /> Requested: {requestedDate}
                      </span>
                    </div>

                    {/* Usage summary */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 text-xs">
                        <span className="text-zinc-500">Trial Bills Created:</span>
                        <span className={`font-mono font-bold ${isOverLimit ? 'text-rose-400' : 'text-zinc-200'}`}>
                          {invoicesCount} / {maxBills}
                        </span>
                        {isOverLimit && (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.2 text-[9px] font-bold text-rose-400 uppercase">
                            Limit Exhausted
                          </span>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 text-xs">
                        <span className="text-zinc-500">Selected Plan:</span>
                        <span className="font-bold text-emerald-400">
                          Basic Plan (₹3,000 / Year)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleApproveAndActivate(tenant)}
                      disabled={processingId === tenant.id}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Zap className="h-4 w-4 fill-current" />
                      {processingId === tenant.id
                        ? 'Activating...'
                        : 'Approve & Activate Basic (₹3,000/yr)'}
                    </button>

                    <Link
                      href={`/admin/tenants/${tenant.id}/invoices`}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-850 text-xs font-semibold text-zinc-300 transition"
                      title="Audit invoices of this business"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-purple-400" />
                      Audit Bills
                    </Link>

                    <button
                      onClick={() => handleDismissRequest(tenant)}
                      disabled={processingId === tenant.id}
                      className="flex items-center justify-center gap-1 px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-red-950/30 hover:border-red-500/30 text-xs font-semibold text-zinc-400 hover:text-red-400 transition"
                      title="Dismiss request without activating"
                    >
                      <X className="h-4 w-4" />
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
