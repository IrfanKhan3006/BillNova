'use client';

/**
 * Shared workspace for the three order documents: quotations, sales orders and
 * purchase orders. They differ only in wording, the party they address
 * (customer vs vendor), their statuses and the actions that move them along the
 * pipeline, so all of that is config and the list/create/detail/print machinery
 * is written once here.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { saveElementAsPdf } from '../lib/savePdf';
import { downloadCsv, csvDate, csvAmount } from '../lib/exportCsv';
import { toast, showConfirm } from '../store/uiStore';
import { toWhatsAppNumber, buildWhatsAppLink } from '../lib/whatsappBill';
import {
  buildDocumentMessage,
  buildDocumentLink,
  DocumentKind,
} from '../lib/whatsappDocument';
import { useAuthStore } from '../store/authStore';
import {
  Plus,
  Search,
  Printer,
  Download,
  Trash2,
  X,
  ChevronRight,
  Calendar,
  FileText,
  Loader2,
  MessageCircle,
} from 'lucide-react';

export interface PartyOption {
  id: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  salesPrice: number;
  purchasePrice: number;
  taxRate: number;
  hsnCode?: string | null;
}

export interface DocumentAction {
  key: string;
  label: string;
  /** Returns null when the action does not apply to this document. */
  enabledFor: (doc: any) => boolean;
  confirm?: (doc: any) => {
    title: string;
    message: string;
    confirmText: string;
    danger?: boolean;
  };
  run: (doc: any) => Promise<any>;
  successMessage: (result: any) => string;
  tone?: 'primary' | 'neutral';
}

export interface OrderDocumentConfig {
  /** API path segment, e.g. 'quotations' */
  resource: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  /** Field holding the human-readable number on the API response. */
  numberField: string;
  /** 'customer' reads/sends customerId; 'vendor' reads/sends vendorId. */
  partyKind: 'customer' | 'vendor';
  partyLabel: string;
  /** Where to load the selectable parties from. */
  partyEndpoint: string;
  /** Price field used to prefill a line from a product. */
  priceField: 'salesPrice' | 'purchasePrice';
  statuses: string[];
  statusTone: Record<string, string>;
  /** Extra date on the document, shown next to the document date. */
  secondaryDateField?: { key: string; label: string };
  /** Free-text fields offered in the create form and shown on the print sheet. */
  termsFields: { key: string; label: string; placeholder: string }[];
  printTitle: string;
  actions: DocumentAction[];
  createLabel: string;
  /** Which wording the WhatsApp message uses. */
  documentKind: DocumentKind;
  /** Status assigned by the create form, if the document should not start as a draft. */
  defaultCreateStatus?: string;
}

interface LineDraft {
  productId: string;
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  discountRate: number;
  hsnCode: string;
}

