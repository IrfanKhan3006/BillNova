'use client';

import React, { useEffect, useState, use } from 'react';
import AdminLayout from '../../../../../components/AdminLayout';
import { api } from '../../../../../lib/api';
import {
  ArrowLeft,
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface InvoiceItem {
  id?: string;
  productId: string | null;
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  discountRate: number;
  taxAmount?: number;
  total?: number;
  hsnCode: string | null;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  referenceNo: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  status: string;
  notes: string | null;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  isAdvance: boolean;
  customer: { name: string; email: string | null; phone?: string | null };
  items: InvoiceItem[];
  payments: Payment[];
}

interface PageProps {
  params: Promise<{ id: string; invoiceId: string }>;
}

const STATUSES = ['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID'];

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500';

export default function AdminInvoiceDetailPage({ params }: PageProps) {
  const { id: tenantId, invoiceId } = use(params);
  const endpoint = `/admin/tenants/${tenantId}/invoices/${invoiceId}`;
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Edit form state
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const resetForm = (inv: Invoice) => {
    setStatus(inv.status);
    setDate(inv.date.slice(0, 10));
    setNotes(inv.notes || '');
    setItems(
      inv.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        price: it.price,
        taxRate: it.taxRate,
        discountRate: it.discountRate,
        hsnCode: it.hsnCode,
      })),
    );
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get(endpoint);
        setInvoice(data);
        resetForm(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load bill.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [endpoint]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    );
  };

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { productId: null, name: '', qty: 1, price: 0, taxRate: 0, discountRate: 0, hsnCode: null },
    ]);

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  // Live preview of totals, same formula as the API
  const preview = items.reduce(
    (acc, it) => {
      const sub = it.price * (1 - it.discountRate / 100) * it.qty;
      const tax = sub * (it.taxRate / 100);
      return { sub: acc.sub + sub, tax: acc.tax + tax };
    },
    { sub: 0, tax: 0 },
  );

  const handleSave = async () => {
    if (!invoice) return;
    if (items.length === 0) {
      setError('A bill needs at least one item.');
      return;
    }
    if (items.some((it) => !it.name.trim() || it.qty <= 0)) {
      setError('Every item needs a name and a quantity above 0.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        date,
        notes,
        items: items.map((it) => ({
          ...(it.productId ? { productId: it.productId } : {}),
          name: it.name.trim(),
          qty: Number(it.qty),
          price: Number(it.price),
          taxRate: Number(it.taxRate),
          discountRate: Number(it.discountRate),
          ...(it.hsnCode ? { hsnCode: it.hsnCode } : {}),
        })),
      };
      // Only send status when changed, so the API can auto-derive it otherwise
      if (status !== invoice.status) payload.status = status;

      await api.patch(endpoint, payload);
      // Refetch: the API may return a converted final bill for advance invoices
      const fresh = await api.get(endpoint);
      setInvoice(fresh);
      resetForm(fresh);
      setEditing(false);
      setNotice('Bill updated successfully.');
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update bill.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    if (!confirm(`Delete bill ${invoice.invoiceNumber}? The customer's outstanding balance will be adjusted.`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(endpoint);
      router.push(`/admin/tenants/${tenantId}/invoices`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete bill.');
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="space-y-4">
          <Link
            href={`/admin/tenants/${tenantId}/invoices`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Bills
          </Link>
          {invoice && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-purple-400" />
                  <span className="font-mono">{invoice.invoiceNumber}</span>
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Customer: <span className="font-semibold text-zinc-200">{invoice.customer.name}</span>
                  {invoice.isAdvance && (
                    <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-400">
                      Advance Bill
                    </span>
                  )}
                </p>
              </div>
              {!editing ? (
                <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-500 transition"
                >
                  <Pencil className="h-4 w-4" /> Edit Bill
                </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resetForm(invoice);
                      setEditing(false);
                      setError(null);
                    }}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          )}
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

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-500 border-zinc-800" />
          </div>
        ) : invoice ? (
          <>
            {/* Header fields */}
            <div className="grid gap-4 sm:grid-cols-3 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Bill Date</p>
                {editing ? (
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                ) : (
                  <p className="text-white font-semibold">{new Date(invoice.date).toLocaleDateString('en-IN')}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Status</p>
                {editing ? (
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white font-semibold">{invoice.status.replace('_', ' ')}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Notes</p>
                {editing ? (
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Notes" />
                ) : (
                  <p className="text-zinc-300">{invoice.notes || '—'}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-900/40">
                      <th className="py-3 pl-5">Item</th>
                      <th className="py-3">HSN</th>
                      <th className="py-3">Qty</th>
                      <th className="py-3">Rate</th>
                      <th className="py-3">Disc %</th>
                      <th className="py-3">Tax %</th>
                      <th className="py-3 pr-5 text-right">Total</th>
                      {editing && <th className="py-3 pr-5" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {editing
                      ? items.map((it, i) => {
                          const sub = it.price * (1 - it.discountRate / 100) * it.qty;
                          const total = sub * (1 + it.taxRate / 100);
                          return (
                            <tr key={i}>
                              <td className="py-2 pl-5 pr-2 min-w-[180px]">
                                <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} className={inputClass} />
                              </td>
                              <td className="py-2 pr-2 w-24">
                                <input value={it.hsnCode || ''} onChange={(e) => updateItem(i, 'hsnCode', e.target.value || null)} className={inputClass} />
                              </td>
                              {(['qty', 'price', 'discountRate', 'taxRate'] as const).map((f) => (
                                <td key={f} className="py-2 pr-2 w-24">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={it[f]}
                                    onChange={(e) => updateItem(i, f, e.target.value === '' ? 0 : Number(e.target.value))}
                                    className={inputClass}
                                  />
                                </td>
                              ))}
                              <td className="py-2 pr-5 text-right font-bold text-white">{formatCurrency(total)}</td>
                              <td className="py-2 pr-5">
                                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300" title="Remove item">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      : invoice.items.map((it, i) => (
                          <tr key={it.id || i}>
                            <td className="py-3 pl-5 font-semibold text-zinc-200">{it.name}</td>
                            <td className="py-3 text-zinc-400">{it.hsnCode || '—'}</td>
                            <td className="py-3 text-zinc-300">{it.qty}</td>
                            <td className="py-3 text-zinc-300">{formatCurrency(it.price)}</td>
                            <td className="py-3 text-zinc-300">{it.discountRate}%</td>
                            <td className="py-3 text-zinc-300">{it.taxRate}%</td>
                            <td className="py-3 pr-5 text-right font-bold text-white">{formatCurrency(it.total || 0)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              {editing && (
                <div className="border-t border-zinc-800 p-3">
                  <button onClick={addItem} className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-400 hover:text-purple-300">
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="ml-auto max-w-sm space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5 text-sm">
              {(() => {
                const sub = editing ? preview.sub : invoice.subTotal;
                const tax = editing ? preview.tax : invoice.taxAmount;
                const total = editing ? preview.sub + preview.tax : invoice.totalAmount;
                const due = Math.max(0, total - invoice.amountPaid);
                return (
                  <>
                    <Row label="Subtotal" value={formatCurrency(sub)} />
                    <Row label="Tax" value={formatCurrency(tax)} />
                    <Row label="Total" value={formatCurrency(total)} strong />
                    <Row label="Paid" value={formatCurrency(invoice.amountPaid)} />
                    <Row label="Due" value={formatCurrency(due)} accent />
                  </>
                );
              })()}
            </div>

            {/* Payments (read-only) */}
            {invoice.payments.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Payments Received</p>
                <ul className="divide-y divide-zinc-800/60 text-sm">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <span className="text-zinc-300">
                        {new Date(p.date).toLocaleDateString('en-IN')} · {p.method}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </span>
                      <span className="font-bold text-emerald-400">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className={accent ? 'font-bold text-pink-400' : strong ? 'font-extrabold text-white' : 'text-zinc-200'}>
        {value}
      </span>
    </div>
  );
}
