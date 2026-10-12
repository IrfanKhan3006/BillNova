'use client';

import { useEffect, useState } from 'react';
import { Printer, Star, Phone, MapPin, Mail } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface PublicBillItem {
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  discountRate: number;
  hsnCode?: string | null;
  total: number;
}

interface PublicBill {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  isAdvance: boolean;
  discountAmount: number;
  taxAmount: number;
  subTotal: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  notes?: string | null;
  customer: { name: string; phone?: string | null; address?: string | null; gstin?: string | null };
  items: PublicBillItem[];
  tenant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    logoUrl?: string | null;
    upiId?: string | null;
    googleReviewUrl?: string | null;
  };
}

const money = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

const shortDate = (val?: string | null) =>
  val
    ? new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

export default function PublicBillPage() {
  const [bill, setBill] = useState<PublicBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('s');

    if (!token) {
      setError('This bill link is incomplete. Please use the full link sent to you.');
      setLoading(false);
      return;
    }

    // Plain fetch (not the app's api client) so a missing login never redirects a customer.
    fetch(`${BASE_URL}/public/bills/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Bill not found or no longer available.');
        return res.json();
      })
      .then((data: PublicBill) => setBill(data))
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

  if (error || !bill) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-zinc-900">Bill unavailable</h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
        </div>
      </main>
    );
  }

  const paidInFull = bill.amountDue <= 0;

  return (
    <main className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        {/* Screen-only action bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your bill from</p>
            <p className="text-base font-bold text-zinc-900">{bill.tenant.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {bill.tenant.googleReviewUrl && (
              <a
                href={bill.tenant.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-400"
              >
                <Star className="h-4 w-4" />
                <span>Review us</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Bill sheet */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm sm:p-8 print:rounded-none print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
            <div className="flex items-start gap-3">
              {bill.tenant.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bill.tenant.logoUrl} alt={bill.tenant.name} className="h-14 w-14 rounded-lg object-contain" />
              )}
              <div>
                <h1 className="text-xl font-black tracking-tight">{bill.tenant.name}</h1>
                {bill.tenant.address && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-zinc-600">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{bill.tenant.address}</span>
                  </p>
                )}
                {bill.tenant.phone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
                    <Phone className="h-3 w-3" /> {bill.tenant.phone}
                  </p>
                )}
                {bill.tenant.email && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
                    <Mail className="h-3 w-3" /> {bill.tenant.email}
                  </p>
                )}
                {bill.tenant.gstin && (
                  <p className="mt-0.5 text-xs font-semibold text-zinc-700">GSTIN: {bill.tenant.gstin}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {bill.isAdvance ? 'Advance Bill' : 'Tax Invoice'}
              </p>
              <p className="text-lg font-bold">{bill.invoiceNumber}</p>
              <p className="text-xs text-zinc-600">Date: {shortDate(bill.date)}</p>
              <span
                className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  paidInFull
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : bill.amountPaid > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {paidInFull ? 'Paid' : bill.amountPaid > 0 ? 'Partially Paid' : 'Payment Pending'}
              </span>
            </div>
          </div>

          {/* Customer */}
          <div className="border-b border-zinc-200 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Billed to</p>
            <p className="mt-1 font-bold">{bill.customer.name}</p>
            {bill.customer.address && <p className="text-xs text-zinc-600">{bill.customer.address}</p>}
            {bill.customer.phone && <p className="text-xs text-zinc-600">Phone: {bill.customer.phone}</p>}
            {bill.customer.gstin && <p className="text-xs text-zinc-600">GSTIN: {bill.customer.gstin}</p>}
          </div>

          {/* Items */}
          <div className="-mx-6 overflow-x-auto px-6 py-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-2 font-bold">#</th>
                  <th className="pb-2 pr-2 font-bold">Item</th>
                  <th className="pb-2 pr-2 text-right font-bold">Qty</th>
                  <th className="pb-2 pr-2 text-right font-bold">Rate</th>
                  <th className="pb-2 pr-2 text-right font-bold">GST %</th>
                  <th className="pb-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, i) => (
                  <tr key={`${item.name}-${i}`} className="border-b border-zinc-100">
                    <td className="py-2.5 pr-2 text-zinc-500">{i + 1}</td>
                    <td className="py-2.5 pr-2 font-semibold">
                      {item.name}
                      {item.hsnCode && <span className="ml-1 text-[10px] font-normal text-zinc-500">(HSN {item.hsnCode})</span>}
                    </td>
                    <td className="py-2.5 pr-2 text-right">{item.qty}</td>
                    <td className="py-2.5 pr-2 text-right">{money(item.price)}</td>
                    <td className="py-2.5 pr-2 text-right">{item.taxRate}%</td>
                    <td className="py-2.5 text-right font-semibold">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end border-t border-zinc-200 pt-5">
            <div className="w-full max-w-xs space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Sub Total</span>
                <span className="font-semibold text-zinc-900">{money(bill.subTotal)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Discount</span>
                  <span className="font-semibold text-zinc-900">- {money(bill.discountAmount)}</span>
                </div>
              )}
              {bill.taxAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>GST</span>
                  <span className="font-semibold text-zinc-900">{money(bill.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-black">
                <span>Grand Total</span>
                <span>{money(bill.totalAmount)}</span>
              </div>
              {bill.amountPaid > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Paid</span>
                  <span className="font-semibold">{money(bill.amountPaid)}</span>
                </div>
              )}
              {bill.amountDue > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Balance Due</span>
                  <span className="font-bold">{money(bill.amountDue)}</span>
                </div>
              )}
            </div>
          </div>

          {bill.notes && (
            <div className="mt-6 whitespace-pre-line border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-600">
              {bill.notes}
            </div>
          )}

          {bill.tenant.upiId && bill.amountDue > 0 && (
            <p className="mt-4 text-[11px] text-zinc-600">
              Pay via UPI: <span className="font-semibold text-zinc-900">{bill.tenant.upiId}</span>
            </p>
          )}

          <p className="mt-6 text-center text-[10px] text-zinc-400">
            Thank you for your business — {bill.tenant.name}
          </p>
        </div>
      </div>
    </main>
  );
}
