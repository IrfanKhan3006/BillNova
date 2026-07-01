'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  IndianRupee,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Building2,
  Users,
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'payments' | 'tax' | 'customers'>('sales');
  
  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const loadReport = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      let data;
      if (activeTab === 'sales') {
        data = await api.get('/reports/sales', params);
      } else if (activeTab === 'payments') {
        data = await api.get('/reports/payments', params);
      } else if (activeTab === 'tax') {
        data = await api.get('/reports/tax', params);
      } else if (activeTab === 'customers') {
        data = await api.get('/reports/customers');
      }
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeTab, startDate, endDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 no-print">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-emerald-500" />
              <span>Financial Reports</span>
            </h1>
            <p className="mt-1 text-zinc-400 text-sm">Generate real-time business summaries, tax breakdown, and ledger statement summaries.</p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white border border-zinc-700"
          >
            <Download className="h-4 w-4" />
            <span>Export / Print</span>
          </button>
        </div>

        {/* Filters and tabs */}
        <div className="rounded-2xl border border-zinc-805 bg-zinc-900/10 p-4 space-y-4 no-print">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
            {[
              { id: 'sales', name: 'Sales Register', icon: FileText },
              { id: 'payments', name: 'Payments Register', icon: CreditCard },
              { id: 'tax', name: 'Tax Breakdowns', icon: Building2 },
              { id: 'customers', name: 'Customer Balances', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setReportData(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-zinc-400 hover:bg-zinc-805/30 border border-transparent'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>

          {/* Date Picker (only show for sales, payments, tax reports) */}
          {activeTab !== 'customers' && (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-450 uppercase text-zinc-500">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-455 uppercase text-zinc-500">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="py-24 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-emerald-500 border-zinc-800" />
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            {/* Sales tab content */}
            {activeTab === 'sales' && (
              <>
                {/* Sales Summary Cards */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 no-print">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Sales Invoices</p>
                    <h3 className="text-xl font-bold text-white mt-1">{reportData.summary?.totalInvoices || 0}</h3>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Value Billed</p>
                    <h3 className="text-xl font-bold text-white mt-1">{formatCurrency(reportData.summary?.totalAmount || 0)}</h3>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total GST Collected</p>
                    <h3 className="text-xl font-bold text-emerald-450 text-emerald-450 mt-1">{formatCurrency(reportData.summary?.taxAmount || 0)}</h3>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Discount Allowed</p>
                    <h3 className="text-xl font-bold text-red-400 mt-1">{formatCurrency(reportData.summary?.discountAmount || 0)}</h3>
                  </div>
                </div>

                {/* Sales Register Table */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase bg-zinc-900/20">
                        <th className="p-4">Invoice No</th>
                        <th className="p-4">Customer Name</th>
                        <th className="p-4">Billing Date</th>
                        <th className="p-4 text-right">Subtotal</th>
                        <th className="p-4 text-right">GST Collected</th>
                        <th className="p-4 text-right">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {reportData.invoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-zinc-800/10 transition">
                          <td className="p-4 font-mono text-xs text-white">{inv.invoiceNumber}</td>
                          <td className="p-4 font-semibold text-zinc-300">{inv.customerName}</td>
                          <td className="p-4 text-xs text-zinc-450">
                            {new Date(inv.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-4 text-right text-zinc-350">{formatCurrency(inv.subTotal)}</td>
                          <td className="p-4 text-right text-emerald-400">{formatCurrency(inv.taxAmount)}</td>
                          <td className="p-4 text-right font-black text-white">{formatCurrency(inv.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Payments tab content */}
            {activeTab === 'payments' && (
              <>
                {/* Payments summary cards */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 no-print">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Payments Collected</p>
                    <h3 className="text-xl font-bold text-white mt-1">{reportData.summary?.totalPayments || 0}</h3>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Cash Credit</p>
                    <h3 className="text-xl font-bold text-emerald-450 text-emerald-400 mt-1">{formatCurrency(reportData.summary?.totalAmount || 0)}</h3>
                  </div>
                </div>

                {/* Payments table */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase bg-zinc-900/20">
                        <th className="p-4">Customer Name</th>
                        <th className="p-4">Payment Date</th>
                        <th className="p-4">Payment Method</th>
                        <th className="p-4">Linked Invoice</th>
                        <th className="p-4 text-right">Amount Credited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {reportData.payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-zinc-800/10 transition">
                          <td className="p-4 font-semibold text-zinc-300">{p.customerName}</td>
                          <td className="p-4 text-xs text-zinc-450">
                            {new Date(p.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-4 text-xs font-bold text-zinc-400 uppercase">{p.method}</td>
                          <td className="p-4 font-mono text-xs text-zinc-500">{p.invoiceNumber}</td>
                          <td className="p-4 text-right font-black text-emerald-450 text-emerald-400">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Tax tab content */}
            {activeTab === 'tax' && (
              <>
                {/* Tax grouping report */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase bg-zinc-900/20">
                        <th className="p-4">GST Rate Bracket</th>
                        <th className="p-4 text-right">Billed Taxable Value</th>
                        <th className="p-4 text-right">CGST Collected</th>
                        <th className="p-4 text-right">SGST Collected</th>
                        <th className="p-4 text-right">Total Tax Amount</th>
                        <th className="p-4 text-right">Total Billed Sum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {reportData.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-zinc-800/10 transition">
                          <td className="p-4 font-bold text-white text-sm">{t.taxRate}% Bracket</td>
                          <td className="p-4 text-right text-zinc-350">{formatCurrency(t.taxableValue)}</td>
                          <td className="p-4 text-right text-zinc-500">{formatCurrency(t.cgst)}</td>
                          <td className="p-4 text-right text-zinc-500">{formatCurrency(t.sgst)}</td>
                          <td className="p-4 text-right text-emerald-400 font-bold">{formatCurrency(t.taxAmount)}</td>
                          <td className="p-4 text-right font-black text-white">{formatCurrency(t.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Customer tab content */}
            {activeTab === 'customers' && (
              <>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-bold uppercase bg-zinc-900/20">
                        <th className="p-4">Customer Name</th>
                        <th className="p-4">Phone / GSTIN</th>
                        <th className="p-4 text-center">Billed Invoices</th>
                        <th className="p-4 text-center">Pending Payments</th>
                        <th className="p-4 text-right">Current Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {reportData.map((c: any) => (
                        <tr key={c.id} className="hover:bg-zinc-800/10 transition">
                          <td className="p-4 font-semibold text-zinc-200">{c.name}</td>
                          <td className="p-4 text-xs">
                            <div className="text-zinc-300">{c.phone || '-'}</div>
                            {c.gstin && <div className="text-[10px] text-zinc-500 uppercase mt-0.5">GST: {c.gstin}</div>}
                          </td>
                          <td className="p-4 text-center text-zinc-400">{c.totalInvoicesCount}</td>
                          <td className="p-4 text-center font-bold text-yellow-400">{c.unpaidInvoicesCount} invoices</td>
                          <td className={`p-4 text-right font-bold ${c.outstandingBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatCurrency(c.outstandingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-24 text-center text-zinc-500 text-sm">
            Select dates or change tab to initialize financial query calculations.
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
