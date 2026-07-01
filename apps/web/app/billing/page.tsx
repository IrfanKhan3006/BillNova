'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  Plus,
  Trash2,
  Receipt,
  User,
  Package,
  Calendar,
  FileText,
  Printer,
  CheckCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

interface Product {
  id: string;
  name: string;
  salesPrice: number;
  taxRate: number;
  unit: string;
  stock: number;
}

interface InvoiceItemInput {
  productId?: string;
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  discountRate: number;
}

export default function BillingPage() {
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Selection states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Items array
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { name: '', qty: 1, price: 0, taxRate: 0, discountRate: 0 },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [custData, prodData] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
        ]);
        setCustomers(custData);
        setProducts(prodData);
        if (custData.length > 0) {
          setSelectedCustomerId(custData[0].id);
        }
      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleProductSelect = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        productId: prod.id,
        name: prod.name,
        qty: 1,
        price: prod.salesPrice,
        taxRate: prod.taxRate,
        discountRate: 0,
      };
      return copy;
    });
  };

  const handleItemChange = (index: number, field: keyof InvoiceItemInput, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return copy;
    });
  };

  const addNewItem = () => {
    setItems((prev) => [
      ...prev,
      { name: '', qty: 1, price: 0, taxRate: 0, discountRate: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const calculateInvoiceSummary = () => {
    let subTotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    items.forEach((item) => {
      const price = item.price || 0;
      const qty = item.qty || 0;
      const discountRate = item.discountRate || 0;
      const taxRate = item.taxRate || 0;

      const rateAfterDiscount = price * (1 - discountRate / 100);
      const itemSubTotal = rateAfterDiscount * qty;
      const itemTaxAmount = itemSubTotal * (taxRate / 100);
      const itemDiscountAmount = (price * (discountRate / 100)) * qty;

      subTotal += itemSubTotal;
      taxAmount += itemTaxAmount;
      discountAmount += itemDiscountAmount;
    });

    const totalAmount = subTotal + taxAmount;

    return {
      subTotal,
      taxAmount,
      discountAmount,
      totalAmount,
    };
  };

  const summary = calculateInvoiceSummary();

  const handleGenerateInvoice = async () => {
    if (!selectedCustomerId) {
      alert('Select a customer first!');
      return;
    }

    const filteredItems = items.filter((item) => item.name.trim() !== '');
    if (filteredItems.length === 0) {
      alert('Add at least one product!');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/invoices', {
        customerId: selectedCustomerId,
        items: filteredItems,
        date,
        notes,
        status: 'SENT',
      });
      // Fetch full details (with populated items/customer details) for printing
      const fullInvoice = await api.get(`/invoices/${res.id}`);
      setCreatedInvoice(fullInvoice);
    } catch (err: any) {
      alert(err.message || 'Failed to create invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetBilling = () => {
    setCreatedInvoice(null);
    setNotes('');
    setItems([{ name: '', qty: 1, price: 0, taxRate: 0, discountRate: 0 }]);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
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

  // Print view display
  if (createdInvoice) {
    const cust = createdInvoice.customer;
    return (
      <SidebarLayout>
        <div className="space-y-6 max-w-4xl mx-auto no-print">
          {/* Action buttons */}
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-xl">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Invoice Created Successfully!</h3>
                <p className="text-zinc-450 text-[11px] text-zinc-500">Invoice Ref: {createdInvoice.invoiceNumber}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                <Printer className="h-4 w-4" />
                <span>Print Invoice</span>
              </button>
              <button
                onClick={resetBilling}
                className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white border border-zinc-700"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Bill</span>
              </button>
            </div>
          </div>
        </div>

        {/* Printable Area (Styled to fit standard A4 sheets) */}
        <div className="print-invoice-sheet bg-white text-zinc-900 p-8 rounded-2xl border border-zinc-300 max-w-4xl mx-auto mt-6 shadow-md">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-zinc-200 pb-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">{user?.tenant?.name}</h2>
              {user?.tenant?.address && <p className="text-xs text-zinc-550 mt-1 max-w-sm whitespace-pre-line">{user.tenant.address}</p>}
              {user?.tenant?.phone && <p className="text-xs text-zinc-500 mt-0.5">Phone: {user.tenant.phone}</p>}
              {user?.tenant?.gstin && (
                <p className="text-xs text-zinc-650 font-bold mt-1 text-emerald-700">
                  GSTIN: <span className="uppercase">{user.tenant.gstin}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold text-zinc-400 tracking-wider uppercase">TAX INVOICE</h3>
              <div className="mt-3 text-xs text-zinc-600 space-y-1">
                <p>Invoice No: <span className="font-mono font-bold text-zinc-950">{createdInvoice.invoiceNumber}</span></p>
                <p>Date: <span className="font-medium text-zinc-950">{new Date(createdInvoice.date).toLocaleDateString('en-IN')}</span></p>
                <p>Due Date: <span className="font-medium text-zinc-950">{new Date(createdInvoice.dueDate).toLocaleDateString('en-IN')}</span></p>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="my-6 grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Bill To:</h4>
              <p className="font-bold text-zinc-900 text-sm mt-1">{cust.name}</p>
              {cust.address && <p className="text-xs text-zinc-550 mt-0.5 whitespace-pre-line">{cust.address}</p>}
              {cust.phone && <p className="text-xs text-zinc-500 mt-0.5">Phone: {cust.phone}</p>}
              {cust.gstin && (
                <p className="text-xs text-emerald-850 font-bold mt-1">
                  Customer GSTIN: <span className="uppercase">{cust.gstin}</span>
                </p>
              )}
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-xs border-collapse mt-4">
            <thead>
              <tr className="bg-zinc-100 text-zinc-700 uppercase font-bold border-t border-b border-zinc-200">
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-2">Item Description</th>
                <th className="py-2.5 px-2 text-right">Price</th>
                <th className="py-2.5 px-2 text-center">Qty</th>
                <th className="py-2.5 px-2 text-right">Disc %</th>
                <th className="py-2.5 px-2 text-right">GST %</th>
                <th className="py-2.5 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {createdInvoice.items.map((item: any, idx: number) => (
                <tr key={item.id} className="border-b border-zinc-200/60">
                  <td className="py-3 px-2 text-zinc-400">{idx + 1}</td>
                  <td className="py-3 px-2 font-bold text-zinc-900">{item.name}</td>
                  <td className="py-3 px-2 text-right">{formatCurrency(item.price)}</td>
                  <td className="py-3 px-2 text-center font-semibold">{item.qty}</td>
                  <td className="py-3 px-2 text-right">{item.discountRate}%</td>
                  <td className="py-3 px-2 text-right">{item.taxRate}%</td>
                  <td className="py-3 px-2 text-right font-bold text-zinc-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary calculations */}
          <div className="flex justify-end mt-6">
            <div className="w-64 space-y-2 text-xs border-t border-zinc-200 pt-4">
              <div className="flex justify-between text-zinc-550">
                <span>Subtotal:</span>
                <span>{formatCurrency(createdInvoice.subTotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-550">
                <span>Discount Allowed:</span>
                <span className="text-red-650">- {formatCurrency(createdInvoice.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-zinc-550 border-b border-zinc-200 pb-2">
                <span>Tax Amount (GST):</span>
                <span>{formatCurrency(createdInvoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-zinc-950 pt-1">
                <span>Grand Total:</span>
                <span>{formatCurrency(createdInvoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {createdInvoice.notes && (
            <div className="border-t border-zinc-150 mt-8 pt-4">
              <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Notes & Terms</h5>
              <p className="text-xs text-zinc-600 mt-1 whitespace-pre-line">{createdInvoice.notes}</p>
            </div>
          )}

          {/* Footer signature */}
          <div className="flex justify-between items-end mt-16 pt-8 border-t border-zinc-100 text-[10px] text-zinc-450">
            <div>
              <p>Thank you for your business!</p>
              <p className="text-zinc-400 mt-0.5">Software Powered by BillNova ERP</p>
            </div>
            <div className="text-center w-48 border-t border-zinc-350 pt-2">
              <p className="font-bold text-zinc-700 uppercase tracking-wider">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-emerald-500" />
            <span>Billing Engine</span>
          </h1>
          <p className="mt-1 text-zinc-400 text-sm">Generate multi-tenant, GST-compliant tax invoices in real-time.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
              {/* Customer Selector & Date */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Select Customer *</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="mt-2 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Invoice Date *</label>
                  <div className="relative mt-2">
                    <Calendar className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="block w-full rounded-lg border border-zinc-805 bg-zinc-950 pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">Line Items</h3>
                
                {items.map((item, idx) => (
                  <div key={idx} className="grid gap-3 sm:grid-cols-12 items-end border-b border-zinc-850 pb-4 last:border-0 last:pb-0">
                    {/* Select Product */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Select Product</label>
                      <select
                        value={item.productId || ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Choose Catalog Item --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit}) - {formatCurrency(p.salesPrice)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Manual name override */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Item Label</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="Label"
                      />
                    </div>

                    {/* Price */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Price</label>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {/* Qty */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Qty</label>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none text-center"
                      />
                    </div>

                    {/* Disc % */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Disc%</label>
                      <input
                        type="number"
                        value={item.discountRate}
                        onChange={(e) => handleItemChange(idx, 'discountRate', parseFloat(e.target.value) || 0)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none text-center"
                      />
                    </div>

                    {/* Tax % */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Tax%</label>
                      <input
                        type="number"
                        value={item.taxRate}
                        onChange={(e) => handleItemChange(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none text-center"
                      />
                    </div>

                    {/* Delete Action */}
                    <div className="sm:col-span-1 flex justify-center">
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-zinc-950 transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addNewItem}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition mt-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Notes / Special Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-2 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="Notes shown on invoice print sheet"
                />
              </div>
            </div>
          </div>

          {/* Right sidebar calculation display (1 column) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sticky top-24 space-y-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Billing Aggregation</h3>
              
              <div className="space-y-3.5 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Item Subtotal:</span>
                  <span className="font-bold text-white">{formatCurrency(summary.subTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Trade Discount:</span>
                  <span className="font-bold text-red-400">- {formatCurrency(summary.discountAmount)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-3">
                  <span>GST Collected:</span>
                  <span className="font-bold text-white">{formatCurrency(summary.taxAmount)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2">
                  <span className="text-sm font-bold text-white">Grand Total (INR):</span>
                  <span className="text-xl font-black text-emerald-450 text-emerald-400">{formatCurrency(summary.totalAmount)}</span>
                </div>
              </div>

              <button
                onClick={handleGenerateInvoice}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition disabled:opacity-50"
              >
                {submitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                ) : (
                  <>
                    <Receipt className="h-4.5 w-4.5" />
                    <span>Generate Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
