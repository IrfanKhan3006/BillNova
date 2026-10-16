'use client';

/**
 * Public view of a shared quotation, sales order, purchase order,
 * credit note, debit note or delivery challan
 * (/doc?s=<token>). Opened by the customer or supplier from the WhatsApp
 * message, so it must render without a login and must never show anything the
 * party should not see — the API already restricts the fields it returns.
 *
 * Styled to match the public bill page (/bill) so both links feel like the
 * same business.
 */

import { useEffect, useState } from 'react';
import { Printer, Phone, MapPin, Mail } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface PublicDocItem {
  name: string;
  description?: string | null;
  qty: number;
  price: number;
  taxRate: number;
  discountRate: number;
  hsnCode?: string | null;
  total: number;
}

interface PublicParty {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
}

interface PublicDoc {
  kind:
    | 'QUOTATION'
    | 'SALES_ORDER'
    | 'PURCHASE_ORDER'
    | 'CREDIT_NOTE'
    | 'DEBIT_NOTE'
    | 'DELIVERY_CHALLAN';
  quotationNumber?: string;
  salesOrderNumber?: string;
  purchaseOrderNumber?: string;
  creditNoteNumber?: string;
  debitNoteNumber?: string;
  challanNumber?: string;
  date: string;
  validUntil?: string | null;
  expectedDeliveryDate?: string | null;
  status: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  deliveryAddress?: string | null;
  termsAndConditions?: string | null;
  notes?: string | null;
  reason?: string | null;
  reasonNote?: string | null;
  originalInvoiceNumber?: string | null;
  originalInvoiceDate?: string | null;
  challanType?: string | null;
  vehicleNumber?: string | null;
  despatchedThrough?: string | null;
  destination?: string | null;
  shipToName?: string | null;
  shipToAddress?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  customer?: PublicParty;
  vendor?: PublicParty;
  items: PublicDocItem[];
  tenant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    logoUrl?: string | null;
  };
}

const money = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

const shortDate = (val?: string | null) =>
  val
    ? new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

const LABELS = {
  QUOTATION: { title: 'QUOTATION', lead: 'Your quotation from', party: 'Quotation For' },
  SALES_ORDER: { title: 'SALES ORDER', lead: 'Your order from', party: 'Order For' },
  PURCHASE_ORDER: { title: 'PURCHASE ORDER', lead: 'Purchase order from', party: 'Supplier' },
  CREDIT_NOTE: { title: 'CREDIT NOTE', lead: 'Credit note from', party: 'Credit For' },
  DEBIT_NOTE: { title: 'DEBIT NOTE', lead: 'Debit note from', party: 'Supplier' },
  DELIVERY_CHALLAN: { title: 'DELIVERY CHALLAN', lead: 'Goods dispatched by', party: 'Deliver To' },
} as const;

