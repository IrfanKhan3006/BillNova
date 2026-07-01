'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  DollarSign,
  User,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  referenceNo?: string;
  notes?: string;
  customer: {
    name: string;
  };
  invoice?: {
    invoiceNumber: string;
  };
}

interface Customer {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  amountDue: number;
  status: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const [selectedCustomerIdFilter, setSelectedCustomerIdFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    invoiceId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'CASH',
    referenceNo: '',
    notes: '',
  });

  const loadData = async (catFilter = '') => {
    try {
      setLoading(true);
      const [pmtData, custData] = await Promise.all([
        api.get('/payments', catFilter ? { customerId: catFilter } : {}),
        api.get('/customers'),
      ]);
      setPayments(pmtData);
      setCustomers(custData);
    } catch (err) {
      console.error('Failed to load payments data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When customer is selected in Record Payment Modal, load their pending/active invoices
  useEffect(() => {
    if (form.customerId) {
      api.get('/invoices', { customerId: form.customerId }).then((res) => {
        // filter only pending invoices
        const pending = res.filter((inv: Invoice) => inv.amountDue > 0);
        setInvoices(pending);
        if (pending.length > 0) {
          setForm((prev) => ({ ...prev, invoiceId: pending[0].id, amount: pending[0].amountDue }));
        } else {
          setForm((prev) => ({ ...prev, invoiceId: '', amount: 0 }));
        }
      });
    } else {
      setInvoices([]);
    }
  }, [form.customerId]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedCustomerIdFilter(val);
    loadData(val);
  };

  const handleOpenModal = () => {
    setForm({
      customerId: customers.length > 0 ? customers[0].id : '',
      invoiceId: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      method: 'CASH',
      referenceNo: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0) {
      alert('Enter a valid payment amount!');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/payments', {
        ...form,
        invoiceId: form.invoiceId || undefined,
      });
      setIsModalOpen(false);
      loadData(selectedCustomerIdFilter);
    } catch (err: any) {
      alert(err.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25';
      case 'UPI':
        return 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/25';
      case 'BANK_TRANSFER':
        return 'text-blue-400 bg-blue-500/10 border border-blue-500/25';
      default:
        return 'text-zinc-400 bg-zinc-800 border border-zinc-700';
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Payments Log</h1>
            <p className="mt-1 text-zinc-400 text-sm">Monitor credits, record payments, and audit customer invoice ledger settlements.</p>
          </div>
          <button
            onClick={handleOpenModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Record Payment</span>
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:max-w-xs">
            <span className="text-xs text-zinc-400 font-bold uppercase shrink-0">Filter by Customer:</span>
            <select
              value={selectedCustomerIdFilter}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="">All Payments</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-zinc-550 text-zinc-500">
            Total {payments.length} transaction logs audited
          </span>
        </div>

        {/* Payments Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-emerald-500 border-zinc-800" />
            </div>
          ) : payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase bg-zinc-900/20">
                    <th className="p-4">Customer Name</th>
                    <th className="p-4">Payment Date</th>
                    <th className="p-4">Method / Ref</th>
                    <th className="p-4">Linked Invoice</th>
                    <th className="p-4">Notes</th>
                    <th className="p-4 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-800/10 transition">
                      <td className="p-4 font-semibold text-white">{p.customer?.name}</td>
                      <td className="p-4 text-xs text-zinc-450">
                        {new Date(p.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getMethodColor(p.method)}`}>
                          {p.method}
                        </span>
                        {p.referenceNo && (
                          <div className="text-[10px] text-zinc-500 font-mono mt-1">Ref: {p.referenceNo}</div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-zinc-300">
                        {p.invoice ? (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 text-zinc-500" />
                            <span>{p.invoice.invoiceNumber}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">Direct Account Credit</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-zinc-400 max-w-[200px] truncate" title={p.notes || ''}>
                        {p.notes || '-'}
                      </td>
                      <td className="p-4 text-right font-black text-emerald-450 text-emerald-400">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-24 text-center text-zinc-500 flex flex-col items-center justify-center">
              <CreditCard className="h-10 w-10 text-zinc-700 mb-2" />
              <h4 className="font-semibold text-zinc-400">No Payments Recorded</h4>
              <p className="text-xs mt-1">Click 'Record Payment' to credit a customer's pending invoices.</p>
            </div>
          )}
        </div>

        {/* Record Payment Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Record Customer Payment</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Choose Customer *</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {invoices.length > 0 ? (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Linked Pending Invoice</label>
                    <select
                      value={form.invoiceId}
                      onChange={(e) => {
                        const inv = invoices.find((i) => i.id === e.target.value);
                        setForm({
                          ...form,
                          invoiceId: e.target.value,
                          amount: inv ? inv.amountDue : 0,
                        });
                      }}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="">Direct Credit (No Specific Invoice)</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} - Due: {formatCurrency(inv.amountDue)} (Total: {formatCurrency(inv.totalAmount)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="h-4.5 w-4.5 text-yellow-500 shrink-0" />
                    <span>No pending invoices found for this customer. Payment will be credited directly to their opening ledger account.</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Payment Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Method *</label>
                    <select
                      value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value })}
                      className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="BANK_TRANSFER">Bank Transfer (IMPS/NEFT)</option>
                      <option value="CARD">Card Payment</option>
                      <option value="OTHER">Other Mode</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Reference No (e.g. UPI ID, Cheque No)</label>
                  <input
                    type="text"
                    value={form.referenceNo}
                    onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="e.g. UPI-998822"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Internal Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="e.g. Partial payments"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg bg-zinc-855 text-zinc-300 px-4 py-2 text-xs font-semibold hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-emerald-500 text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-emerald-400 flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                    ) : (
                      'Record Payment'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
