'use client';

import React, { useEffect, useState, useMemo } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  ShoppingBag,
  Plus,
  Search,
  Building2,
  Calendar,
  CreditCard,
  Printer,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowDownLeft,
  ChevronRight,
  FileText,
  DollarSign,
  PackagePlus,
  Users,
} from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  stateCode?: string | null;
  outstandingBalance: number;
}

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  purchasePrice: number;
  taxRate: number;
  stock: number;
  hsnCode?: string | null;
}

interface PurchaseItem {
  productId?: string;
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  discountRate: number;
  hsnCode?: string;
}

interface PurchaseInvoice {
  id: string;
  purchaseNumber: string;
  billNumber?: string | null;
  date: string;
  dueDate?: string | null;
  status: 'DRAFT' | 'RECEIVED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  notes?: string | null;
  vendor: Vendor;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    price: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    hsnCode?: string | null;
    product?: Product | null;
  }>;
}

export default function PurchasesPage() {
  const { user } = useAuthStore();
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVendorsModal, setShowVendorsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Purchase Form State
  const [vendorMode, setVendorMode] = useState<'select' | 'new'>('select');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorGstin, setNewVendorGstin] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [autoRestock, setAutoRestock] = useState(true);

  // Tax Mode: Intra-state (CGST + SGST) vs Inter-state (IGST)
  const [taxMode, setTaxMode] = useState<'INTRA' | 'INTER'>('INTRA');

  useEffect(() => {
    if (selectedVendorId) {
      const v = vendors.find((x) => x.id === selectedVendorId);
      const vState = v?.stateCode || v?.gstin?.slice(0, 2) || '';
      const myState = user?.tenant?.stateCode || user?.tenant?.gstin?.slice(0, 2) || '';
      if (vState && myState && vState !== myState) {
        setTaxMode('INTER');
      } else {
        setTaxMode('INTRA');
      }
    } else if (newVendorGstin && newVendorGstin.length >= 2) {
      const vState = newVendorGstin.slice(0, 2);
      const myState = user?.tenant?.stateCode || user?.tenant?.gstin?.slice(0, 2) || '';
      if (vState && myState && vState !== myState) {
        setTaxMode('INTER');
      } else {
        setTaxMode('INTRA');
      }
    }
  }, [selectedVendorId, newVendorGstin, vendors, user]);

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([
    { name: '', qty: 1, price: 0, taxRate: 18, discountRate: 0, hsnCode: '' },
  ]);

  // Payment upon creation
  const [markPaid, setMarkPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');

  // Quick Vendor Create Form inside Directory Modal
  const [quickVendor, setQuickVendor] = useState({ name: '', phone: '', gstin: '', address: '' });
  const [creatingVendor, setCreatingVendor] = useState(false);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [purchasesRes, vendorsRes, productsRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/purchases/vendors'),
        api.get('/products'),
      ]);
      setPurchases(purchasesRes || []);
      setVendors(vendorsRes || []);
      setProducts(productsRes || []);
    } catch (err: any) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Item helpers
  const handleItemChange = (index: number, field: keyof PurchaseItem, val: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };

      // Auto-fill product info if product selected
      if (field === 'productId') {
        const prod = products.find((p) => p.id === val);
        if (prod) {
          updated[index].name = prod.name;
          updated[index].price = prod.purchasePrice || 0;
          updated[index].taxRate = prod.taxRate || 0;
          updated[index].hsnCode = prod.hsnCode || '';
        }
      }
      return updated;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { name: '', qty: 1, price: 0, taxRate: 18, discountRate: 0, hsnCode: '' },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculations = useMemo(() => {
    let subTotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const discountRate = Number(item.discountRate) || 0;

      const itemSub = price * (1 - discountRate / 100) * qty;
      const itemTax = itemSub * (taxRate / 100);
      const itemDisc = price * (discountRate / 100) * qty;

      subTotal += itemSub;
      taxAmount += itemTax;
      discountAmount += itemDisc;
    });

    const grandTotal = subTotal + taxAmount;
    return { subTotal, taxAmount, discountAmount, grandTotal };
  }, [items]);

  // Handle Form Submit
  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (vendorMode === 'select' && !selectedVendorId) {
      alert('Please select a vendor or switch to "New Vendor"');
      return;
    }
    if (vendorMode === 'new' && !newVendorName.trim()) {
      alert('Please enter the vendor name');
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0 && it.qty > 0);
    if (validItems.length === 0) {
      alert('Please add at least one valid item with a name and quantity');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        vendorId: vendorMode === 'select' ? selectedVendorId : undefined,
        vendorName: vendorMode === 'new' ? newVendorName.trim() : undefined,
        vendorGstin: vendorMode === 'new' ? newVendorGstin.trim() : undefined,
        vendorPhone: vendorMode === 'new' ? newVendorPhone.trim() : undefined,
        billNumber: billNumber.trim() || undefined,
        date: purchaseDate,
        notes: notes.trim() || undefined,
        items: validItems,
        autoRestock,
        amountPaid: markPaid ? paidAmount : 0,
        paymentMethod: markPaid ? paymentMethod : undefined,
        paymentReference: markPaid && paymentRef ? paymentRef.trim() : undefined,
      };

      const created = await api.post('/purchases', payload);
      alert(`Purchase Invoice ${created.purchaseNumber} recorded successfully!`);

      // Reset Form
      setShowCreateModal(false);
      setSelectedVendorId('');
      setNewVendorName('');
      setNewVendorGstin('');
      setNewVendorPhone('');
      setBillNumber('');
      setNotes('');
      setMarkPaid(false);
      setPaidAmount(0);
      setItems([{ name: '', qty: 1, price: 0, taxRate: 18, discountRate: 0, hsnCode: '' }]);

      // Reload
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Vendor Create
  const handleQuickVendorCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVendor.name.trim()) return;
    try {
      setCreatingVendor(true);
      const created = await api.post('/purchases/vendors', quickVendor);
      setVendors((prev) => [...prev, created]);
      setQuickVendor({ name: '', phone: '', gstin: '', address: '' });
      alert(`Vendor "${created.name}" created!`);
    } catch (err: any) {
      alert(err.message || 'Failed to create vendor');
    } finally {
      setCreatingVendor(false);
    }
  };

  // Delete Purchase
  const handleDeletePurchase = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to void/delete purchase ${number}? This will revert any added stock.`)) {
      return;
    }
    try {
      await api.delete(`/purchases/${id}`);
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
      alert(`Purchase ${number} deleted.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete purchase');
    }
  };

  // Filtered List
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesSearch =
        p.purchaseNumber.toLowerCase().includes(search.toLowerCase()) ||
        (p.billNumber && p.billNumber.toLowerCase().includes(search.toLowerCase())) ||
        p.vendor.name.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchases, search, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalPurchases = purchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalPayable = vendors.reduce((acc, v) => acc + (v.outstandingBalance || 0), 0);
    const totalBills = purchases.length;
    const totalVendors = vendors.length;
    return { totalPurchases, totalPayable, totalBills, totalVendors };
  }, [purchases, vendors]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <SidebarLayout>
      <FeatureGate featureKey="purchasesEnabled" featureName="Purchase Invoices">
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white">Purchase Invoices</h1>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Record inward stock, supplier tax bills, track accounts payable, and restock products.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowVendorsModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
              >
                <Users className="h-4 w-4 text-zinc-400" />
                Vendors ({vendors.length})
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/20"
              >
                <Plus className="h-4 w-4" />
                Record Purchase Bill
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Total Inward Bills</span>
                <FileText className="h-4 w-4 text-purple-400" />
              </div>
              <p className="mt-2 text-xl font-black text-white">{metrics.totalBills}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Recorded supplier invoices</span>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Total Purchases</span>
                <ArrowDownLeft className="h-4 w-4 text-blue-400" />
              </div>
              <p className="mt-2 text-xl font-black text-blue-400">{formatCurrency(metrics.totalPurchases)}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Gross value of purchases</span>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Due to Vendors</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-2 text-xl font-black text-amber-400">{formatCurrency(metrics.totalPayable)}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Accounts Payable balance</span>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Active Vendors</span>
                <Building2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-xl font-black text-emerald-400">{metrics.totalVendors}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Registered suppliers</span>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-900/20 p-2.5 rounded-2xl border border-zinc-800/80">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by PUR #, Bill #, or Vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'RECEIVED', 'PAID', 'PARTIALLY_PAID', 'DRAFT'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                    statusFilter === st
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Purchases Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Purchase #</th>
                    <th className="py-3 px-4">Supplier / Vendor</th>
                    <th className="py-3 px-4">Bill / Ref #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        Loading purchase invoices...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <ShoppingBag className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                        <p className="text-zinc-400 font-semibold">No purchase invoices found</p>
                        <p className="text-zinc-600 text-[11px] mt-0.5">Click "Record Purchase Bill" to log incoming supplier inventory.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-800/30 transition">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-purple-400" />
                          {p.purchaseNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-zinc-200">{p.vendor?.name}</p>
                          {p.vendor?.gstin && (
                            <p className="text-[10px] text-zinc-500 font-mono">GSTIN: {p.vendor.gstin}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">
                          {p.billNumber || <span className="text-zinc-600 italic">None</span>}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {new Date(p.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-zinc-100">
                          {formatCurrency(p.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-amber-400">
                          {p.amountDue > 0 ? formatCurrency(p.amountDue) : <span className="text-emerald-400">Settled</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : p.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : p.status === 'DRAFT'
                                ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedInvoice(p)}
                              className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
                              title="View & Print Voucher"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(p.id, p.purchaseNumber)}
                              className="p-1.5 rounded-lg bg-zinc-800/80 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                              title="Delete Purchase"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── MODAL: RECORD PURCHASE INVOICE ───────────────────────────────── */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <PackagePlus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Record Purchase Bill</h3>
                    <p className="text-[11px] text-zinc-400">Fill in supplier invoice details to add inward inventory.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleCreatePurchase} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Vendor Selection */}
                <div className="space-y-3 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-purple-400" /> Vendor / Supplier Details *
                    </label>
                    <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setVendorMode('select')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition ${
                          vendorMode === 'select' ? 'bg-purple-600 text-white' : 'text-zinc-400'
                        }`}
                      >
                        Existing Vendor
                      </button>
                      <button
                        type="button"
                        onClick={() => setVendorMode('new')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition ${
                          vendorMode === 'new' ? 'bg-purple-600 text-white' : 'text-zinc-400'
                        }`}
                      >
                        + New Vendor
                      </button>
                    </div>
                  </div>

                  {vendorMode === 'select' ? (
                    <div>
                      <select
                        value={selectedVendorId}
                        onChange={(e) => setSelectedVendorId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        required
                      >
                        <option value="">-- Choose Existing Supplier --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} {v.gstin ? `(${v.gstin})` : ''} - Due: {formatCurrency(v.outstandingBalance)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <input
                          type="text"
                          placeholder="Vendor Name *"
                          value={newVendorName}
                          onChange={(e) => setNewVendorName(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="GSTIN (Optional)"
                          value={newVendorGstin}
                          onChange={(e) => setNewVendorGstin(e.target.value.toUpperCase())}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 uppercase"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Phone (Optional)"
                          value={newVendorPhone}
                          onChange={(e) => setNewVendorPhone(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Bill & Date References */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/80">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                      Supplier's Bill / Invoice # <span className="text-zinc-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026/089"
                      value={billNumber}
                      onChange={(e) => setBillNumber(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Purchase Date *</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                {/* GST Tax Mode Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/30 border border-zinc-800 rounded-xl p-3.5 text-xs">
                  <div>
                    <span className="font-bold text-white block">GST Tax Breakdown:</span>
                    <span className="text-[11px] text-zinc-500">
                      {taxMode === 'INTRA' ? 'Intra-State: CGST (50%) + SGST (50%)' : 'Inter-State: IGST (100%)'}
                    </span>
                  </div>
                  <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTaxMode('INTRA')}
                      className={`px-3 py-1.5 rounded-md font-bold transition ${
                        taxMode === 'INTRA' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      CGST + SGST (Intra-State)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode('INTER')}
                      className={`px-3 py-1.5 rounded-md font-bold transition ${
                        taxMode === 'INTER' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      IGST (Inter-State)
                    </button>
                  </div>
                </div>

                {/* 3. Items Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-purple-400" /> Inward Purchase Items *
                    </label>
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Row
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800 items-center"
                      >
                        {/* Product Picker or Custom Name */}
                        <div className="col-span-12 sm:col-span-5 space-y-1">
                          <select
                            value={it.productId || ''}
                            onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="">-- Custom Item or Choose Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.stock}) - ₹{p.purchasePrice}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Item / Product Name *"
                            value={it.name}
                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                            required
                          />
                        </div>

                        {/* Qty */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={it.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                            required
                          />
                        </div>

                        {/* Purchase Price (Cost) */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Rate (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.price}
                            onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                            required
                          />
                        </div>

                        {/* Tax Rate % */}
                        <div className="col-span-3 sm:col-span-2">
                          <label className="text-[10px] text-zinc-400 block mb-0.5">GST %</label>
                          <select
                            value={it.taxRate}
                            onChange={(e) => handleItemChange(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>

                        {/* Delete Row */}
                        <div className="col-span-1 flex justify-center pt-3.5">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                            className="text-zinc-500 hover:text-red-400 disabled:opacity-30 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Restocking Toggle & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRestock}
                        onChange={(e) => setAutoRestock(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-0 h-4 w-4"
                      />
                      <span className="text-xs text-zinc-300 font-medium">
                        Auto-increment stock in Product Catalog
                      </span>
                    </label>
                    <textarea
                      placeholder="Optional remarks, notes or PO number..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Summary Box */}
                  <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(calculations.subTotal)}</span>
                    </div>

                    {taxMode === 'INTER' ? (
                      <div className="flex justify-between text-blue-400">
                        <span>IGST (Integrated Tax):</span>
                        <span className="font-bold">{formatCurrency(calculations.taxAmount)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-zinc-400">
                          <span>CGST (Central Tax 50%):</span>
                          <span className="font-bold text-white">{formatCurrency(calculations.taxAmount / 2)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>SGST (State Tax 50%):</span>
                          <span className="font-bold text-white">{formatCurrency(calculations.taxAmount / 2)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between border-t border-zinc-800/80 pt-1 text-zinc-400">
                      <span>Total Tax (GST):</span>
                      <span className="font-bold text-white">{formatCurrency(calculations.taxAmount)}</span>
                    </div>

                    <div className="flex justify-between font-bold text-white text-sm border-t border-zinc-800 pt-1.5">
                      <span>Grand Total:</span>
                      <span className="text-purple-400">{formatCurrency(calculations.grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Payment details (Optional) */}
                <div className="border border-zinc-800 bg-zinc-900/30 p-3.5 rounded-2xl space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markPaid}
                      onChange={(e) => {
                        setMarkPaid(e.target.checked);
                        if (e.target.checked) setPaidAmount(calculations.grandTotal);
                      }}
                      className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-0 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-white">Record payment made to supplier now</span>
                  </label>

                  {markPaid && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">Amount Paid (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          max={calculations.grandTotal}
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                        >
                          <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                          <option value="UPI">UPI</option>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card</option>
                          <option value="OTHER">Cheque / Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">UTR / Ref #</label>
                        <input
                          type="text"
                          placeholder="e.g. UTR-8928123"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Recording...' : 'Save Purchase Bill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: PRINT / DOWNLOAD PURCHASE VOUCHER ──────────────────────── */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden my-auto">
              {/* Modal Actions Header */}
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 no-print">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-400" />
                  <span className="font-bold text-white text-sm">Purchase Invoice: {selectedInvoice.purchaseNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                  </button>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Sheet */}
              <div className="flex-1 overflow-y-auto p-8 bg-white text-zinc-900 print:p-0 print:m-0 print:w-full">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-zinc-200 pb-6">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">
                      {user?.tenant?.name || 'BILLNOVA BUSINESS'}
                    </h2>
                    {user?.tenant?.gstin && (
                      <p className="text-xs font-semibold text-zinc-700 mt-1">GSTIN: {user.tenant.gstin}</p>
                    )}
                    {user?.tenant?.address && <p className="text-xs text-zinc-500 mt-0.5">{user.tenant.address}</p>}
                    {user?.tenant?.phone && <p className="text-xs text-zinc-500">Phone: {user.tenant.phone}</p>}
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded bg-zinc-100 text-zinc-800 font-black text-xs uppercase tracking-wider mb-2">
                      Purchase Voucher
                    </span>
                    <p className="text-sm font-bold text-zinc-900">{selectedInvoice.purchaseNumber}</p>
                    {selectedInvoice.billNumber && (
                      <p className="text-xs text-zinc-600">Supplier Bill #: {selectedInvoice.billNumber}</p>
                    )}
                    <p className="text-xs text-zinc-500 mt-1">
                      Date:{' '}
                      {new Date(selectedInvoice.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Vendor Section */}
                <div className="grid grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-zinc-500 text-[10px] block mb-1">
                      Supplier / Vendor Details
                    </span>
                    <p className="font-bold text-zinc-900 text-sm">{selectedInvoice.vendor?.name}</p>
                    {selectedInvoice.vendor?.gstin && (
                      <p className="text-zinc-600 font-mono mt-0.5">GSTIN: {selectedInvoice.vendor.gstin}</p>
                    )}
                    {selectedInvoice.vendor?.phone && (
                      <p className="text-zinc-600">Phone: {selectedInvoice.vendor.phone}</p>
                    )}
                    {selectedInvoice.vendor?.address && (
                      <p className="text-zinc-600">{selectedInvoice.vendor.address}</p>
                    )}
                  </div>

                  <div className="text-right flex flex-col justify-between">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-zinc-500 text-[10px] block mb-1">
                        Payment Status
                      </span>
                      <span className="font-bold text-zinc-900">
                        {selectedInvoice.status.replace('_', ' ')}
                      </span>
                    </div>
                    {selectedInvoice.dueDate && (
                      <p className="text-zinc-500 text-[11px]">
                        Payment Due: {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border border-zinc-200 rounded-lg overflow-hidden my-6">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[10px] border-b border-zinc-200">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Cost Rate</th>
                      <th className="py-2.5 px-3 text-right">Tax Rate</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {selectedInvoice.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2.5 px-3 text-zinc-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-900">
                          {it.name}
                          {it.hsnCode && <span className="text-[10px] text-zinc-500 font-mono ml-1.5">(HSN: {it.hsnCode})</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">{it.qty}</td>
                        <td className="py-2.5 px-3 text-right">₹{it.price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right">{it.taxRate}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-zinc-900">₹{it.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total Summary */}
                <div className="flex justify-between items-start border-t border-zinc-200 pt-4 text-xs">
                  <div className="max-w-xs text-zinc-600">
                    {selectedInvoice.notes && (
                      <div>
                        <span className="font-bold text-zinc-800 text-[11px] block">Notes:</span>
                        <p className="text-[11px] italic mt-0.5">{selectedInvoice.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-zinc-600">
                      <span>Subtotal:</span>
                      <span>₹{selectedInvoice.subTotal.toFixed(2)}</span>
                    </div>

                    {(() => {
                      const myState = user?.tenant?.stateCode || user?.tenant?.gstin?.slice(0, 2) || '';
                      const vState = selectedInvoice.vendor?.stateCode || selectedInvoice.vendor?.gstin?.slice(0, 2) || '';
                      const isInter = Boolean(myState && vState && myState !== vState);

                      if (isInter) {
                        return (
                          <div className="flex justify-between text-zinc-700">
                            <span>IGST:</span>
                            <span className="font-semibold">₹{selectedInvoice.taxAmount.toFixed(2)}</span>
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className="flex justify-between text-zinc-700">
                            <span>CGST:</span>
                            <span className="font-semibold">₹{(selectedInvoice.taxAmount / 2).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-zinc-700">
                            <span>SGST:</span>
                            <span className="font-semibold">₹{(selectedInvoice.taxAmount / 2).toFixed(2)}</span>
                          </div>
                        </>
                      );
                    })()}

                    <div className="flex justify-between text-zinc-600 border-b border-zinc-200 pb-1">
                      <span>Total GST:</span>
                      <span>₹{selectedInvoice.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-zinc-950 text-sm pt-1">
                      <span>Invoice Total:</span>
                      <span>₹{selectedInvoice.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                      <span>Amount Paid:</span>
                      <span>₹{selectedInvoice.amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-bold border-t border-zinc-100 pt-1">
                      <span>Balance Due:</span>
                      <span>₹{selectedInvoice.amountDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Signature Block */}
                <div className="mt-12 pt-8 border-t border-zinc-200 flex justify-between items-end text-xs text-zinc-500">
                  <p>Generated by BillNova ERP</p>
                  <div className="text-right">
                    <div className="w-48 border-b border-zinc-300 pb-1 mb-1 font-semibold text-zinc-800 text-center">
                      Authorized Signatory
                    </div>
                    <p className="text-[10px] text-zinc-400 text-center">Receiver / Store Keeper</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: VENDORS DIRECTORY & ADD ──────────────────────────────── */}
        {showVendorsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  <h3 className="font-bold text-white text-base">Vendors & Suppliers Directory</h3>
                </div>
                <button
                  onClick={() => setShowVendorsModal(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Quick Add Vendor */}
                <form
                  onSubmit={handleQuickVendorCreate}
                  className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3"
                >
                  <span className="text-xs font-bold text-white block">Add New Supplier</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Vendor Name *"
                      value={quickVendor.name}
                      onChange={(e) => setQuickVendor({ ...quickVendor, name: e.target.value })}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="GSTIN (Optional)"
                      value={quickVendor.gstin}
                      onChange={(e) => setQuickVendor({ ...quickVendor, gstin: e.target.value.toUpperCase() })}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white uppercase"
                    />
                    <input
                      type="text"
                      placeholder="Phone (Optional)"
                      value={quickVendor.phone}
                      onChange={(e) => setQuickVendor({ ...quickVendor, phone: e.target.value })}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Address (Optional)"
                      value={quickVendor.address}
                      onChange={(e) => setQuickVendor({ ...quickVendor, address: e.target.value })}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingVendor}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition"
                  >
                    {creatingVendor ? 'Saving...' : '+ Add Vendor'}
                  </button>
                </form>

                {/* Vendors Table */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800 text-[10px] uppercase">
                        <th className="py-2.5 px-3">Vendor Name</th>
                        <th className="py-2.5 px-3">GSTIN / Contact</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {vendors.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-zinc-500">
                            No vendors registered yet.
                          </td>
                        </tr>
                      ) : (
                        vendors.map((v) => (
                          <tr key={v.id} className="hover:bg-zinc-900/30">
                            <td className="py-2.5 px-3 font-semibold text-white">{v.name}</td>
                            <td className="py-2.5 px-3 text-zinc-400 font-mono text-[11px]">
                              {v.gstin || v.phone || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                              {formatCurrency(v.outstandingBalance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </FeatureGate>
    </SidebarLayout>
  );
}
