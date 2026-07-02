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
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  todaySales: number;
  monthlyRevenue: number;
  outstandingInvoicesCount: number;
  totalCustomerOutstanding: number;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    date: string;
    totalAmount: number;
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
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIALLY_PAID':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'SENT':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'OVERDUE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'DRAFT':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'VOID':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500 border-zinc-800" />
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-400">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
          <h3 className="font-semibold text-lg">Error Loading Dashboard</h3>
          <p className="mt-1 text-sm text-red-300/80">{error}</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Overview</h1>
          <p className="mt-1 text-zinc-400 text-sm">Real-time metrics for your billing and operations.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Today's Sales</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-white">{formatCurrency(dashboard?.todaySales || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                <span>Today's invoices sum</span>
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Monthly Revenue</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-white">{formatCurrency(dashboard?.monthlyRevenue || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <span>Current calendar month</span>
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Total Outstanding</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-white">{formatCurrency(dashboard?.totalCustomerOutstanding || 0)}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-400">
                <span>Pending customer ledger</span>
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md hover:border-zinc-750 transition duration-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">Pending Invoices</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-white">{dashboard?.outstandingInvoicesCount || 0}</h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-yellow-400">
                <span>Invoices requiring payment</span>
              </p>
            </div>
          </div>
        </div>

        {/* Invoices and Aggregations */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Recent Invoices (Left 2 Columns) */}
          <div className="lg:col-span-2 rounded-2xl border border-zinc-805 bg-zinc-900/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Recent Invoices</h3>
              <Link href="/reports" className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition">
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {dashboard?.recentInvoices && dashboard.recentInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase font-bold">
                      <th className="py-3 px-2">Invoice #</th>
                      <th className="py-3 px-2">Customer</th>
                      <th className="py-3 px-2">Date</th>
                      <th className="py-3 px-2">Amount</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/10 transition">
                        <td className="py-3.5 px-2 font-mono text-xs text-white">{inv.invoiceNumber}</td>
                        <td className="py-3.5 px-2 text-zinc-300 font-medium">{inv.customerName}</td>
                        <td className="py-3.5 px-2 text-zinc-400 text-xs">
                          {new Date(inv.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-2 font-semibold text-white">{formatCurrency(inv.totalAmount)}</td>
                        <td className="py-3.5 px-2">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <Link
                            href={`/billing?invoiceId=${inv.id}`}
                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                          >
                            Reprint
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No recent invoices generated. Click 'Create Invoice' to start.
              </div>
            )}
          </div>

          {/* Side Cards (Right Column) */}
          <div className="space-y-8 lg:col-span-1">
            {/* Top Products */}
            <div className="rounded-2xl border border-zinc-805 bg-zinc-900/20 p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Package className="h-4.5 w-4.5 text-emerald-400" />
                <span>Top Selling Products</span>
              </h3>

              {topItems?.topProducts && topItems.topProducts.length > 0 ? (
                <div className="space-y-4">
                  {topItems.topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-zinc-800/30 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[160px]">{p.name}</p>
                        <p className="text-[10px] text-zinc-500">{p.quantitySold} units sold</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400">{formatCurrency(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-zinc-500 text-xs">
                  No sales recorded yet.
                </div>
              )}
            </div>

            {/* Top Outstanding Customers */}
            <div className="rounded-2xl border border-zinc-805 bg-zinc-900/20 p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-rose-400" />
                <span>Top Outstanding Balances</span>
              </h3>

              {topItems?.topCustomers && topItems.topCustomers.length > 0 ? (
                <div className="space-y-4">
                  {topItems.topCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-zinc-800/30 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-white truncate max-w-[160px]">{c.name}</p>
                        <p className="text-[10px] text-zinc-500">{c.phone || 'No phone'}</p>
                      </div>
                      <span className="text-sm font-semibold text-rose-450 text-red-400">{formatCurrency(c.outstandingBalance)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-zinc-500 text-xs">
                  All customer accounts are clear.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