export default function PublicDocumentPage() {
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('s');

    if (!token) {
      setError('This link is incomplete. Please use the full link sent to you.');
      setLoading(false);
      return;
    }

    // Plain fetch (not the app's api client) so a missing login never redirects a visitor.
    fetch(`${BASE_URL}/public-documents/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Document not found or no longer available.');
        return res.json();
      })
      .then((data: PublicDoc) => setDoc(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-emerald-500" />
      </main>
    );
  }

  if (error || !doc) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-zinc-900">Document unavailable</h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
        </div>
      </main>
    );
  }

  const labels = LABELS[doc.kind];
  const party =
    doc.kind === 'PURCHASE_ORDER' || doc.kind === 'DEBIT_NOTE'
      ? doc.vendor
      : doc.customer;
  const number =
    doc.quotationNumber ||
    doc.salesOrderNumber ||
    doc.purchaseOrderNumber ||
    doc.creditNoteNumber ||
    doc.debitNoteNumber ||
    doc.challanNumber ||
    '';
  // The second date shown next to the document date differs per kind; a note
  // shows the bill it was raised against instead, which is its GST reference.
  const secondary =
    doc.kind === 'QUOTATION'
      ? { label: 'Valid Until', value: doc.validUntil }
      : doc.kind === 'CREDIT_NOTE' || doc.kind === 'DEBIT_NOTE'
        ? { label: 'Against Bill Dated', value: doc.originalInvoiceDate }
        : { label: 'Expected Delivery', value: doc.expectedDeliveryDate };

  return (
    <main className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        {/* Screen-only action bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {labels.lead}
            </p>
            <p className="text-base font-bold text-zinc-900">{doc.tenant.name}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none sm:p-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
            <div className="flex items-start gap-3">
              {doc.tenant.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.tenant.logoUrl}
                  alt={doc.tenant.name}
                  className="h-12 w-12 rounded-lg object-contain"
                />
              )}
              <div>
                <p className="text-base font-bold text-zinc-900">{doc.tenant.name}</p>
                {doc.tenant.address && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-zinc-600">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    {doc.tenant.address}
                  </p>
                )}
                {doc.tenant.gstin && (
                  <p className="text-xs text-zinc-600">GSTIN: {doc.tenant.gstin}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-lg font-black tracking-tight text-zinc-900">
                {labels.title}
              </h1>
              <p className="text-xs text-zinc-500">No.: {number}</p>
              <p className="mt-1 text-xs text-zinc-600">Date: {shortDate(doc.date)}</p>
              {secondary.value && (
                <p className="text-xs text-zinc-600">
                  {secondary.label}: {shortDate(secondary.value)}
                </p>
              )}
              {doc.originalInvoiceNumber && (
                <p className="text-xs text-zinc-600">
                  Against Bill: {doc.originalInvoiceNumber}
                </p>
              )}
              {doc.challanType && doc.challanType !== 'DELIVERY' && (
                <p className="text-xs text-zinc-600">
                  Type: {doc.challanType.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          </div>

          {/* Party */}
          <div className="py-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {labels.party}
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-900">{party?.name}</p>
            {party?.address && <p className="text-xs text-zinc-600">{party.address}</p>}
            {party?.gstin && <p className="text-xs text-zinc-600">GSTIN: {party.gstin}</p>}
          </div>

          {/* Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-zinc-200 text-left text-zinc-600">
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 text-right font-semibold">Qty</th>
                  <th className="py-2 text-right font-semibold">Rate</th>
                  <th className="py-2 text-right font-semibold">Tax</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-2.5 text-zinc-900">
                      {item.name}
                      {item.description && (
                        <span className="block text-[11px] text-zinc-500">
                          {item.description}
                        </span>
                      )}
                      {item.hsnCode && (
                        <span className="text-[11px] text-zinc-400"> HSN {item.hsnCode}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-zinc-700">{item.qty}</td>
                    <td className="py-2.5 text-right text-zinc-700">{money(item.price)}</td>
                    <td className="py-2.5 text-right text-zinc-700">{item.taxRate}%</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-900">
                      {money(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span>{money(doc.subTotal)}</span>
              </div>
              {doc.discountAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Discount</span>
                  <span>-{money(doc.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>GST</span>
                <span>{money(doc.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-300 pt-1.5 text-sm font-black text-zinc-900">
                <span>Total</span>
                <span>{money(doc.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="mt-6 space-y-1 border-t border-zinc-200 pt-4 text-xs text-zinc-600">
            {doc.paymentTerms && (
              <p>
                <span className="font-semibold text-zinc-800">Payment Terms:</span>{' '}
                {doc.paymentTerms}
              </p>
            )}
            {doc.deliveryTerms && (
              <p>
                <span className="font-semibold text-zinc-800">Delivery:</span>{' '}
                {doc.deliveryTerms}
              </p>
            )}
            {doc.deliveryAddress && (
              <p>
                <span className="font-semibold text-zinc-800">Delivery Address:</span>{' '}
                {doc.deliveryAddress}
              </p>
            )}
            {doc.termsAndConditions && (
              <p>
                <span className="font-semibold text-zinc-800">Terms:</span>{' '}
                {doc.termsAndConditions}
              </p>
            )}
            {doc.reason && (
              <p>
                <span className="font-semibold text-zinc-800">Reason:</span>{' '}
                {doc.reason.replace(/_/g, ' ')}
                {doc.reasonNote ? ` — ${doc.reasonNote}` : ''}
              </p>
            )}
            {doc.despatchedThrough && (
              <p>
                <span className="font-semibold text-zinc-800">
                  Despatched Through:
                </span>{' '}
                {doc.despatchedThrough}
              </p>
            )}
            {doc.vehicleNumber && (
              <p>
                <span className="font-semibold text-zinc-800">Vehicle No.:</span>{' '}
                {doc.vehicleNumber}
              </p>
            )}
            {doc.destination && (
              <p>
                <span className="font-semibold text-zinc-800">Destination:</span>{' '}
                {doc.destination}
              </p>
            )}
            {doc.shipToName && (
              <p>
                <span className="font-semibold text-zinc-800">Ship To:</span>{' '}
                {doc.shipToName}
                {doc.shipToAddress ? `, ${doc.shipToAddress}` : ''}
              </p>
            )}
            {doc.notes && <p className="pt-1">{doc.notes}</p>}
            {doc.approvedByName && (
              <p className="pt-1">
                <span className="font-semibold text-zinc-800">Approved by:</span>{' '}
                {doc.approvedByName} on {shortDate(doc.approvedAt)}
              </p>
            )}
          </div>

          {/* Contact footer */}
          <div className="mt-6 flex flex-wrap gap-4 border-t border-zinc-200 pt-4 text-xs text-zinc-600">
            {doc.tenant.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> {doc.tenant.phone}
              </span>
            )}
            {doc.tenant.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> {doc.tenant.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
