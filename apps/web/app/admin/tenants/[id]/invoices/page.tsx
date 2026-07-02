'use client';

import React, { useEffect, useState, use } from 'react';
import AdminLayout from '../../../../components/AdminLayout';
import { api } from '../../../../lib/api';
import {
  FileSpreadsheet,
  IndianRupee,
  Calendar,
  User as UserIcon,
  Search,
  ArrowLeft,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  customer: {
    name: string;
    email: string | null;
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TenantInvoicesPage({ params }: PageProps) {
  const { id: tenantId } = use(params);
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [businessName, setBusinessName] = useState<string>('Business');

  useEffect(() => {
    async function loadInvoices() {
      try {
        const data = await api.get(`/admin/tenants/${tenantId}/invoices`);
        setInvoices(data);
        
        // Find tenant name from first invoice if available
        if (data.length > 0) {
          // The page header will dynamically extract the business context
        }
        
        // Let's query the tenant list to find name
        const tenantsList = await api.get('/admin/tenants');
        const currentTenant = tenantsList.find((t: any) => t.id === tenantId);
        if (currentTenant) {
          setBusinessName(currentTenant.name);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to audit bills.');
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, [tenantId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredInvoices = invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  // Stats calculation
  const totalInvoices = invoices.length;
  const aggregateRevenue = invoices.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const aggregateOutstanding = invoices.reduce((acc, curr) => acc + curr.amountDue, 0);

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Back Link & Header */}
        <div className="space-y-4">
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Businesses
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <FileSpreadsheet className="h-8 w-8 text-purple-400" /> Invoice Audit: {businessName}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Audit the sales history, pending invoices, and receivables ledger for this business profile.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
            <p className="text-sm text-zinc-400 font-medium">Loading sales registers...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {/* Aggregate Metrics Grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Billed Count</p>
                <p className="mt-2 text-2xl font-bold text-white tracking-tight">{totalInvoices} Invoices</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Gross Billed Sales</p>
                <p className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">{formatCurrency(aggregateRevenue)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Outstanding Receivables</p>
                <p className="mt-2 text-2xl font-bold text-pink-400 tracking-tight">{formatCurrency(aggregateOutstanding)}</p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-zinc-550" />
              <input
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Invoices List */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 shadow-xl backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-900/40">
                      <th className="py-4 pl-6">Invoice ID</th>
                      <th className="py-4">Billing Date</th>
                      <th className="py-4">Client Name</th>
                      <th className="py-4">Status</th>
                      <th className="py-4 pr-6 text-right">Invoice Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-zinc-500 font-medium">
                          No invoices found for this business.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-zinc-850/10 transition-colors">
                          <td className="py-4 pl-6">
                            <span className="font-bold text-white font-mono">{inv.invoiceNumber}</span>
                          </td>
                          <td className="py-4 text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-zinc-600" />
                              {new Date(inv.date).toLocaleDateString('en-IN')}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400">
                                <UserIcon className="h-3.5 w-3.5" />
                              </div>
                              <span className="font-semibold text-zinc-200">{inv.customer.name}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border uppercase ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : inv.status === 'PARTIALLY_PAID'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              {inv.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-4 pr-6 text-right font-extrabold text-white">
                            {formatCurrency(inv.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
