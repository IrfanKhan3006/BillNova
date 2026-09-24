'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import {
  IndianRupee,
  Receipt,
  Users,
  AlertCircle,
  TrendingUp,
  Package,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  Clock,
  Wallet,
  FileCheck,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  todaySales: number;
  monthlyRevenue: number;
  totalInvoicesCount?: number;
  paidInvoicesCount?: number;
  paidInvoicesTotal?: number;
  advanceInvoicesCount?: number;
  advanceCollectedAmount?: number;
  advancePendingAmount?: number;
  advanceTotalAmount?: number;
  unpaidInvoicesCount?: number;
  outstandingInvoicesCount: number;
  totalCustomerOutstanding: number;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    date: string;
    totalAmount: number;
    amountPaid?: number;
    amountDue?: number;
    status: string;
  }>;
  recentAdvanceInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    date: string;
    totalAmount: number;
    amountPaid?: number;
    amountDue?: number;
    status: string;
  }>;
  recentPendingInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    date: string;
    totalAmount: number;
    amountPaid?: number;
    amountDue?: number;
    status: string;
  }>;
}

interface TopItemsData {
  topCustomers: Array<{
    id: string;
    name: string;
    phone?: string;
    outstandingBalance: number;
  }>;
  topProducts: Array<{
    productId?: string;
    name: string;
    quantitySold: number;
    revenue: number;
  }>;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [topItems, setTopItems] = useState<TopItemsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dashRes, topRes] = await Promise.all([
          api.get('/dashboard/metrics'),
          api.get('/dashboard/top-items'),
        ]);
        setDashboard(dashRes);
        setTopItems(topRes);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25';
      case 'PARTIALLY_PAID':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
      case 'SENT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
      case 'OVERDUE':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
      case 'DRAFT':
        return 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20';
      case 'VOID':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20';
    }
  };

  const getStatusBadgeText = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'Completed';
      case 'PARTIALLY_PAID':
        return 'Advance Bill';
      case 'SENT':
        return 'Unpaid';
      case 'OVERDUE':
        return 'Overdue';
      case 'DRAFT':
        return 'Draft';
      case 'VOID':
        return 'Void';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500 border-zinc-300 dark:border-zinc-800" />
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/5 p-6 text-center text-red-600 dark:text-red-400">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
          <h3 className="font-semibold text-lg">Error Loading Dashboard</h3>
          <p className="mt-1 text-sm text-red-500/80">{error}</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Dashboard Overview</h1>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">Real-time financial performance and bill settlement metrics.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-md shadow-emerald-500/10 transition"
            >
              <Receipt className="h-4 w-4" />
              <span>Create New Invoice</span>
            </Link>
          </div>
        </div>

        {/* Primary Financial Stats Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Today's Sales */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Today's Sales</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{formatCurrency(dashboard?.todaySales || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                <span>Today's invoice volume</span>
              </p>
            </div>
          </div>

          {/* Card 2: Monthly Revenue */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Monthly Revenue</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{formatCurrency(dashboard?.monthlyRevenue || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Current calendar month</span>
              </p>
            </div>
          </div>

          {/* Card 3: Total Customer Outstanding */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Outstanding</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{formatCurrency(dashboard?.totalCustomerOutstanding || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                <span>Pending customer ledger</span>
              </p>
            </div>
          </div>

          {/* Card 4: Total Active Invoices */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Invoices</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{dashboard?.totalInvoicesCount ?? (dashboard?.outstandingInvoicesCount || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>Total invoices generated</span>
              </p>
            </div>
          </div>
        </div>

        {/* Invoice Settlement Breakdown Cards (Advance Bills vs Completed vs Pending) */}
        <div>
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Invoice Settlement & Advance Pipeline</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Advance Bills (Partially Paid) */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-zinc-900/60 p-6 shadow-sm dark:shadow-lg dark:shadow-amber-500/5 hover:border-amber-300 dark:hover:border-amber-500/50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Advance Bills</span>
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-transparent">Partially Paid</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-zinc-900 dark:text-white">{dashboard?.advanceInvoicesCount || 0}</h3>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Bills with advance</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-500/20 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Advance Collected:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(dashboard?.advanceCollectedAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Remaining Balance:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-300">{formatCurrency(dashboard?.advancePendingAmount || 0)}</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">Flips to Completed automatically on full settlement.</p>
              </div>
            </div>

            {/* Completed Bills (Fully Paid) */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-zinc-900/60 p-6 shadow-sm dark:shadow-lg dark:shadow-emerald-500/5 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Completed Bills</span>
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-transparent">Fully Paid</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-zinc-900 dark:text-white">{dashboard?.paidInvoicesCount || 0}</h3>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Bills 100% settled</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-500/20 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Total Settled:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(dashboard?.paidInvoicesTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Balance Due:</span>
                    <span className="font-bold text-zinc-400">₹0 (Zero Due)</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">Payment complete, no further balance remaining.</p>
              </div>
            </div>

            {/* Unpaid Bills (Zero Advance) */}
            <div className="relative overflow-hidden rounded-2xl border border-yellow-200 dark:border-yellow-500/25 bg-white dark:bg-zinc-900/60 p-6 shadow-sm hover:border-yellow-300 dark:hover:border-yellow-500/40 transition">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">Unpaid Bills</span>
                  <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-transparent">Awaiting Advance</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-zinc-900 dark:text-white">{dashboard?.unpaidInvoicesCount || 0}</h3>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Pending initial payment</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-500/20 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Total Outstanding:</span>
                    <span className="font-bold text-yellow-700 dark:text-yellow-400">{dashboard?.outstandingInvoicesCount || 0} invoices</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">Action:</span>
                    <span className="font-bold text-amber-700 dark:text-yellow-300">Collect Advance / Settle</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">Bills awaiting full or initial advance payments.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Split Invoices Tables: Advance Bills vs Pending Bills (Equal Height & Width) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Live Invoices Tracker</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Separated view of advance bills vs unpaid bills</p>
            </div>
            <Link href="/reports" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 transition">
              <span>View all in Reports</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Table 1: Recent Advance Bills (Partially Paid) */}
            <div className="rounded-2xl border border-amber-200/90 dark:border-amber-500/25 bg-white dark:bg-zinc-900/30 shadow-sm dark:shadow-none p-6 flex flex-col h-[470px]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Wallet className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white">Advance Bills</h3>
                      <span className="rounded-full bg-amber-100 dark:bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-transparent">
                        {dashboard?.advanceInvoicesCount || 0} Partially Paid
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Invoices with partial advance received</p>
                  </div>
                </div>
              </div>

              {dashboard?.recentAdvanceInvoices && dashboard.recentAdvanceInvoices.length > 0 ? (
                <div className="overflow-x-auto overflow-y-auto flex-1 pr-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-900/95 backdrop-blur z-10">
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[11px] uppercase font-bold">
                        <th className="py-2.5 px-2">Invoice #</th>
                        <th className="py-2.5 px-2">Customer</th>
                        <th className="py-2.5 px-2">Total</th>
                        <th className="py-2.5 px-2">Advance</th>
                        <th className="py-2.5 px-2">Balance</th>
                        <th className="py-2.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                      {dashboard.recentAdvanceInvoices.map((inv) => {
                        const paidAmt = Number(inv.amountPaid || 0);
                        const dueAmt = Number(inv.amountDue ?? (inv.totalAmount - paidAmt));
                        return (
                          <tr key={inv.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition">
                            <td className="py-3 px-2 font-mono text-xs font-semibold text-zinc-900 dark:text-white">{inv.invoiceNumber}</td>
                            <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 font-medium text-xs truncate max-w-[110px]" title={inv.customerName}>
                              {inv.customerName}
                            </td>
                            <td className="py-3 px-2 font-medium text-zinc-900 dark:text-white text-xs">{formatCurrency(inv.totalAmount)}</td>
                            <td className="py-3 px-2 font-bold text-emerald-600 dark:text-emerald-400 text-xs">{formatCurrency(paidAmt)}</td>
                            <td className="py-3 px-2 font-bold text-amber-700 dark:text-amber-300 text-xs">{formatCurrency(dueAmt)}</td>
                            <td className="py-3 px-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/payments`}
                                  className="rounded px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-[11px] font-bold text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 dark:border-transparent transition"
                                >
                                  Settle
                                </Link>
                                <Link
                                  href={`/billing?invoiceId=${inv.id}`}
                                  className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
                                >
                                  Print
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                  <Wallet className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2 opacity-50" />
                  <p className="font-semibold text-zinc-600 dark:text-zinc-400">No active advance bills</p>
                  <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-600">Bills created with advance payment will show here.</p>
                </div>
              )}
            </div>

            {/* Table 2: Recent Pending / Unpaid Bills (Excludes Paid Bills!) */}
            <div className="rounded-2xl border border-yellow-200/90 dark:border-yellow-500/20 bg-white dark:bg-zinc-900/30 shadow-sm dark:shadow-none p-6 flex flex-col h-[470px]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white">Pending / Unpaid Bills</h3>
                      <span className="rounded-full bg-yellow-100 dark:bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-transparent">
                        {dashboard?.unpaidInvoicesCount || 0} Awaiting Payment
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Unpaid bills requiring initial client payment</p>
                  </div>
                </div>
              </div>

              {dashboard?.recentPendingInvoices && dashboard.recentPendingInvoices.length > 0 ? (
                <div className="overflow-x-auto overflow-y-auto flex-1 pr-1">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-900/95 backdrop-blur z-10">
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[11px] uppercase font-bold">
                        <th className="py-2.5 px-2">Invoice #</th>
                        <th className="py-2.5 px-2">Customer</th>
                        <th className="py-2.5 px-2">Date</th>
                        <th className="py-2.5 px-2">Due Amount</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                      {dashboard.recentPendingInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-yellow-50/50 dark:hover:bg-yellow-500/5 transition">
                          <td className="py-3 px-2 font-mono text-xs font-semibold text-zinc-900 dark:text-white">{inv.invoiceNumber}</td>
                          <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 font-medium text-xs truncate max-w-[120px]" title={inv.customerName}>
                            {inv.customerName}
                          </td>
                          <td className="py-3 px-2 text-zinc-500 dark:text-zinc-400 text-xs">
                            {new Date(inv.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </td>
                          <td className="py-3 px-2 font-bold text-zinc-900 dark:text-white text-xs">{formatCurrency(inv.totalAmount)}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusStyle(inv.status)}`}>
                              {getStatusBadgeText(inv.status)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/payments`}
                                className="rounded px-2.5 py-1 bg-yellow-100 hover:bg-yellow-200 text-[11px] font-bold text-yellow-900 border border-yellow-300 dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20 dark:text-yellow-400 dark:border-transparent transition"
                              >
                                Collect
                              </Link>
                              <Link
                                href={`/billing?invoiceId=${inv.id}`}
                                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
                              >
                                Print
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                  <Clock className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2 opacity-50" />
                  <p className="font-semibold text-zinc-600 dark:text-zinc-400">No pending unpaid bills</p>
                  <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-600">All customer invoices have been settled or paid.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Products and Top Customers Row (Equal 2 columns) */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Top Products */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-805 bg-white dark:bg-zinc-900/20 p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
              <Package className="h-4.5 w-4.5 text-emerald-500" />
              <span>Top Selling Products</span>
            </h3>

            {topItems?.topProducts && topItems.topProducts.length > 0 ? (
              <div className="space-y-4">
                {topItems.topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/30 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate max-w-[160px]">{p.name}</p>
                      <p className="text-[10px] text-zinc-500">{p.quantitySold} units sold</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                No sales recorded yet.
              </div>
            )}
          </div>

          {/* Top Outstanding Customers */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-805 bg-white dark:bg-zinc-900/20 p-6 shadow-sm dark:shadow-none">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-rose-500" />
              <span>Top Outstanding Balances</span>
            </h3>

            {topItems?.topCustomers && topItems.topCustomers.length > 0 ? (
              <div className="space-y-4">
                {topItems.topCustomers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/30 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate max-w-[160px]">{c.name}</p>
                      <p className="text-[10px] text-zinc-500">{c.phone || 'No phone'}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-600 dark:text-red-400">{formatCurrency(c.outstandingBalance)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                All customer accounts are clear.
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
