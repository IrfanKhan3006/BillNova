'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import { api } from '../lib/api';
import { toast } from '../store/uiStore';
import {
  Wallet,
  Clock,
  Search,
  Plus,
  Pencil,
  Printer,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  CreditCard,
  ArrowRight,
  TrendingUp,
  History,
  Info,
} from 'lucide-react';

interface PaymentEntry {
  id: string;
  amount: number;
  date: string;
  method: string;
  referenceNo?: string;
  notes?: string;
}

interface AdvanceInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  isAdvance: boolean;
  advanceConverted: boolean;
  convertedInvoiceId?: string;
  convertedFromAdvanceNumber?: string;
  notes?: string;
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  payments?: PaymentEntry[];
  items?: Array<{
    id: string;
    name: string;
    qty: number;
    price: number;
    total: number;
  }>;
}

export default function AdvanceBillsPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<AdvanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CONVERTED'>('ACTIVE');

  // Installment Modal state
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<AdvanceInvoice | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState<string>('');
  const [installmentDate, setInstallmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

  // History detail drawer modal
  const [viewHistoryInvoice, setViewHistoryInvoice] = useState<AdvanceInvoice | null>(null);

  const fetchAdvanceBills = async () => {
    try {
      setLoading(true);
      const data = await api.get('/invoices?isAdvance=true');
      setInvoices(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch advance bills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvanceBills();
  }, []);

  const formatCurrency = (val: number | string | undefined) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const isSettled = (inv: AdvanceInvoice) =>
    Boolean(
      inv.advanceConverted ||
      Number(inv.amountDue ?? (inv.totalAmount - (inv.amountPaid || 0))) <= 0 ||
      inv.status === 'PAID'
    );

  const isActive = (inv: AdvanceInvoice) => !isSettled(inv);

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    // Status filter
    if (statusFilter === 'ACTIVE' && !isActive(inv)) return false;
    if (statusFilter === 'CONVERTED' && !isSettled(inv)) return false;

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const invNum = inv.invoiceNumber?.toLowerCase() || '';
    const advNum = inv.convertedFromAdvanceNumber?.toLowerCase() || '';
    const custName = inv.customer?.name?.toLowerCase() || '';
    const custPhone = inv.customer?.phone?.toLowerCase() || '';

    return invNum.includes(q) || advNum.includes(q) || custName.includes(q) || custPhone.includes(q);
  });

  // Analytics Metrics
  const totalAdvanceBillsCount = invoices.length;
  const activeAdvanceBillsCount = invoices.filter(isActive).length;
  const convertedBillsCount = invoices.filter(isSettled).length;
  const totalAdvanceCollected = invoices.reduce(
    (sum, i) => sum + Number(i.amountPaid || 0),
    0
  );
  const totalPendingDue = invoices
    .filter(isActive)
    .reduce((sum, i) => sum + Number(i.amountDue || 0), 0);

  const openInstallmentModal = (inv: AdvanceInvoice) => {
    setSelectedInvoiceForPayment(inv);
    setInstallmentAmount('');
    setInstallmentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('CASH');
    setPaymentRef('');
    setPaymentNotes('');
  };

  const handleRecordInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    const amt = parseFloat(installmentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid installment amount.');
      return;
    }

    if (amt > Number(selectedInvoiceForPayment.amountDue || 0)) {
      toast.error(`Installment cannot exceed remaining balance of ₹${selectedInvoiceForPayment.amountDue}`);
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await api.patch(`/invoices/${selectedInvoiceForPayment.id}`, {
        newAdvanceAmount: amt,
        advanceDate: installmentDate,
        advanceMethod: paymentMethod,
        advanceReference: paymentRef,
        advanceNotes: paymentNotes,
      });

      if (res.advanceConverted) {
        toast.success(
          `Bill fully settled! Automatically converted to final Tax Invoice #${res.invoiceNumber}`
        );
      } else {
        toast.success(`Advance installment of ₹${amt} successfully recorded!`);
      }

      setSelectedInvoiceForPayment(null);
      await fetchAdvanceBills();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record advance installment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <SidebarLayout>
      <FeatureGate featureKey="billingEnabled" featureName="Advance Bills">
        <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                    Advance Bills
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                    Manage multi-installment advance bills, edit bill items, and view automated final conversions.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/billing"
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Bill</span>
              </Link>
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Bills */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-zinc-900/40 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Active Advance Bills
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
                  {activeAdvanceBillsCount}
                </span>
                <span className="text-xs text-zinc-400">of {totalAdvanceBillsCount} total</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Awaiting remaining installments</p>
            </div>

            {/* Total Collected */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-zinc-900/40 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Total Advance Collected
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalAdvanceCollected)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Collected across all installments</p>
            </div>

            {/* Pending Balance Due */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-zinc-900/40 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Pending Balance Due
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400">
                  {formatCurrency(totalPendingDue)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">To be settled before conversion</p>
            </div>

            {/* Converted Bills */}
            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-white dark:bg-zinc-900/40 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Settled & Converted
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
                  {convertedBillsCount}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Auto-converted to Tax Invoices</p>
            </div>
          </div>

          {/* Search, Filter & Tabs Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/30 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Active Advance ({activeAdvanceBillsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'ALL'
                    ? 'bg-amber-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                All Advance Bills ({totalAdvanceBillsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CONVERTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === 'CONVERTED'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Settled / Converted ({convertedBillsCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by Bill #, Customer Name, or Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-white dark:bg-zinc-950 pl-9 pr-4 py-2 text-xs font-medium text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Advance Bills Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 overflow-hidden shadow-xs">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <p className="mt-3 text-xs font-medium">Loading advance bills...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-3">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  No advance bills found
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  {searchQuery
                    ? 'No advance bills match your search criteria. Try a different query.'
                    : statusFilter === 'ACTIVE'
                    ? 'There are currently no active advance bills awaiting settlement.'
                    : 'Create a bill with partial payment or advance mode to see it here.'}
                </p>
                <Link
                  href="/billing"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Bill with Advance</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-zinc-600 dark:text-zinc-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">Bill Number</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Bill Date</th>
                      <th className="py-3 px-4">Installments History</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Advance Paid</th>
                      <th className="py-3 px-4">Balance Due</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {filteredInvoices.map((inv) => {
                      const paidAmt = Number(inv.amountPaid || 0);
                      const dueAmt = Number(inv.amountDue ?? (inv.totalAmount - paidAmt));
                      const paymentsList = inv.payments || [];
                      const isConverted = isSettled(inv);

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-amber-50/40 dark:hover:bg-amber-500/5 transition group"
                        >
                          {/* Bill Number */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                                {inv.invoiceNumber}
                              </span>
                              {isConverted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  ✓ Settled & Converted {inv.convertedFromAdvanceNumber ? `(from ${inv.convertedFromAdvanceNumber})` : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                  ADVANCE BILL
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                                {inv.customer?.name || 'Walk-in Customer'}
                              </span>
                              {inv.customer?.phone && (
                                <span className="text-[11px] text-zinc-400">
                                  {inv.customer.phone}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-300">
                            {inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}
                          </td>

                          {/* Installments Breakdown Button */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => setViewHistoryInvoice(inv)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:text-amber-900 dark:hover:text-amber-300 transition"
                            >
                              <History className="h-3 w-3 text-amber-500" />
                              <span>
                                {paymentsList.length > 0
                                  ? `${paymentsList.length} Installment${paymentsList.length > 1 ? 's' : ''}`
                                  : 'Initial Advance'}
                              </span>
                            </button>
                          </td>

                          {/* Total Amount */}
                          <td className="py-3.5 px-4 font-semibold text-xs text-zinc-900 dark:text-white">
                            {formatCurrency(inv.totalAmount)}
                          </td>

                          {/* Advance Paid */}
                          <td className="py-3.5 px-4 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(paidAmt)}
                          </td>

                          {/* Balance Due */}
                          <td className="py-3.5 px-4">
                            {dueAmt > 0 ? (
                              <span className="font-bold text-xs text-amber-700 dark:text-amber-400">
                                {formatCurrency(dueAmt)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                ✓ ₹0.00
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isConverted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                Settled & Converted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                Partially Paid
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. Edit Bill Button */}
                              {!isConverted ? (
                                <Link
                                  href={`/billing?editInvoiceId=${inv.id}`}
                                  title="Edit bill items, quantities, or prices"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 dark:text-purple-300 dark:border-purple-500/30 text-xs font-bold transition shadow-xs"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                  <span>Edit</span>
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  title="Converted bills cannot be modified"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800/40 dark:text-zinc-600 text-xs font-medium cursor-not-allowed"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {/* 2. Add Advance Installment Button */}
                              {!isConverted && dueAmt > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openInstallmentModal(inv)}
                                  title="Record next advance payment"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-xs active:scale-95"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>+ Advance</span>
                                </button>
                              )}

                              {/* 3. View / Print Invoice Sheet */}
                              <Link
                                href={`/billing?invoiceId=${inv.id}`}
                                title="View or Print Invoice Sheet"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs font-bold transition"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Print</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20 p-4 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">
                How Advance Bills Workflow Works:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Edit Bill Items (✏️):</strong> Click "Edit" to modify product items, quantities, or prices on the billing canvas.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">+ Advance (💳):</strong> Record multiple advance installments with specific payment dates (e.g. 1st Advance, 2nd Advance) which print chronologically on the invoice.
                </li>
                <li>
                  <strong className="text-zinc-800 dark:text-zinc-200">Automatic Final Bill Conversion:</strong> Once the customer settles the full balance, BillNova automatically converts the advance bill into a clean, audit-compliant regular Tax Invoice with a fresh sequential invoice number.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* MODAL: Record Next Advance Installment */}
        {selectedInvoiceForPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Record Advance Installment</h3>
                    <p className="text-xs text-zinc-400">
                      Bill #{selectedInvoiceForPayment.invoiceNumber} • {selectedInvoiceForPayment.customer?.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Balance Summary Box */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-400 block">Total Bill Amount:</span>
                  <span className="font-bold text-white text-sm">
                    {formatCurrency(selectedInvoiceForPayment.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Paid So Far:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatCurrency(selectedInvoiceForPayment.amountPaid)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-amber-300 block font-semibold">Remaining Due:</span>
                  <span className="font-extrabold text-amber-400 text-base">
                    {formatCurrency(selectedInvoiceForPayment.amountDue)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleRecordInstallment} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-zinc-300">
                      New Advance Amount (₹) <span className="text-amber-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setInstallmentAmount(String(selectedInvoiceForPayment.amountDue))
                      }
                      className="text-[11px] font-bold text-amber-400 hover:underline"
                    >
                      Fill Full Remaining ({formatCurrency(selectedInvoiceForPayment.amountDue)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-zinc-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={selectedInvoiceForPayment.amountDue}
                      required
                      placeholder="0.00"
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 pl-8 pr-4 py-2.5 text-sm font-bold text-white border border-zinc-700 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 mb-1.5 block">
                      Installment Date <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={installmentDate}
                      onChange={(e) => setInstallmentDate(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white border border-zinc-700 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-300 mb-1.5 block">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white border border-zinc-700 focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 mb-1.5 block">
                    Reference / Transaction ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / Cheque No."
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 px-3.5 py-2 text-xs text-white border border-zinc-700 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 mb-1.5 block">
                    Installment Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd advance before dispatch"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 px-3.5 py-2 text-xs text-white border border-zinc-700 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceForPayment(null)}
                    className="rounded-xl px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
                  >
                    {submittingPayment ? 'Saving Installment...' : 'Confirm Advance Installment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Installment History Breakdown */}
        {viewHistoryInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Advance Installments History</h3>
                    <p className="text-xs text-zinc-400">
                      Bill #{viewHistoryInvoice.invoiceNumber} • {viewHistoryInvoice.customer?.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewHistoryInvoice(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Installments Table */}
              <div className="space-y-3">
                {viewHistoryInvoice.payments && viewHistoryInvoice.payments.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/80 text-zinc-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Mode</th>
                          <th className="py-2.5 px-3">Ref / Note</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 text-zinc-300">
                        {viewHistoryInvoice.payments.map((p, idx) => (
                          <tr key={p.id || idx}>
                            <td className="py-2.5 px-3 font-bold text-amber-400">
                              {idx === 0
                                ? '1st Advance'
                                : idx === 1
                                ? '2nd Advance'
                                : idx === 2
                                ? '3rd Advance'
                                : `${idx + 1}th Installment`}
                            </td>
                            <td className="py-2.5 px-3">
                              {p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-zinc-200">
                              {p.method}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400">
                              {p.referenceNo || p.notes || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                              {formatCurrency(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    Initial advance recorded on bill creation: {formatCurrency(viewHistoryInvoice.amountPaid)}
                  </div>
                )}

                {/* Overall summary */}
                <div className="rounded-xl bg-zinc-950 p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 block">Total Bill:</span>
                    <span className="font-bold text-white">{formatCurrency(viewHistoryInvoice.totalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Total Collected:</span>
                    <span className="font-bold text-emerald-400">{formatCurrency(viewHistoryInvoice.amountPaid)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 block">Remaining Due:</span>
                    <span className="font-bold text-amber-400">{formatCurrency(viewHistoryInvoice.amountDue)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <Link
                  href={`/billing?invoiceId=${viewHistoryInvoice.id}`}
                  className="rounded-xl px-4 py-2 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Advance Invoice</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setViewHistoryInvoice(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </FeatureGate>
    </SidebarLayout>
  );
}
