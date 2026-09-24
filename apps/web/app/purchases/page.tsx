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
import { toast, showConfirm } from '../store/uiStore';

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  stateCode?: string | null;
  outstandingBalance: number;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  purchasePrice: number;
  taxRate: number;
  stock: number;
  isService?: boolean;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [newVendorBankAccountName, setNewVendorBankAccountName] = useState('');
  const [newVendorBankAccountNumber, setNewVendorBankAccountNumber] = useState('');
  const [newVendorBankIfsc, setNewVendorBankIfsc] = useState('');
  const [newVendorUpiId, setNewVendorUpiId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [autoRestock, setAutoRestock] = useState(true);

  // Business Type & Inventory Tracking awareness
  const isTravel = user?.tenant?.businessType === 'SERVICES_TRAVEL';
  const isStockTrackingEnabled =
    user?.tenant?.trackInventory !== false &&
    !isTravel &&
    user?.tenant?.businessType !== 'SERVICES_GENERAL';

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
  const [quickVendor, setQuickVendor] = useState({
    name: '',
    phone: '',
    gstin: '',
    address: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    upiId: '',
  });
  const [creatingVendor, setCreatingVendor] = useState(false);

  // Edit Vendor Form
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    gstin: '',
    address: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    upiId: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

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
      toast.error('Please select a vendor or switch to "New Vendor"');
      return;
    }
    if (vendorMode === 'new' && !newVendorName.trim()) {
      toast.error('Please enter the vendor name');
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0 && it.qty > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item with a name and quantity');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        vendorId: vendorMode === 'select' ? selectedVendorId : undefined,
        vendorName: vendorMode === 'new' ? newVendorName.trim() : undefined,
        vendorGstin: vendorMode === 'new' ? newVendorGstin.trim() : undefined,
        vendorPhone: vendorMode === 'new' ? newVendorPhone.trim() : undefined,
        vendorAddress: vendorMode === 'new' && newVendorAddress.trim() ? newVendorAddress.trim() : undefined,
        vendorBankAccountName: vendorMode === 'new' && newVendorBankAccountName.trim() ? newVendorBankAccountName.trim() : undefined,
        vendorBankAccountNumber: vendorMode === 'new' && newVendorBankAccountNumber.trim() ? newVendorBankAccountNumber.trim() : undefined,
        vendorBankIfsc: vendorMode === 'new' && newVendorBankIfsc.trim() ? newVendorBankIfsc.trim().toUpperCase() : undefined,
        vendorUpiId: vendorMode === 'new' && newVendorUpiId.trim() ? newVendorUpiId.trim() : undefined,
        billNumber: billNumber.trim() || undefined,
        date: purchaseDate,
        notes: notes.trim() || undefined,
        items: validItems.map((it) => ({
          productId: it.productId && String(it.productId).trim() !== '' ? String(it.productId).trim() : undefined,
          name: it.name.trim(),
          qty: Math.max(1, Math.round(Number(it.qty) || 1)),
          price: Number(it.price) || 0,
          taxRate: Number(it.taxRate) || 0,
          discountRate: Number(it.discountRate) || 0,
          hsnCode: it.hsnCode?.trim() || undefined,
        })),
        autoRestock: isStockTrackingEnabled ? autoRestock : false,
        amountPaid: markPaid ? paidAmount : 0,
        paymentMethod: markPaid ? paymentMethod : undefined,
        paymentReference: markPaid && paymentRef ? paymentRef.trim() : undefined,
      };

      const created = await api.post('/purchases', payload);
      toast.success(`Purchase Invoice ${created.purchaseNumber} recorded successfully!`);

      // Reset Form
      setShowCreateModal(false);
      setSelectedVendorId('');
      setNewVendorName('');
      setNewVendorGstin('');
      setNewVendorPhone('');
      setNewVendorAddress('');
      setNewVendorBankAccountName('');
      setNewVendorBankAccountNumber('');
      setNewVendorBankIfsc('');
      setNewVendorUpiId('');
      setBillNumber('');
      setNotes('');
      setMarkPaid(false);
      setPaidAmount(0);
      setItems([{ name: '', qty: 1, price: 0, taxRate: 18, discountRate: 0, hsnCode: '' }]);

      // Reload
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record purchase invoice');
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
      setQuickVendor({
        name: '',
        phone: '',
        gstin: '',
        address: '',
        bankAccountName: '',
        bankAccountNumber: '',
        bankIfsc: '',
        upiId: '',
      });
      toast.success(`Vendor "${created.name}" created with bank details!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create vendor');
    } finally {
      setCreatingVendor(false);
    }
  };

  // Update Existing Vendor
  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    try {
      setSavingEdit(true);
      const updated = await api.patch(`/purchases/vendors/${editingVendor.id}`, editForm);
      setVendors((prev) => prev.map((v) => (v.id === editingVendor.id ? { ...v, ...updated } : v)));
      setEditingVendor(null);
      toast.success(`Vendor "${updated.name}" updated successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update vendor');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Purchase
  const handleDeletePurchase = async (id: string, number: string) => {
    const ok = await showConfirm({
      title: 'Void Purchase Invoice',
      message: `Are you sure you want to void/delete purchase ${number}? This will revert any added stock.`,
      confirmText: 'Void Invoice',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/purchases/${id}`);
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
      toast.success(`Purchase ${number} deleted successfully.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete purchase');
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

      // Date Range Filtering (From & To)
      const pDateStr = p.date ? p.date.slice(0, 10) : '';
      const matchesFrom = !startDate || (pDateStr && pDateStr >= startDate);
      const matchesTo = !endDate || (pDateStr && pDateStr <= endDate);

      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }, [purchases, search, statusFilter, startDate, endDate]);

  // Aggregate Metrics (Reflects filtered results when search, date range, or status filter is applied)
  const metrics = useMemo(() => {
    const isFiltered = Boolean(search || statusFilter !== 'ALL' || startDate || endDate);
    const targetPurchases = isFiltered ? filteredPurchases : purchases;
    const totalPurchases = targetPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalPayable = isFiltered
      ? targetPurchases.reduce((acc, p) => acc + (p.amountDue || 0), 0)
      : vendors.reduce((acc, v) => acc + (v.outstandingBalance || 0), 0);
    const totalBills = targetPurchases.length;
    const totalVendors = vendors.length;
    return { totalPurchases, totalPayable, totalBills, totalVendors, isFiltered };
  }, [purchases, filteredPurchases, vendors, search, statusFilter, startDate, endDate]);

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
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-xs transition"
              >
                <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                Vendors ({vendors.length})
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition shadow-md shadow-purple-600/20"
              >
                <Plus className="h-4 w-4" />
                Record Purchase Bill
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Inward Bills</span>
                <FileText className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              </div>
              <p className="mt-2 text-xl font-black text-zinc-900 dark:text-white">{metrics.totalBills}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Recorded supplier invoices</span>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Purchases</span>
                <ArrowDownLeft className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </div>
              <p className="mt-2 text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(metrics.totalPurchases)}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Gross value of purchases</span>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Due to Vendors</span>
                <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
              <p className="mt-2 text-xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(metrics.totalPayable)}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Accounts Payable balance</span>
            </div>

            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Vendors</span>
                <Building2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.totalVendors}</p>
              <span className="text-[10px] text-zinc-500 font-medium">Registered suppliers</span>
            </div>
          </div>

          {/* Search, Date Range Filter & Status Filters */}
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-white dark:bg-zinc-900/30 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
            {/* Search Input */}
            <div className="relative w-full xl:w-72 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search by PUR #, Bill #, Vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            {/* Date Range Filter (From Date & To Date) */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs">
                <Calendar className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs text-zinc-900 dark:text-white font-medium focus:outline-none cursor-pointer"
                  title="Filter bills starting from this date"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs text-zinc-900 dark:text-white font-medium focus:outline-none cursor-pointer"
                  title="Filter bills up to this date"
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  title="Clear Date Filter"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition shrink-0 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Reset Dates</span>
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'RECEIVED', 'PAID', 'PARTIALLY_PAID', 'DRAFT'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Purchases Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 shadow-sm dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
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
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-400">
                        Loading purchase invoices...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <ShoppingBag className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                        <p className="text-zinc-700 dark:text-zinc-300 font-semibold">No purchase invoices found</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                          {startDate || endDate || search || statusFilter !== 'ALL'
                            ? 'No bills match your selected date range or search filters.'
                            : 'Click "Record Purchase Bill" to log incoming supplier inventory.'}
                        </p>
                        {(startDate || endDate || search || statusFilter !== 'ALL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate('');
                              setEndDate('');
                              setSearch('');
                              setStatusFilter('ALL');
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 transition cursor-pointer"
                          >
                            <span>Clear All Filters</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition">
                        <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                          {p.purchaseNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-200">{p.vendor?.name}</p>
                          {p.vendor?.gstin && (
                            <p className="text-[10px] text-zinc-500 font-mono">GSTIN: {p.vendor.gstin}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                          {p.billNumber || <span className="text-zinc-400 italic">None</span>}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                          {new Date(p.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(p.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                          {p.amountDue > 0 ? formatCurrency(p.amountDue) : <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Settled</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                : p.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                : p.status === 'DRAFT'
                                ? 'bg-zinc-100 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                : 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
                            }`}
                          >
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedInvoice(p)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-700 dark:border-transparent transition"
                              title="View & Print Voucher"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(p.id, p.purchaseNumber)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-zinc-800/80 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/10 dark:border-transparent transition"
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
                      {(() => {
                        const v = vendors.find((x) => x.id === selectedVendorId);
                        if (!v || (!v.bankAccountNumber && !v.upiId)) return null;
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 flex flex-wrap items-center justify-between gap-2">
                            <span>
                              🏦 Vendor Bank: <strong className="font-mono text-white">{v.bankAccountNumber ? `••••${v.bankAccountNumber.slice(-4)}` : 'N/A'}</strong> (IFSC: {v.bankIfsc || 'N/A'})
                            </span>
                            {v.upiId && <span className="font-mono text-purple-400 font-semibold">UPI: {v.upiId}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-3">
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

                      <div className="pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-300 block mb-2">
                          🏦 Vendor Bank & Settlement Details (Optional)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            placeholder="Account Holder Name"
                            value={newVendorBankAccountName}
                            onChange={(e) => setNewVendorBankAccountName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                          />
                          <input
                            type="text"
                            placeholder="Bank Account Number"
                            value={newVendorBankAccountNumber}
                            onChange={(e) => setNewVendorBankAccountNumber(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Bank IFSC Code"
                            value={newVendorBankIfsc}
                            onChange={(e) => setNewVendorBankIfsc(e.target.value.toUpperCase())}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono uppercase"
                          />
                          <input
                            type="text"
                            placeholder="UPI ID / VPA"
                            value={newVendorUpiId}
                            onChange={(e) => setNewVendorUpiId(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
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
                                {p.name}
                                {isStockTrackingEnabled && !p.isService ? ` (Stock: ${p.stock})` : ''} - ₹{p.purchasePrice}
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

                        {/* Qty / Pack */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-[10px] text-zinc-400 block mb-0.5">{isTravel ? 'Pack' : 'Qty'}</label>
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
                    {isStockTrackingEnabled && (
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
                    )}
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

                {/* Vendor Bank & Settlement Details */}
                {(selectedInvoice.vendor?.bankAccountNumber || selectedInvoice.vendor?.upiId || selectedInvoice.vendor?.bankAccountName) && (
                  <div className="my-5 p-4 rounded-xl bg-purple-50/70 border border-purple-200/90 text-xs text-zinc-900">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-purple-900 text-[10px] mb-2">
                      <span>🏦 Vendor Settlement & Bank Account Details</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                      {selectedInvoice.vendor?.bankAccountName && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">A/C Holder Name:</span>
                          <span className="font-semibold text-zinc-900">{selectedInvoice.vendor.bankAccountName}</span>
                        </div>
                      )}
                      {selectedInvoice.vendor?.bankAccountNumber && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">Account Number:</span>
                          <span className="font-mono font-bold text-zinc-950">{selectedInvoice.vendor.bankAccountNumber}</span>
                        </div>
                      )}
                      {selectedInvoice.vendor?.bankIfsc && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">IFSC Code:</span>
                          <span className="font-mono font-bold text-zinc-950">{selectedInvoice.vendor.bankIfsc}</span>
                        </div>
                      )}
                      {selectedInvoice.vendor?.upiId && (
                        <div>
                          <span className="text-zinc-500 block text-[10px]">UPI / VPA ID:</span>
                          <span className="font-mono font-bold text-purple-800">{selectedInvoice.vendor.upiId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <table className="w-full text-left text-xs border border-zinc-200 rounded-lg overflow-hidden my-6">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700 font-bold uppercase text-[10px] border-b border-zinc-200">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center">{isTravel ? 'Pack' : 'Qty'}</th>
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
                        <td className="py-2.5 px-3 text-center font-bold">{it.qty} {isTravel ? 'Pack' : ''}</td>
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
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  <h3 className="font-bold text-white text-base">Vendors & Suppliers Directory</h3>
                </div>
                <button
                  onClick={() => {
                    setShowVendorsModal(false);
                    setEditingVendor(null);
                  }}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Editing Vendor Form */}
                {editingVendor ? (
                  <form
                    onSubmit={handleUpdateVendor}
                    className="p-5 rounded-2xl bg-purple-950/20 border border-purple-800/40 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">
                        Edit Supplier: {editingVendor.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingVendor(null)}
                        className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Vendor Name *"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="GSTIN (Optional)"
                        value={editForm.gstin}
                        onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Phone (Optional)"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Address (Optional)"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="pt-2 border-t border-purple-800/30">
                      <span className="text-[11px] font-bold text-purple-200 block mb-2">
                        🏦 Bank & Payout Details
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Account Holder Name"
                          value={editForm.bankAccountName}
                          onChange={(e) => setEditForm({ ...editForm, bankAccountName: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Bank Account Number"
                          value={editForm.bankAccountNumber}
                          onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Bank IFSC Code"
                          value={editForm.bankIfsc}
                          onChange={(e) => setEditForm({ ...editForm, bankIfsc: e.target.value.toUpperCase() })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono"
                        />
                        <input
                          type="text"
                          placeholder="UPI ID / VPA"
                          value={editForm.upiId}
                          onChange={(e) => setEditForm({ ...editForm, upiId: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition cursor-pointer"
                      >
                        {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingVendor(null)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:bg-zinc-900 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Quick Add Vendor */
                  <form
                    onSubmit={handleQuickVendorCreate}
                    className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-purple-400" /> Add New Supplier
                      </span>
                      <span className="text-[10px] text-zinc-500">Bank details will show on purchase bills</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Vendor / Business Name *"
                        value={quickVendor.name}
                        onChange={(e) => setQuickVendor({ ...quickVendor, name: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                        required
                      />
                      <input
                        type="text"
                        placeholder="GSTIN (Optional)"
                        value={quickVendor.gstin}
                        onChange={(e) => setQuickVendor({ ...quickVendor, gstin: e.target.value.toUpperCase() })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 uppercase font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Phone (Optional)"
                        value={quickVendor.phone}
                        onChange={(e) => setQuickVendor({ ...quickVendor, phone: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        placeholder="Address (Optional)"
                        value={quickVendor.address}
                        onChange={(e) => setQuickVendor({ ...quickVendor, address: e.target.value })}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Bank Details Section */}
                    <div className="pt-2 border-t border-zinc-800/80">
                      <span className="text-[11px] font-bold text-zinc-300 block mb-2">
                        🏦 Vendor Bank & Payout Details <span className="text-[10px] text-zinc-500 font-normal">(Optional)</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Account Holder Name"
                          value={quickVendor.bankAccountName}
                          onChange={(e) => setQuickVendor({ ...quickVendor, bankAccountName: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                        />
                        <input
                          type="text"
                          placeholder="Bank Account Number"
                          value={quickVendor.bankAccountNumber}
                          onChange={(e) => setQuickVendor({ ...quickVendor, bankAccountNumber: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Bank IFSC Code (e.g. HDFC0001234)"
                          value={quickVendor.bankIfsc}
                          onChange={(e) => setQuickVendor({ ...quickVendor, bankIfsc: e.target.value.toUpperCase() })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 uppercase font-mono"
                        />
                        <input
                          type="text"
                          placeholder="UPI ID / VPA (e.g. vendor@okhdfcbank)"
                          value={quickVendor.upiId}
                          onChange={(e) => setQuickVendor({ ...quickVendor, upiId: e.target.value })}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creatingVendor}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition cursor-pointer"
                    >
                      {creatingVendor ? 'Saving...' : '+ Add Supplier with Bank Info'}
                    </button>
                  </form>
                )}

                {/* Vendors Table */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800 text-[10px] uppercase">
                        <th className="py-2.5 px-3">Vendor Name</th>
                        <th className="py-2.5 px-3">GSTIN / Contact</th>
                        <th className="py-2.5 px-3">Bank / UPI</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {vendors.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-zinc-500">
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
                            <td className="py-2.5 px-3 text-zinc-300 text-[11px]">
                              {v.bankAccountNumber ? (
                                <div>
                                  <span className="font-mono text-white block">
                                    ••••{v.bankAccountNumber.slice(-4)}
                                  </span>
                                  {v.bankIfsc && (
                                    <span className="text-[10px] text-zinc-500 font-mono block">
                                      {v.bankIfsc}
                                    </span>
                                  )}
                                </div>
                              ) : v.upiId ? (
                                <span className="text-purple-400 font-mono text-[11px]">{v.upiId}</span>
                              ) : (
                                <span className="text-zinc-600 italic text-[10px]">No bank added</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                              {formatCurrency(v.outstandingBalance)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVendor(v);
                                  setEditForm({
                                    name: v.name || '',
                                    phone: v.phone || '',
                                    gstin: v.gstin || '',
                                    address: v.address || '',
                                    bankAccountName: v.bankAccountName || '',
                                    bankAccountNumber: v.bankAccountNumber || '',
                                    bankIfsc: v.bankIfsc || '',
                                    upiId: v.upiId || '',
                                  });
                                }}
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition font-medium cursor-pointer"
                              >
                                Edit
                              </button>
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