const emptyLine = (): LineDraft => ({
  productId: '',
  name: '',
  qty: 1,
  price: 0,
  taxRate: 0,
  discountRate: 0,
  hsnCode: '',
});

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (value?: string | Date | null) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export default function OrderDocumentWorkspace({
  config,
}: {
  config: OrderDocumentConfig;
}) {
  const { user } = useAuthStore();
  const Icon = config.icon;

  const [documents, setDocuments] = useState<any[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [selected, setSelected] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ─── Create form state ────────────────────────────────────────────────────
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [secondaryDate, setSecondaryDate] = useState('');
  const [terms, setTerms] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await api.get(`/${config.resource}`, {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || `Could not load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [config.resource, config.title, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(loadDocuments, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadDocuments, search]);

  useEffect(() => {
    (async () => {
      try {
        const [partyData, productData] = await Promise.all([
          api.get(config.partyEndpoint),
          api.get('/products'),
        ]);
        setParties(Array.isArray(partyData) ? partyData : partyData?.data || []);
        setProducts(
          Array.isArray(productData) ? productData : productData?.data || [],
        );
      } catch {
        // The form still works with manually typed lines.
      }
    })();
  }, [config.partyEndpoint]);

  // ─── Derived totals for the create form ───────────────────────────────────
  const draftTotals = useMemo(() => {
    let subTotal = 0;
    let taxAmount = 0;
    for (const line of lines) {
      const qty = Math.max(1, Number(line.qty) || 1);
      const rate = (Number(line.price) || 0) * (1 - (Number(line.discountRate) || 0) / 100);
      const lineSub = rate * qty;
      subTotal += lineSub;
      taxAmount += lineSub * ((Number(line.taxRate) || 0) / 100);
    }
    return { subTotal, taxAmount, totalAmount: subTotal + taxAmount };
  }, [lines]);

  const stats = useMemo(() => {
    const totalValue = documents.reduce(
      (sum, doc) => sum + (Number(doc.totalAmount) || 0),
      0,
    );
    const open = documents.filter(
      (doc) => !['CANCELLED', 'REJECTED', 'CONVERTED', 'INVOICED', 'RECEIVED'].includes(doc.status),
    ).length;
    return { count: documents.length, totalValue, open };
  }, [documents]);

  const resetForm = () => {
    setPartyId('');
    setDate(new Date().toISOString().slice(0, 10));
    setSecondaryDate('');
    setTerms({});
    setNotes('');
    setLines([emptyLine()]);
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      updateLine(index, { productId: '' });
      return;
    }
    updateLine(index, {
      productId,
      name: product.name,
      price: Number(product[config.priceField]) || 0,
      taxRate: Number(product.taxRate) || 0,
      hsnCode: product.hsnCode || '',
    });
  };

  const handleCreate = async () => {
    if (!partyId) {
      toast.error(`Please select a ${config.partyLabel.toLowerCase()}.`);
      return;
    }
    const validLines = lines.filter(
      (line) => line.name.trim() !== '' || line.productId !== '',
    );
    if (validLines.length === 0) {
      toast.error('Add at least one line item.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        [config.partyKind === 'customer' ? 'customerId' : 'vendorId']: partyId,
        date,
        notes: notes.trim() || undefined,
        ...(config.defaultCreateStatus
          ? { status: config.defaultCreateStatus }
          : {}),
        ...(config.secondaryDateField && secondaryDate
          ? { [config.secondaryDateField.key]: secondaryDate }
          : {}),
        items: validLines.map((line) => ({
          productId: line.productId || undefined,
          name: line.name.trim() || undefined,
          qty: Math.max(1, Number(line.qty) || 1),
          price: Number(line.price) || 0,
          taxRate: Number(line.taxRate) || 0,
          discountRate: Number(line.discountRate) || 0,
          hsnCode: line.hsnCode.trim() || undefined,
        })),
      };
      for (const field of config.termsFields) {
        if (terms[field.key]?.trim()) payload[field.key] = terms[field.key].trim();
      }

      const created = await api.post(`/${config.resource}`, payload);
      toast.success(`${created[config.numberField]} created.`);
      setShowCreate(false);
      resetForm();
      await loadDocuments();
      openDetail(created.id);
    } catch (err: any) {
      toast.error(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const doc = await api.get(`/${config.resource}/${id}`);
      setSelected(doc);
    } catch (err: any) {
      toast.error(err.message || 'Could not open this document.');
    }
  };

  const runAction = async (action: DocumentAction, doc: any) => {
    if (action.confirm) {
      const ok = await showConfirm(action.confirm(doc));
      if (!ok) return;
    }
    setBusyAction(action.key);
    try {
      const result = await action.run(doc);
      toast.success(action.successMessage(result));
      await loadDocuments();
      await openDetail(doc.id);
    } catch (err: any) {
      toast.error(err.message || 'That action could not be completed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (doc: any) => {
    const ok = await showConfirm({
      title: `Delete ${doc[config.numberField]}?`,
      message: 'This document will be removed from your list. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/${config.resource}/${doc.id}`);
      toast.success(`${doc[config.numberField]} deleted.`);
      setSelected(null);
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete this document.');
    }
  };

  const handleExport = () => {
    downloadCsv(
      config.resource,
      ['Number', config.partyLabel, 'Date', 'Status', 'Sub Total', 'Tax', 'Total'],
      documents.map((doc) => [
        doc[config.numberField],
        doc[config.partyKind]?.name || '',
        csvDate(doc.date),
        doc.status,
        csvAmount(doc.subTotal),
        csvAmount(doc.taxAmount),
        csvAmount(doc.totalAmount),
      ]),
    );
  };

  /**
   * Opens WhatsApp with the message pre-filled for the party this document is
   * for — the customer, or the supplier on a purchase order. The share token is
   * fetched first so the link always points at a page the party can actually
   * open; without a saved number we cannot address the chat, so we say so
   * rather than opening an empty WhatsApp.
   */
  const handleWhatsApp = async () => {
    if (!selected) return;

    const party = selected[config.partyKind];
    const phone = toWhatsAppNumber(party?.phone);
    if (!phone) {
      toast.error(
        `No WhatsApp number saved for this ${config.partyLabel.toLowerCase()}. Add a phone number first.`,
      );
      return;
    }

    setBusyAction('whatsapp');
    try {
      const { shareToken } = await api.get(
        `/${config.resource}/${selected.id}/share`,
      );

      const message = buildDocumentMessage({
        kind: config.documentKind,
        partyName: party?.name,
        businessName: selected.tenant?.name,
        businessPhone: selected.tenant?.phone,
        documentNumber: selected[config.numberField],
        totalAmount: selected.totalAmount,
        secondaryDate: config.secondaryDateField
          ? selected[config.secondaryDateField.key]
          : null,
        documentLink: buildDocumentLink(shareToken),
      });

      window.open(buildWhatsAppLink(phone, message), '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Could not prepare the WhatsApp message.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePdf = async () => {
    if (!printRef.current || !selected) return;
    try {
      await saveElementAsPdf(printRef.current, selected[config.numberField]);
    } catch {
      toast.error('Could not generate the PDF.');
    }
  };

  const toneFor = (status: string) =>
    config.statusTone[status] ||
    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Icon className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {config.title}
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-400">{config.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={documents.length === 0}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="h-4 w-4" /> {config.createLabel}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: `Total ${config.title}`, value: String(stats.count) },
          { label: 'Open', value: String(stats.open) },
          { label: 'Total Value', value: formatCurrency(stats.totalValue) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {stat.label}
            </p>
            <p className="mt-1.5 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search by number or ${config.partyLabel.toLowerCase()}`}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
        >
          <option value="">All statuses</option>
          {config.statuses.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-400">
              No {config.title.toLowerCase()} yet
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {config.createLabel} to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3 font-semibold">Number</th>
                  <th className="px-5 py-3 font-semibold">{config.partyLabel}</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => openDetail(doc.id)}
                    className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30 cursor-pointer transition"
                  >
                    <td className="px-5 py-3.5 font-bold text-white">
                      {doc[config.numberField]}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">
                      {doc[config.partyKind]?.name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">
                      {formatDate(doc.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneFor(doc.status)}`}
                      >
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-white">
                      {formatCurrency(doc.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <ChevronRight className="h-4 w-4 text-zinc-600 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl my-8 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-black text-white">
                {config.createLabel}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {config.partyLabel}
                  </label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    <option value="">Select {config.partyLabel.toLowerCase()}</option>
                    {parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                  />
                </div>

                {config.secondaryDateField && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {config.secondaryDateField.label}
                    </label>
                    <input
                      type="date"
                      value={secondaryDate}
                      onChange={(e) => setSecondaryDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Items
                  </label>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, emptyLine()])}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <Plus className="h-3 w-3" /> Add line
                  </button>
                </div>

                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                    >
                      <div className="col-span-12 sm:col-span-4 space-y-2">
                        <select
                          value={line.productId}
                          onChange={(e) => pickProduct(index, e.target.value)}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-white focus:border-purple-500/50 focus:outline-none"
                        >
                          <option value="">Custom item…</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={line.name}
                          onChange={(e) => updateLine(index, { name: e.target.value })}
                          placeholder="Description"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none"
                        />
                      </div>

                      {[
                        { key: 'qty' as const, label: 'Qty', step: '1' },
                        { key: 'price' as const, label: 'Rate', step: '0.01' },
                        { key: 'taxRate' as const, label: 'Tax %', step: '0.01' },
                        { key: 'discountRate' as const, label: 'Disc %', step: '0.01' },
                      ].map((field) => (
                        <div key={field.key} className="col-span-6 sm:col-span-2">
                          <label className="text-[10px] font-semibold uppercase text-zinc-600">
                            {field.label}
                          </label>
                          <input
                            type="number"
                            step={field.step}
                            min="0"
                            value={line[field.key]}
                            onChange={(e) =>
                              updateLine(index, {
                                [field.key]: Number(e.target.value),
                              } as Partial<LineDraft>)
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-white focus:border-purple-500/50 focus:outline-none"
                          />
                        </div>
                      ))}

                      <div className="col-span-12 sm:col-span-12 flex items-center justify-between pt-1">
                        <span className="text-xs font-semibold text-zinc-400">
                          Line total:{' '}
                          <span className="text-white">
                            {formatCurrency(
                              (Number(line.price) || 0) *
                                (1 - (Number(line.discountRate) || 0) / 100) *
                                Math.max(1, Number(line.qty) || 1) *
                                (1 + (Number(line.taxRate) || 0) / 100),
                            )}
                          </span>
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setLines((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="rounded-lg p-1.5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {config.termsFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {field.label}
                    </label>
                    <input
                      value={terms[field.key] || ''}
                      onChange={(e) =>
                        setTerms((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Draft totals */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(draftTotals.subTotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Tax</span>
                  <span>{formatCurrency(draftTotals.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800 pt-1.5 font-black text-white">
                  <span>Total</span>
                  <span>{formatCurrency(draftTotals.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-emerald-400 transition disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl my-8">
            <div className="flex items-center justify-between gap-3 rounded-t-2xl border border-b-0 border-zinc-800 bg-zinc-950 px-6 py-4 print:hidden">
              <h2 className="text-lg font-black text-white">
                {selected[config.numberField]}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {config.actions
                  .filter((action) => action.enabledFor(selected))
                  .map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => runAction(action, selected)}
                      disabled={busyAction !== null}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                        action.tone === 'neutral'
                          ? 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800'
                          : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                      }`}
                    >
                      {busyAction === action.key && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {action.label}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  disabled={busyAction !== null}
                  className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-[#1eb855] transition disabled:opacity-50"
                >
                  {busyAction === 'whatsapp' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5" />
                  )}
                  Send on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                >
                  <Printer className="h-3.5 w-3.5" /> PDF
                </button>
                {user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selected)}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Printable sheet */}
            <div
              ref={printRef}
              className="rounded-b-2xl border border-zinc-800 bg-white p-8 text-zinc-900"
            >
              <div className="text-center border-b border-zinc-200 pb-4">
                <h3 className="text-xl font-bold tracking-tight">
                  {config.printTitle}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  No.: {selected[config.numberField]}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 py-5 text-xs">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {config.partyKind === 'customer' ? 'Seller' : 'Buyer'}
                  </p>
                  <p className="mt-1 font-bold text-sm">{selected.tenant?.name}</p>
                  {selected.tenant?.address && (
                    <p className="text-zinc-600">{selected.tenant.address}</p>
                  )}
                  {selected.tenant?.gstin && (
                    <p className="text-zinc-600">GSTIN: {selected.tenant.gstin}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {config.partyLabel}
                  </p>
                  <p className="mt-1 font-bold text-sm">
                    {selected[config.partyKind]?.name}
                  </p>
                  {selected[config.partyKind]?.address && (
                    <p className="text-zinc-600">
                      {selected[config.partyKind].address}
                    </p>
                  )}
                  {selected[config.partyKind]?.gstin && (
                    <p className="text-zinc-600">
                      GSTIN: {selected[config.partyKind].gstin}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-5 border-y border-zinc-200 py-2.5 text-xs text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Date: {formatDate(selected.date)}
                </span>
                {config.secondaryDateField &&
                  selected[config.secondaryDateField.key] && (
                    <span>
                      {config.secondaryDateField.label}:{' '}
                      {formatDate(selected[config.secondaryDateField.key])}
                    </span>
                  )}
                <span>Status: {selected.status.replace(/_/g, ' ')}</span>
              </div>

              <table className="w-full mt-5 text-xs">
                <thead>
                  <tr className="border-b border-zinc-300 text-left">
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 font-semibold text-right">Qty</th>
                    <th className="py-2 font-semibold text-right">Rate</th>
                    <th className="py-2 font-semibold text-right">Tax %</th>
                    <th className="py-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((item: any) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="py-2">
                        {item.name}
                        {item.hsnCode && (
                          <span className="text-zinc-400"> · HSN {item.hsnCode}</span>
                        )}
                      </td>
                      <td className="py-2 text-right">{item.qty}</td>
                      <td className="py-2 text-right">{formatCurrency(item.price)}</td>
                      <td className="py-2 text-right">{item.taxRate}%</td>
                      <td className="py-2 text-right font-semibold">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selected.subTotal)}</span>
                </div>
                {selected.discountAmount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(selected.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-600">
                  <span>GST</span>
                  <span>{formatCurrency(selected.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-300 pt-1.5 text-sm font-bold">
                  <span>Grand Total</span>
                  <span>{formatCurrency(selected.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-1 border-t border-zinc-200 pt-4 text-xs text-zinc-600">
                {config.termsFields.map(
                  (field) =>
                    selected[field.key] && (
                      <p key={field.key}>
                        <span className="font-semibold text-zinc-800">
                          {field.label}:
                        </span>{' '}
                        {selected[field.key]}
                      </p>
                    ),
                )}
                {selected.notes && <p className="pt-1">{selected.notes}</p>}
                {selected.approvedByName && (
                  <p className="pt-2">
                    <span className="font-semibold text-zinc-800">Approved by:</span>{' '}
                    {selected.approvedByName} on {formatDate(selected.approvedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
