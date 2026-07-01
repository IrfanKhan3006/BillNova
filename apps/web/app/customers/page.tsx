'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  Building,
  FileText,
  CreditCard,
  Trash2,
  Edit2,
  X,
  AlertCircle,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  outstandingBalance: number;
}

interface LedgerItem {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  amount: number;
  status: string;
  description: string;
  runningBalance: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    outstandingBalance: 0,
  });

  const loadCustomers = async (searchVal = '') => {
    try {
      setLoading(true);
      const data = await api.get('/customers', { search: searchVal });
      setCustomers(data);
      if (data.length > 0 && !selectedCustomer) {
        setSelectedCustomer(data[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadLedger = async (customerId: string) => {
    try {
      setLedgerLoading(true);
      const res = await api.get(`/customers/${customerId}/ledger`);
      setLedger(res.ledger || []);
    } catch (err: any) {
      console.error('Failed to load ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer) {
      loadLedger(selectedCustomer.id);
    } else {
      setLedger([]);
    }
  }, [selectedCustomer]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadCustomers(val);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setForm({
      id: '',
      name: '',
      email: '',
      phone: '',
      address: '',
      gstin: '',
      outstandingBalance: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setModalMode('edit');
    setForm({
      id: c.id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      gstin: c.gstin || '',
      outstandingBalance: c.outstandingBalance,
    });
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { id, ...payload } = form;
      if (modalMode === 'create') {
        const newCustomer = await api.post('/customers', payload);
        setCustomers((prev) => [newCustomer, ...prev]);
        setSelectedCustomer(newCustomer);
      } else {
        const updated = await api.patch(`/customers/${form.id}`, payload);
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelectedCustomer(updated);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer.');
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
      <div className="space-y-6 h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Customer Management</h1>
            <p className="mt-1 text-zinc-400 text-sm">Add customers, view invoices ledger, and track outstanding ledger balances.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden min-h-0">
          {/* Customers List Sidebar (1/3 columns) */}
          <div className="md:col-span-1 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex flex-col overflow-hidden">
            {/* Search Input */}
            <div className="p-4 border-b border-zinc-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search name, phone, email..."
                  value={search}
                  onChange={handleSearchChange}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-emerald-500 border-zinc-800" />
                </div>
              ) : customers.length > 0 ? (
                customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`p-4 cursor-pointer transition ${
                      selectedCustomer?.id === c.id
                        ? 'bg-emerald-500/10 text-white'
                        : 'hover:bg-zinc-800/20 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm truncate max-w-[150px]">{c.name}</h4>
                      <span
                        className={`text-xs font-bold ${
                          c.outstandingBalance > 0 ? 'text-red-400' : 'text-emerald-450 text-emerald-400'
                        }`}
                      >
                        {formatCurrency(c.outstandingBalance)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-zinc-500">
                      <Phone className="h-3 w-3" />
                      <span>{c.phone || 'No Phone'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-zinc-500 text-sm">No customers found.</div>
              )}
            </div>
          </div>

          {/* Customer Ledger & Details View (2/3 columns) */}
          <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/10 flex flex-col overflow-hidden">
            {selectedCustomer ? (
              <>
                {/* Selected Customer Header */}
                <div className="p-6 border-b border-zinc-800 bg-zinc-900/30 flex flex-col sm:flex-row justify-between gap-4 shrink-0">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-white">{selectedCustomer.name}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                      {selectedCustomer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-zinc-500" />
                          {selectedCustomer.phone}
                        </span>
                      )}
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-zinc-500" />
                          {selectedCustomer.email}
                        </span>
                      )}
                      {selectedCustomer.gstin && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-zinc-500" />
                          GST: <span className="uppercase text-emerald-400 font-semibold">{selectedCustomer.gstin}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEditModal(selectedCustomer)}
                      className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
                      title="Edit Customer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedCustomer.id)}
                      className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500 hover:text-zinc-950 transition"
                      title="Delete Customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Ledger Log */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Ledger Balance Card */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-450 font-bold uppercase tracking-wider text-zinc-500">Net Account Balance</p>
                      <h3
                        className={`text-2xl font-black mt-1 ${
                          selectedCustomer.outstandingBalance > 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrency(selectedCustomer.outstandingBalance)}
                      </h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-800 text-zinc-300">
                      {selectedCustomer.outstandingBalance > 0 ? 'Payment Overdue' : 'Account Settled'}
                    </span>
                  </div>

                  {/* Ledger History List */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-4">Ledger Statement</h3>
                    {ledgerLoading ? (
                      <div className="py-6 flex justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-emerald-500 border-zinc-800" />
                      </div>
                    ) : ledger.length > 0 ? (
                      <div className="border border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm border-collapse bg-zinc-900/10">
                          <thead>
                            <tr className="bg-zinc-900/50 text-zinc-400 text-xs font-bold border-b border-zinc-800 uppercase">
                              <th className="p-3">Date</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Reference</th>
                              <th className="p-3 text-right">Debit (Inv)</th>
                              <th className="p-3 text-right">Credit (Pmt)</th>
                              <th className="p-3 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.map((item) => (
                              <tr key={item.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/10">
                                <td className="p-3 text-xs text-zinc-400">
                                  {new Date(item.date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: '2-digit',
                                  })}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                      item.type === 'INVOICE'
                                        ? 'bg-red-500/5 border-red-500/10 text-red-400'
                                        : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                                    }`}
                                  >
                                    {item.type === 'INVOICE' ? (
                                      <FileText className="h-2.5 w-2.5" />
                                    ) : (
                                      <CreditCard className="h-2.5 w-2.5" />
                                    )}
                                    <span>{item.type}</span>
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-xs text-white">{item.reference}</td>
                                <td className="p-3 text-right font-medium text-white">
                                  {item.type === 'INVOICE' ? formatCurrency(item.amount) : '-'}
                                </td>
                                <td className="p-3 text-right font-medium text-white">
                                  {item.type === 'PAYMENT' ? formatCurrency(item.amount) : '-'}
                                </td>
                                <td className="p-3 text-right font-bold text-white">
                                  {formatCurrency(item.runningBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-zinc-550 border border-zinc-800 border-dashed rounded-xl text-sm text-zinc-500">
                        No transactions registered for this customer account.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                <User className="h-12 w-12 text-zinc-700 mb-3" />
                <h3 className="font-semibold text-lg text-zinc-400">No Customer Selected</h3>
                <p className="text-sm mt-1">Select a customer from the side list to view their ledger detail statements.</p>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">
                  {modalMode === 'create' ? 'Add New Customer' : 'Edit Customer Details'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Phone Number</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="ramesh@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 uppercase"
                    placeholder="e.g. 07AAAAA1111A1Z1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Billing Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Sector-15, Rohini, New Delhi"
                  />
                </div>

                {modalMode === 'create' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300">Opening Outstanding Balance (INR)</label>
                    <input
                      type="number"
                      value={form.outstandingBalance}
                      onChange={(e) => setForm({ ...form, outstandingBalance: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 text-sm font-semibold"
                  >
                    Save Customer
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
