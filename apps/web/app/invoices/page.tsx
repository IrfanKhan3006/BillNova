'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { FileText, Search, Printer, Receipt, CalendarRange, X } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  status: string;
  totalAmount: number;
  amountDue: number;
  isAdvance?: boolean;
  customer: { name: string } | null;
}

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  PARTIAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  OVERDUE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const inputClass =
  'rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-2 text-xs text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Debounce search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        setInvoices(await api.get(`/invoices?${params.toString()}`));
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load invoices.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, from, to]);

  const total = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              <FileText className="h-7 w-7 text-emerald-500" /> Invoices
            </h1>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">All invoices of the business. Open any invoice to view or print it.</p>
          </div>
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-zinc-950 transition"
          >
            <Receipt className="h-4 w-4" /> Create New Invoice
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice no. or customer name..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <CalendarRange className="h-4 w-4 text-zinc-400" />
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} aria-label="From date" />
            <span>to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} aria-label="To date" />
            {(from || to || search) && (
              <button
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setSearch('');
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 shadow-sm dark:shadow-none overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 text-xs text-zinc-500">
            <span>{invoices.length} invoices</span>
            <span>
              Total: <span className="font-bold text-zinc-900 dark:text-white">{inr(total)}</span>
            </span>
          </div>
          {error ? (
            <p className="py-10 text-center text-sm text-red-500">{error}</p>
          ) : loading && invoices.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500 border-zinc-300 dark:border-zinc-800" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No invoices found.</p>
          ) : (
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                    <th className="py-3 pl-6">Invoice</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Customer</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 text-right">Amount</th>
                    <th className="py-3 text-right">Due</th>
                    <th className="py-3 pr-6 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="text-zinc-700 dark:text-zinc-300">
                      <td className="py-3 pl-6 font-mono font-bold text-zinc-900 dark:text-white">
                        {inv.invoiceNumber}
                        {inv.isAdvance && <span className="ml-1.5 text-[9px] font-bold uppercase text-amber-500">adv</span>}
                      </td>
                      <td className="py-3">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-3">{inv.customer?.name || '—'}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[inv.status] || 'bg-zinc-500/10 text-zinc-500'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-zinc-900 dark:text-white">{inr(inv.totalAmount)}</td>
                      <td className="py-3 text-right">{inr(inv.amountDue || 0)}</td>
                      <td className="py-3 pr-6 text-right">
                        <Link
                          href={`/billing?invoiceId=${inv.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Printer className="h-3.5 w-3.5" /> View / Print
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
