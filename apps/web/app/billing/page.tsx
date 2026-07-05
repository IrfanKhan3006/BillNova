'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
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
import { QRCodeSVG } from 'qrcode.react';

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
  hsnCode?: string;
}

interface InvoiceItemInput {
  productId?: string;
  name: string;
  qty: number | string;
  price: number | string;
  taxRate: number | string;
  hsnCode?: string;
}

export default function BillingPage() {
  const { user, updateUserTenant } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Selection states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Items array
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { name: '', qty: 1, price: 0, taxRate: 0, hsnCode: '' },
  ]);

  const [showExtraFields, setShowExtraFields] = useState(false);
  const [extraFields, setExtraFields] = useState({
    irn: '',
    ackNo: '',
    ackDate: '',
    consigneeName: '',
    consigneeAddress: '',
    consigneeGstin: '',
    consigneeState: '',
    deliveryNote: '',
    deliveryNoteDate: '',
    paymentTerms: '',
    supplierRef: '',
    otherReferences: '',
    buyersOrderNo: '',
    buyersOrderDate: '',
    despatchDocNo: '',
    despatchedThrough: '',
    destination: '',
    termsOfDelivery: '',
  });

  const [customBusinessName, setCustomBusinessName] = useState('');
  const [customBusinessAddress, setCustomBusinessAddress] = useState('');
  const [customBusinessPhone, setCustomBusinessPhone] = useState('');
  const [customBusinessGstin, setCustomBusinessGstin] = useState('');
  const [customLogoUrlPreview, setCustomLogoUrlPreview] = useState('');
  const [customHeaderUrlPreview, setCustomHeaderUrlPreview] = useState('');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomLogoUrlPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleHeaderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomHeaderUrlPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExtraFieldsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExtraFields((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);

  // Quick Add Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [activeProductItemIndex, setActiveProductItemIndex] = useState<number | null>(null);
  
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
  });
  const [custGstLoading, setCustGstLoading] = useState(false);
  const [custSaving, setCustSaving] = useState(false);

  const [prodForm, setProdForm] = useState({
    name: '',
    salesPrice: 0,
    purchasePrice: 0,
    taxRate: 0,
    unit: 'PCS',
    stock: 0,
    hsnCode: '',
  });
  const [prodSaving, setProdSaving] = useState(false);

  // Quick Add Customer Handler
  const handleSaveCustomer = async () => {
    if (!custForm.name.trim()) {
      alert('Customer Name is required!');
      return;
    }
    try {
      setCustSaving(true);
      const res = await api.post('/customers', custForm);
      setCustomers((prev) => [...prev, res]);
      setSelectedCustomerId(res.id);
      setShowCustomerModal(false);
      setCustForm({ name: '', phone: '', email: '', address: '', gstin: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to create customer.');
    } finally {
      setCustSaving(false);
    }
  };

  // Quick Add Customer GST Fetch
  const handleCustGstSearch = async () => {
    if (!custForm.gstin || custForm.gstin.trim().length !== 15) {
      alert('Please enter a valid 15-character GSTIN!');
      return;
    }
    try {
      setCustGstLoading(true);
      const res = await api.get(`/business/gst-fetch/${custForm.gstin.trim()}`);
      setCustForm((prev) => ({
        ...prev,
        name: res.name || prev.name,
        address: res.address || prev.address,
        email: res.email || prev.email,
        phone: res.phone || prev.phone,
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to fetch GSTIN details.');
    } finally {
      setCustGstLoading(false);
    }
  };

  // Quick Add Product Handler
  const handleSaveProduct = async () => {
    if (!prodForm.name.trim()) {
      alert('Product Name is required!');
      return;
    }
    try {
      setProdSaving(true);
      const res = await api.post('/products', prodForm);
      setProducts((prev) => [...prev, res]);

      if (activeProductItemIndex !== null) {
        setItems((prev) => {
          const copy = [...prev];
          copy[activeProductItemIndex] = {
            productId: res.id,
            name: res.name,
            qty: 1,
            price: res.salesPrice,
            taxRate: res.taxRate,
            hsnCode: res.hsnCode || '',
          };
          return copy;
        });
      }

      setShowProductModal(false);
      setProdForm({
        name: '',
        salesPrice: 0,
        purchasePrice: 0,
        taxRate: 0,
        unit: 'PCS',
        stock: 0,
        hsnCode: '',
      });
      setActiveProductItemIndex(null);
    } catch (err: any) {
      alert(err.message || 'Failed to create product.');
    } finally {
      setProdSaving(false);
    }
  };
  // Template Select Modal States
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleSaveTemplate = async () => {
    try {
      setSavingTemplate(true);
      const res = await api.patch('/business', {
        invoiceTemplate: selectedTemplate,
      });
      updateUserTenant({
        invoiceTemplate: res.invoiceTemplate,
      });
      setShowTemplateModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  useEffect(() => {
    if (user?.tenant) {
      setCustomBusinessName(user.tenant.name || '');
      setCustomBusinessAddress(user.tenant.address || '');
      setCustomBusinessPhone(user.tenant.phone || '');
      setCustomBusinessGstin(user.tenant.gstin || '');
    }
  }, [user]);


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

        // Check for invoiceId in search params
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const invoiceId = urlParams.get('invoiceId');
          if (invoiceId) {
            const fullInvoice = await api.get(`/invoices/${invoiceId}`);
            setCreatedInvoice(fullInvoice);
          }
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
        hsnCode: prod.hsnCode || '',
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
      { name: '', qty: 1, price: 0, taxRate: 0, hsnCode: '' },
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

    items.forEach((item) => {
      const price = parseFloat(item.price as string) || 0;
      const qty = parseFloat(item.qty as string) || 0;
      const taxRate = parseFloat(item.taxRate as string) || 0;

      const itemSubTotal = price * qty;
      const itemTaxAmount = itemSubTotal * (taxRate / 100);

      subTotal += itemSubTotal;
      taxAmount += itemTaxAmount;
    });

    const totalAmount = subTotal + taxAmount;

    return {
      subTotal,
      taxAmount,
      discountAmount: 0,
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
      const cleanedExtra = Object.entries(extraFields).reduce((acc, [key, val]) => {
        acc[key] = val.trim() === '' ? null : val;
        return acc;
      }, {} as any);

      const res = await api.post('/invoices', {
        customerId: selectedCustomerId,
        items: filteredItems,
        date,
        notes,
        status: 'SENT',
        ...cleanedExtra,
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
    setItems([{ name: '', qty: 1, price: 0, taxRate: 0, hsnCode: '' }]);
    setExtraFields({
      irn: '',
      ackNo: '',
      ackDate: '',
      consigneeName: '',
      consigneeAddress: '',
      consigneeGstin: '',
      consigneeState: '',
      deliveryNote: '',
      deliveryNoteDate: '',
      paymentTerms: '',
      supplierRef: '',
      otherReferences: '',
      buyersOrderNo: '',
      buyersOrderDate: '',
      despatchDocNo: '',
      despatchedThrough: '',
      destination: '',
      termsOfDelivery: '',
    });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
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

  const renderTemplateModal = () => {
    if (!showTemplateModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl relative">
          <button
            onClick={() => setShowTemplateModal(false)}
            className="absolute right-4 top-4 p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
          <h3 className="text-xl font-extrabold text-white mb-1">Select Invoice Template</h3>
          <p className="text-zinc-400 text-xs mb-6">Choose a template style to instantly customize your print invoice layout.</p>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {/* Classic Template Card */}
            <button
              type="button"
              onClick={() => setSelectedTemplate('CLASSIC')}
              className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between h-48 ${selectedTemplate === 'CLASSIC' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-white">Classic Minimal</span>
                  {selectedTemplate === 'CLASSIC' && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                </div>
                <span className="text-[11px] text-zinc-400 leading-relaxed block">Clean, traditional corporate look with monochrome lines and margins.</span>
              </div>
              {/* Visual Preview Swatch */}
              <div className="w-full h-12 rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 flex flex-col justify-between gap-1 mt-3">
                <div className="h-1.5 w-1/2 bg-zinc-700 rounded-sm" />
                <div className="h-1 w-full bg-zinc-850 rounded-sm" />
                <div className="flex justify-between items-center mt-1">
                  <div className="h-1 w-1/4 bg-zinc-800 rounded-sm" />
                  <div className="h-2 w-8 bg-zinc-700 rounded-sm" />
                </div>
              </div>
            </button>

            {/* Modern Emerald Template Card */}
            <button
              type="button"
              onClick={() => setSelectedTemplate('MODERN_EMERALD')}
              className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between h-48 ${selectedTemplate === 'MODERN_EMERALD' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-white">Modern Emerald</span>
                  {selectedTemplate === 'MODERN_EMERALD' && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                </div>
                <span className="text-[11px] text-zinc-400 leading-relaxed block">Solid emerald header block, custom badge styling, and vibrant green details.</span>
              </div>
              {/* Visual Preview Swatch */}
              <div className="w-full h-12 rounded-lg bg-emerald-950/40 border border-emerald-900/30 p-1.5 flex flex-col justify-between gap-1 mt-3">
                <div className="h-2 w-full bg-emerald-600 rounded-sm" />
                <div className="h-1 w-full bg-zinc-800 rounded-sm" />
                <div className="flex justify-between items-center mt-1">
                  <div className="h-1.5 w-1/3 bg-emerald-500/40 rounded-sm" />
                  <div className="h-2 w-8 bg-emerald-500 rounded-sm" />
                </div>
              </div>
            </button>

            {/* Elegant Blue Template Card */}
            <button
              type="button"
              onClick={() => setSelectedTemplate('ELEGANT_BLUE')}
              className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between h-48 ${selectedTemplate === 'ELEGANT_BLUE' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-white">Elegant Navy</span>
                  {selectedTemplate === 'ELEGANT_BLUE' && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                </div>
                <span className="text-[11px] text-zinc-400 leading-relaxed block">Deep slate header, navy borders, and clear information boxes.</span>
              </div>
              {/* Visual Preview Swatch */}
              <div className="w-full h-12 rounded-lg bg-slate-950/60 border border-slate-800 p-1.5 flex flex-col justify-between gap-1 mt-3">
                <div className="h-2 w-full bg-slate-800 rounded-sm" />
                <div className="h-1 w-full bg-zinc-800 rounded-sm" />
                <div className="flex justify-between items-center mt-1">
                  <div className="h-1.5 w-1/3 bg-blue-500/40 rounded-sm" />
                  <div className="h-2 w-8 bg-blue-500 rounded-sm" />
                </div>
              </div>
            </button>

            {/* Custom Banner/Letterhead Template Card */}
            <button
              type="button"
              onClick={() => setSelectedTemplate('CUSTOM_HEADER')}
              className={`group text-left p-4 rounded-xl border transition flex flex-col justify-between h-48 ${selectedTemplate === 'CUSTOM_HEADER' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'}`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-white">Custom Header</span>
                  {selectedTemplate === 'CUSTOM_HEADER' && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                </div>
                <span className="text-[11px] text-zinc-400 leading-relaxed block">Fully customizable letterhead. Edit company details or logo inline on the bill page.</span>
              </div>
              {/* Visual Preview Swatch */}
              <div className="w-full h-12 rounded-lg bg-zinc-950/60 border border-dashed border-zinc-750 p-1.5 flex flex-col justify-between mt-3">
                <div className="h-2 w-3/4 border border-dashed border-zinc-700 rounded-sm bg-zinc-900" />
                <div className="h-1 w-full bg-zinc-800 rounded-sm" />
                <div className="flex justify-between items-center">
                  <div className="h-1 w-1/2 bg-zinc-800 rounded-sm" />
                  <div className="h-2 w-6 bg-zinc-700 rounded-sm" />
                </div>
              </div>
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setShowTemplateModal(false)}
              className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-xs font-semibold text-white border border-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition disabled:opacity-50"
            >
              {savingTemplate ? 'Saving...' : 'Apply Template'}
            </button>
          </div>
        </div>
      </div>
    );
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
        <FeatureGate featureKey="billingEnabled" featureName="Billing Engine">
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
                type="button"
                onClick={() => {
                  setSelectedTemplate((user as any)?.tenant?.invoiceTemplate || 'CLASSIC');
                  setShowTemplateModal(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white border border-zinc-700"
              >
                <Sparkles className="h-4 w-4 text-emerald-450" />
                <span>Change Template</span>
              </button>
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
        {(() => {
          const activeTemplate = (user as any)?.tenant?.invoiceTemplate || 'CLASSIC';
          const isEmerald = activeTemplate === 'MODERN_EMERALD';
          const isBlue = activeTemplate === 'ELEGANT_BLUE';
          
          return (
            <div className={`print-invoice-sheet bg-white text-zinc-900 p-8 rounded-2xl border max-w-4xl mx-auto mt-6 shadow-md ${isEmerald ? 'border-emerald-300' : isBlue ? 'border-blue-300' : 'border-zinc-300'}`}>
              {/* e-Invoice Bar */}
              {(createdInvoice.irn || createdInvoice.ackNo) && (
                <div className="flex justify-between items-start border-b border-zinc-200 pb-4 mb-4 text-[10px] text-zinc-650">
                  <div className="space-y-1">
                    {createdInvoice.irn && (
                      <p><span className="font-bold text-zinc-800">IRN:</span> <span className="font-mono break-all text-zinc-900 font-semibold">{createdInvoice.irn}</span></p>
                    )}
                    <div className="flex gap-4">
                      {createdInvoice.ackNo && (
                        <p><span className="font-bold text-zinc-800">Ack No.:</span> <span className="text-zinc-900 font-semibold">{createdInvoice.ackNo}</span></p>
                      )}
                      {createdInvoice.ackDate && (
                        <p><span className="font-bold text-zinc-800">Ack Date:</span> <span className="text-zinc-900 font-semibold">{new Date(createdInvoice.ackDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center shrink-0 border border-zinc-200 p-1.5 rounded-lg bg-zinc-50">
                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-wider mb-1">e-Invoice</span>
                    <QRCodeSVG
                      value={createdInvoice.irn || `ACK-${createdInvoice.ackNo}`}
                      size={50}
                      level="L"
                      marginSize={0}
                    />
                  </div>
                </div>
              )}

              {/* Header */}
              {activeTemplate === 'CUSTOM_HEADER' ? (
                <div className="-mx-8 -mt-8 mb-6 border-b border-zinc-200 p-6 bg-zinc-50/50 print:bg-transparent print:p-0 print:border-none">
                  {customHeaderUrlPreview || user?.tenant?.customHeaderUrl ? (
                    <div className="relative">
                      <img
                        src={customHeaderUrlPreview || user?.tenant?.customHeaderUrl}
                        alt="Custom Header"
                        className="w-full h-auto object-cover max-h-[140px]"
                      />
                      {/* Live input only visible in screen view */}
                      <div className="mt-2 flex gap-2 print:hidden items-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleHeaderUpload}
                          className="hidden"
                          id="header-file-upload-preview"
                        />
                        <label
                          htmlFor="header-file-upload-preview"
                          className="flex items-center gap-1 px-3 py-1.5 border border-zinc-350 bg-white text-zinc-700 text-xs rounded font-semibold cursor-pointer hover:bg-zinc-50 shrink-0"
                        >
                          Upload New Banner
                        </label>
                        <input
                          type="text"
                          className="text-[10px] w-full px-2 py-1.5 border border-zinc-300 bg-white rounded"
                          placeholder="Or paste banner image URL..."
                          value={customHeaderUrlPreview}
                          onChange={(e) => setCustomHeaderUrlPreview(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="print:hidden bg-emerald-50/70 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs mb-4">
                        💡 <strong>Custom Header:</strong> Upload image files or type company details directly below (dashed borders hide when printing).
                      </div>
                      
                      <div className="print:hidden grid gap-3 grid-cols-2 mb-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-550 block uppercase tracking-wider">Image Banner (Upload or URL)</label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleHeaderUpload}
                              className="hidden"
                              id="header-file-upload"
                            />
                            <label
                              htmlFor="header-file-upload"
                              className="flex items-center justify-center gap-1 px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 text-xs rounded font-semibold cursor-pointer hover:bg-zinc-50 shrink-0"
                            >
                              Upload File
                            </label>
                            <input
                              type="text"
                              className="text-xs w-full px-2.5 py-1.5 border border-zinc-200 bg-zinc-50 text-zinc-900 rounded focus:border-emerald-500 focus:bg-white focus:outline-none"
                              placeholder="Or paste URL..."
                              value={customHeaderUrlPreview}
                              onChange={(e) => setCustomHeaderUrlPreview(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-550 block uppercase tracking-wider">Logo Image (Upload or URL)</label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                              id="logo-file-upload"
                            />
                            <label
                              htmlFor="logo-file-upload"
                              className="flex items-center justify-center gap-1 px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 text-xs rounded font-semibold cursor-pointer hover:bg-zinc-50 shrink-0"
                            >
                              Upload File
                            </label>
                            <input
                              type="text"
                              className="text-xs w-full px-2.5 py-1.5 border border-zinc-200 bg-zinc-50 text-zinc-900 rounded focus:border-emerald-500 focus:bg-white focus:outline-none"
                              placeholder="Or paste URL..."
                              value={customLogoUrlPreview}
                              onChange={(e) => setCustomLogoUrlPreview(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        {(customLogoUrlPreview || user?.tenant?.logoUrl) && (
                          <img
                            src={customLogoUrlPreview || user?.tenant?.logoUrl}
                            alt="Logo"
                            className="h-16 w-16 rounded-xl object-contain border border-zinc-250 bg-white p-1 shrink-0"
                          />
                        )}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          {/* Screen Inputs */}
                          <div className="print:hidden space-y-2">
                            <input
                              type="text"
                              className="w-full text-xl font-black uppercase text-zinc-900 border-b border-dashed border-zinc-300 focus:border-emerald-500 focus:outline-none bg-transparent"
                              placeholder="Business/Company Name *"
                              value={customBusinessName}
                              onChange={(e) => setCustomBusinessName(e.target.value)}
                            />
                            <textarea
                              className="w-full text-xs text-zinc-600 border-b border-dashed border-zinc-300 focus:border-emerald-500 focus:outline-none bg-transparent resize-none"
                              rows={2}
                              placeholder="Business Address Details..."
                              value={customBusinessAddress}
                              onChange={(e) => setCustomBusinessAddress(e.target.value)}
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                              <input
                                type="text"
                                className="text-xs text-zinc-600 border-b border-dashed border-zinc-300 focus:border-emerald-500 focus:outline-none bg-transparent"
                                placeholder="Contact Number (Phone)"
                                value={customBusinessPhone}
                                onChange={(e) => setCustomBusinessPhone(e.target.value)}
                              />
                              <input
                                type="text"
                                className="text-xs font-bold text-zinc-800 border-b border-dashed border-zinc-300 focus:border-emerald-500 focus:outline-none bg-transparent uppercase"
                                placeholder="GSTIN (e.g. 06HSCPK1608B1Z9)"
                                value={customBusinessGstin}
                                onChange={(e) => setCustomBusinessGstin(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Print Mode Texts */}
                          <div className="hidden print:block">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">
                              {customBusinessName || user?.tenant?.name || 'Business Name'}
                            </h2>
                            {(customBusinessAddress || user?.tenant?.address) && (
                              <p className="text-xs text-zinc-550 mt-1 max-w-sm whitespace-pre-line leading-relaxed">
                                {customBusinessAddress || user?.tenant?.address}
                              </p>
                            )}
                            {(customBusinessPhone || user?.tenant?.phone) && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Phone: {customBusinessPhone || user?.tenant?.phone}
                              </p>
                            )}
                            {(customBusinessGstin || user?.tenant?.gstin) && (
                              <p className="text-xs font-bold mt-1 text-zinc-650">
                                GSTIN: <span className="uppercase">{customBusinessGstin || user?.tenant?.gstin}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : user?.tenant?.customHeaderUrl ? (
                <div className="-mx-8 -mt-8 mb-6 border-b border-zinc-200 overflow-hidden rounded-t-2xl">
                  <img
                    src={user.tenant.customHeaderUrl}
                    alt="Custom Header"
                    className="w-full h-auto object-cover max-h-[140px]"
                  />
                </div>
              ) : (
                <div className={
                  isEmerald
                    ? "flex justify-between items-center bg-emerald-600 text-white p-6 -mx-8 -mt-8 rounded-t-2xl border-b border-emerald-700"
                    : isBlue
                    ? "flex justify-between items-center bg-slate-900 text-white p-6 -mx-8 -mt-8 rounded-t-2xl border-b border-slate-800"
                    : "flex justify-between items-start border-b border-zinc-200 pb-6"
                }>
                  <div className="flex items-start gap-4">
                    {user?.tenant?.logoUrl && (
                      <img
                        src={user.tenant.logoUrl}
                        alt="Business Logo"
                        className={`h-16 w-16 rounded-xl object-contain border p-1 shrink-0 ${isEmerald ? 'border-emerald-500/30 bg-white' : isBlue ? 'border-slate-700 bg-white' : 'border-zinc-200/80 bg-zinc-50'}`}
                      />
                    )}
                    <div>
                      <h2 className={`text-2xl font-black tracking-tight uppercase ${isEmerald || isBlue ? 'text-white' : 'text-zinc-950'}`}>{user?.tenant?.name}</h2>
                      {user?.tenant?.address && <p className={`text-xs mt-1 max-w-sm whitespace-pre-line ${isEmerald ? 'text-emerald-100' : isBlue ? 'text-slate-350' : 'text-zinc-550'}`}>{user.tenant.address}</p>}
                      {user?.tenant?.phone && <p className={`text-xs mt-0.5 ${isEmerald ? 'text-emerald-200' : isBlue ? 'text-slate-400' : 'text-zinc-500'}`}>Phone: {user.tenant.phone}</p>}
                      {user?.tenant?.gstin && (
                        <p className={`text-xs font-bold mt-1 ${isEmerald ? 'bg-emerald-750 text-white px-2 py-0.5 rounded inline-block text-[10px]' : isBlue ? 'bg-slate-800 text-emerald-450 px-2 py-0.5 rounded inline-block text-[10px]' : 'text-zinc-650 text-emerald-750'}`}>
                          GSTIN: <span className="uppercase">{user.tenant.gstin}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Client & Invoice Info Grid */}
              <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs border-b border-zinc-200 pb-6">
                {/* Bill To */}
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Bill To (Buyer)</h4>
                  <p className="font-bold text-zinc-900 text-sm mt-1">{cust.name}</p>
                  {cust.address && <p className="text-xs text-zinc-500 mt-0.5 whitespace-pre-line leading-relaxed">{cust.address}</p>}
                  {cust.phone && <p className="text-xs text-zinc-500 mt-0.5">Phone: {cust.phone}</p>}
                  {cust.gstin && (
                    <p className={`text-xs font-bold mt-1 text-emerald-700`}>
                      GSTIN/UIN: <span className="uppercase">{cust.gstin}</span>
                    </p>
                  )}
                </div>

                {/* Ship To (Consignee) */}
                <div>
                  {createdInvoice.consigneeName ? (
                    <>
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ship To (Consignee)</h4>
                      <p className="font-bold text-zinc-900 text-sm mt-1">{createdInvoice.consigneeName}</p>
                      {createdInvoice.consigneeAddress && <p className="text-xs text-zinc-500 mt-0.5 whitespace-pre-line leading-relaxed">{createdInvoice.consigneeAddress}</p>}
                      {createdInvoice.consigneeGstin && (
                        <p className="text-xs font-bold mt-1 text-zinc-700">
                          GSTIN/UIN: <span className="uppercase">{createdInvoice.consigneeGstin}</span>
                        </p>
                      )}
                      {createdInvoice.consigneeState && (
                        <p className="text-xs text-zinc-500 mt-0.5">State: {createdInvoice.consigneeState}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ship To (Consignee)</h4>
                      <p className="text-[10px] text-zinc-400 italic mt-2">Same as Buyer (Bill To)</p>
                    </>
                  )}
                </div>

                {/* Tax Invoice Info */}
                <div className="text-right flex flex-col justify-start items-end">
                  <h3 className={`text-xl font-bold tracking-wider uppercase ${isEmerald ? 'text-emerald-700 font-extrabold' : isBlue ? 'text-slate-900 font-extrabold' : 'text-zinc-950 font-black'}`}>
                    TAX INVOICE
                  </h3>
                  <div className="mt-2 text-xs space-y-1 text-zinc-650">
                    <p>Invoice No: <span className="font-mono font-bold text-zinc-900">{createdInvoice.invoiceNumber}</span></p>
                    <p>Date: <span className="font-medium text-zinc-900">{new Date(createdInvoice.date).toLocaleDateString('en-IN')}</span></p>
                    <p>Due Date: <span className="font-medium text-zinc-900">{new Date(createdInvoice.dueDate).toLocaleDateString('en-IN')}</span></p>
                  </div>
                </div>
              </div>

              {/* Transport & Order Details Box */}
              {(createdInvoice.deliveryNote || createdInvoice.buyersOrderNo || createdInvoice.despatchDocNo || createdInvoice.termsOfDelivery) && (
                <div className="border border-zinc-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 text-[10px] text-zinc-600 mb-6 overflow-hidden divide-x divide-y divide-zinc-200">
                  <div className="p-2 min-w-0">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Delivery Note</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.deliveryNote || '-'}</span>
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Mode/Terms of Payment</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.paymentTerms || '-'}</span>
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Buyer's Order No.</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.buyersOrderNo || '-'}</span>
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Despatch Doc No.</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.despatchDocNo || '-'}</span>
                  </div>
                  <div className="p-2 min-w-0 border-t border-zinc-200">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Despatched Through</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.despatchedThrough || '-'}</span>
                  </div>
                  <div className="p-2 min-w-0 border-t border-zinc-200">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Destination</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.destination || '-'}</span>
                  </div>
                  <div className="p-2 min-w-0 border-t border-zinc-200 col-span-2">
                    <span className="font-bold text-zinc-400 block uppercase tracking-wider text-[8px]">Terms of Delivery</span>
                    <span className="text-zinc-800 font-medium truncate block">{createdInvoice.termsOfDelivery || '-'}</span>
                  </div>
                </div>
              )}

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse mt-4">
                <thead>
                  <tr className={`uppercase font-bold border-t border-b ${isEmerald ? 'bg-emerald-50 text-emerald-950 border-emerald-200' : isBlue ? 'bg-slate-100 text-slate-850 border-slate-300' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2">Item Description</th>
                    <th className="py-2.5 px-2 text-center w-24">HSN/SAC</th>
                    <th className="py-2.5 px-2 text-right">Price</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-2 text-right">GST %</th>
                    <th className="py-2.5 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {createdInvoice.items.map((item: any, idx: number) => (
                    <tr key={item.id} className="border-b border-zinc-200/60">
                      <td className="py-3 px-2 text-zinc-400">{idx + 1}</td>
                      <td className="py-3 px-2 font-bold text-zinc-900">{item.name}</td>
                      <td className="py-3 px-2 text-center font-semibold font-mono text-zinc-600">{item.hsnCode || '-'}</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(item.price)}</td>
                      <td className="py-3 px-2 text-center font-semibold">{item.qty}</td>
                      <td className="py-3 px-2 text-right">{item.taxRate}%</td>
                      <td className="py-3 px-2 text-right font-bold text-zinc-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Payment Details & Summary Calculations */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mt-6 border-t border-zinc-200 pt-6">
                {/* Left side: Payment Info & UPI QR Code */}
                <div className="flex-1 space-y-4 text-xs min-w-[260px] w-full">
                  {((user as any)?.tenant?.bankAccountName || (user as any)?.tenant?.bankAccountNumber || (user as any)?.tenant?.bankIfsc) && (
                    <div>
                      <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isEmerald ? 'text-emerald-800' : isBlue ? 'text-blue-800' : 'text-zinc-500'}`}>Payment Bank Details</h4>
                      <div className="space-y-1 text-zinc-700">
                        {(user as any)?.tenant?.bankAccountName && (
                          <p><span className="font-semibold text-zinc-500">A/C Name:</span> {(user as any)?.tenant?.bankAccountName}</p>
                        )}
                        {(user as any)?.tenant?.bankAccountNumber && (
                          <p><span className="font-semibold text-zinc-500">A/C Number:</span> {(user as any)?.tenant?.bankAccountNumber}</p>
                        )}
                        {(user as any)?.tenant?.bankIfsc && (
                          <p><span className="font-semibold text-zinc-500">IFSC Code:</span> <span className="uppercase">{(user as any)?.tenant?.bankIfsc}</span></p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* QR Code Pay */}
                  {(user as any)?.tenant?.upiId && (
                    <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl max-w-sm">
                      <div className="bg-white p-1 rounded-lg border border-zinc-150 shrink-0">
                        {/* Generate UPI Pay QR Code */}
                        {(() => {
                          const upiId = (user as any)?.tenant?.upiId || '';
                          const businessName = user?.tenant?.name || '';
                          const totalAmt = createdInvoice.totalAmount;
                          // UPI URL structure: upi://pay?pa=upiId&pn=name&am=amount&cu=INR
                          const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${totalAmt}&cu=INR`;
                          return (
                            <QRCodeSVG
                              value={upiUrl}
                              size={80}
                              level="M"
                              marginSize={1}
                            />
                          );
                        })()}
                      </div>
                      <div>
                        <h5 className="font-bold text-zinc-800 text-[11px] uppercase tracking-wider">Scan & Pay</h5>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">Scan this QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) to make an instant payment.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Calculations */}
                <div className={`w-64 space-y-2 text-xs border-t sm:border-t-0 pt-4 sm:pt-0 shrink-0 ${isEmerald ? 'bg-emerald-50/30 p-4 rounded-xl border-emerald-100' : isBlue ? 'bg-slate-50 p-4 rounded-xl border-slate-200' : 'border-zinc-200'}`}>
                  <div className="flex justify-between text-zinc-550">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(createdInvoice.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-550 border-b border-zinc-200 pb-2">
                    <span>Tax Amount (GST):</span>
                    <span>{formatCurrency(createdInvoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-zinc-950 pt-1">
                    <span>Grand Total:</span>
                    <span className={isEmerald ? 'text-emerald-700 text-sm font-black' : isBlue ? 'text-blue-700 text-sm font-black' : ''}>{formatCurrency(createdInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* HSN/SAC Tax Summary Table */}
              {createdInvoice.items.some((item: any) => item.hsnCode) && (
                <div className="mt-8 border border-zinc-200 rounded-xl overflow-hidden text-[10px]">
                  <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 font-bold text-zinc-700 uppercase tracking-wider">HSN/SAC Tax Summary</div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 border-b border-zinc-200 text-zinc-500 font-bold">
                        <th className="p-2">HSN/SAC</th>
                        <th className="p-2 text-right">Taxable Value</th>
                        <th className="p-2 text-center">CGST Rate</th>
                        <th className="p-2 text-right">CGST Amount</th>
                        <th className="p-2 text-center">SGST Rate</th>
                        <th className="p-2 text-right">SGST Amount</th>
                        <th className="p-2 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const groups: Record<string, { taxable: number; taxRate: number; taxAmt: number }> = {};
                        createdInvoice.items.forEach((item: any) => {
                          const hsn = item.hsnCode || 'N/A';
                          const qty = item.qty || 1;
                          const price = item.price || 0;
                          const discRate = item.discountRate || 0;
                          const taxable = (price * (1 - discRate / 100)) * qty;
                          const taxRate = item.taxRate || 0;
                          const taxAmt = taxable * (taxRate / 100);

                          if (!groups[hsn]) {
                            groups[hsn] = { taxable: 0, taxRate, taxAmt: 0 };
                          }
                          groups[hsn].taxable += taxable;
                          groups[hsn].taxAmt += taxAmt;
                        });

                        return Object.entries(groups).map(([hsn, data]) => {
                          const halfRate = data.taxRate / 2;
                          const halfAmt = data.taxAmt / 2;
                          return (
                            <tr key={hsn} className="border-b border-zinc-200 last:border-0 text-zinc-700">
                              <td className="p-2 font-bold font-mono">{hsn}</td>
                              <td className="p-2 text-right">{formatCurrency(data.taxable)}</td>
                              <td className="p-2 text-center">{halfRate}%</td>
                              <td className="p-2 text-right">{formatCurrency(halfAmt)}</td>
                              <td className="p-2 text-center">{halfRate}%</td>
                              <td className="p-2 text-right">{formatCurrency(halfAmt)}</td>
                              <td className="p-2 text-right font-bold">{formatCurrency(data.taxAmt)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              {createdInvoice.notes && (
                <div className="border-t border-zinc-150 mt-8 pt-4">
                  <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Notes & Terms</h5>
                  <p className="text-xs text-zinc-600 mt-1 whitespace-pre-line leading-relaxed">{createdInvoice.notes}</p>
                </div>
              )}

              {/* Footer signature and GST/PAN info */}
              <div className="flex justify-between items-end mt-12 pt-6 border-t border-zinc-100 text-[10px] text-zinc-450">
                <div className="space-y-1">
                  <p className="text-zinc-400">Software Powered by BillNova ERP</p>
                  {user?.tenant?.gstin && <p><span className="font-semibold">Company's GST No.:</span> <span className="uppercase">{user.tenant.gstin}</span></p>}
                  {user?.tenant?.gstin && user.tenant.gstin.length === 15 && (
                    <p><span className="font-semibold">Company's PAN:</span> <span className="uppercase">{user.tenant.gstin.substring(2, 12)}</span></p>
                  )}
                </div>
                <div className="text-center w-48 border-t border-zinc-350 pt-2">
                  <p className="font-bold text-zinc-700 uppercase tracking-wider">Authorized Signatory</p>
                </div>
              </div>
            </div>
          );
        })()}
        </FeatureGate>
        {renderTemplateModal()}
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <FeatureGate featureKey="billingEnabled" featureName="Billing Engine">
        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-emerald-500" />
              <span>Billing Engine</span>
            </h1>
            <p className="mt-1 text-zinc-400 text-sm">Generate multi-tenant, GST-compliant tax invoices in real-time.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedTemplate((user as any)?.tenant?.invoiceTemplate || 'CLASSIC');
              setShowTemplateModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white transition self-start sm:self-center"
          >
            <Sparkles className="h-4 w-4 text-emerald-450" />
            <span>Select Active Template</span>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
              {/* Customer Selector & Date */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">Select Customer *</label>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition animate-pulse"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Customer</span>
                    </button>
                  </div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="mt-2 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Customer --</option>
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
                    <div className="sm:col-span-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Select Product</label>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProductItemIndex(idx);
                            setShowProductModal(true);
                          }}
                          className="text-[10px] text-emerald-450 hover:text-emerald-400 font-bold flex items-center transition"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          <span>Quick Add</span>
                        </button>
                      </div>
                      <select
                        value={item.productId || ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-855 bg-zinc-955 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Item Label</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none"
                        placeholder="Label"
                      />
                    </div>

                    {/* HSN/SAC */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">HSN/SAC</label>
                      <input
                        type="text"
                        value={item.hsnCode || ''}
                        onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-955 px-2 py-2 text-xs text-white focus:outline-none text-center"
                        placeholder="HSN"
                      />
                    </div>

                    {/* Price */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Price</label>
                      <input
                        type="text"
                        value={item.price}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) return;
                          handleItemChange(idx, 'price', val);
                        }}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {/* Qty */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Qty</label>
                      <input
                        type="text"
                        value={item.qty}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          handleItemChange(idx, 'qty', val);
                        }}
                        className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none text-center"
                      />
                    </div>

                    {/* Tax % */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Tax%</label>
                      <input
                        type="text"
                        value={item.taxRate}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) return;
                          handleItemChange(idx, 'taxRate', val);
                        }}
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

              {/* Additional Invoice Details */}
              <div className="border border-zinc-800 bg-zinc-950/40 rounded-xl overflow-hidden mt-6">
                <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Additional GST, Shipping & e-Invoice Details (Optional)</h3>
                </div>

                <div className="p-5 space-y-6 bg-zinc-950/20">
                  {/* Consignee */}
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Consignee Details (Ship To)</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Consignee Name</label>
                        <input
                          type="text"
                          name="consigneeName"
                          value={extraFields.consigneeName}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. AALA PRINT HUB"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Consignee GSTIN</label>
                        <input
                          type="text"
                          name="consigneeGstin"
                          value={extraFields.consigneeGstin}
                          onChange={handleExtraFieldsChange}
                          maxLength={15}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500 uppercase"
                          placeholder="e.g. 06HSCPK1608B1Z9"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Consignee State / Code</label>
                        <input
                          type="text"
                          name="consigneeState"
                          value={extraFields.consigneeState}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. Haryana (Code: 06)"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Consignee Address</label>
                        <input
                          type="text"
                          name="consigneeAddress"
                          value={extraFields.consigneeAddress}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="Shipping Address"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dispatch & Delivery Info */}
                  <div className="border-t border-zinc-850 pt-4">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Dispatch & Delivery details</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Delivery Note</label>
                        <input
                          type="text"
                          name="deliveryNote"
                          value={extraFields.deliveryNote}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="Delivery Note/Terms"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Mode/Terms of Payment</label>
                        <input
                          type="text"
                          name="paymentTerms"
                          value={extraFields.paymentTerms}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. Cash / Bank Transfer"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Buyer Order No.</label>
                        <input
                          type="text"
                          name="buyersOrderNo"
                          value={extraFields.buyersOrderNo}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="Order Reference"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Despatch Doc No.</label>
                        <input
                          type="text"
                          name="despatchDocNo"
                          value={extraFields.despatchDocNo}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="LR / Doc No."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Despatched through</label>
                        <input
                          type="text"
                          name="despatchedThrough"
                          value={extraFields.despatchedThrough}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. VRL Logistics"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Destination</label>
                        <input
                          type="text"
                          name="destination"
                          value={extraFields.destination}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. Faridabad"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Terms of Delivery</label>
                        <input
                          type="text"
                          name="termsOfDelivery"
                          value={extraFields.termsOfDelivery}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. Goods once sold will not be taken back."
                        />
                      </div>
                    </div>
                  </div>

                  {/* e-Invoice details */}
                  <div className="border-t border-zinc-850 pt-4">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">e-Invoice Metadata</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">IRN (Invoice Reference Number)</label>
                        <input
                          type="text"
                          name="irn"
                          value={extraFields.irn}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="64-char hex IRN string"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Ack No.</label>
                        <input
                          type="text"
                          name="ackNo"
                          value={extraFields.ackNo}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                          placeholder="Acknowledgement No."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 font-semibold uppercase">Ack Date</label>
                        <input
                          type="date"
                          name="ackDate"
                          value={extraFields.ackDate}
                          onChange={handleExtraFieldsChange}
                          className="mt-1.5 block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
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
      </FeatureGate>

      {/* Add Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCustomerModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Add New Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">GSTIN Number (Optional)</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={custForm.gstin}
                    onChange={(e) => setCustForm({ ...custForm, gstin: e.target.value })}
                    maxLength={15}
                    placeholder="e.g. 07AAAAA1111A1Z1"
                    className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-650 focus:border-emerald-500 focus:outline-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleCustGstSearch}
                    disabled={custGstLoading}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-white border border-zinc-700 transition"
                  >
                    {custGstLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Customer Name *</label>
                <input
                  type="text"
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="e.g. Verma Enterprises"
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    value={custForm.phone}
                    onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={custForm.email}
                    onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="client@mail.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Address</label>
                <textarea
                  value={custForm.address}
                  onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                  rows={2}
                  className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="Full Address"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-xs font-semibold text-white border border-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomer}
                  disabled={custSaving}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition disabled:opacity-50"
                >
                  {custSaving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowProductModal(false);
                setActiveProductItemIndex(null);
              }}
              className="absolute right-4 top-4 p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Quick Add Product</h3>
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Product Name *</label>
                  <input
                    type="text"
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="e.g. Wireless Mouse"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">HSN/SAC Code</label>
                  <input
                    type="text"
                    value={prodForm.hsnCode}
                    onChange={(e) => setProdForm({ ...prodForm, hsnCode: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="e.g. 39199090"
                  />
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sales Price (INR) *</label>
                  <input
                    type="text"
                    value={prodForm.salesPrice}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) return;
                      setProdForm({ ...prodForm, salesPrice: val as any });
                    }}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">GST Rate (%)</label>
                  <select
                    value={prodForm.taxRate}
                    onChange={(e) => setProdForm({ ...prodForm, taxRate: parseFloat(e.target.value) || 0 })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Unit</label>
                  <select
                    value={prodForm.unit}
                    onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-805 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PCS">PCS</option>
                    <option value="BOX">BOX</option>
                    <option value="KG">KG</option>
                    <option value="LTR">LTR</option>
                    <option value="MTR">MTR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Stock Qty</label>
                  <input
                    type="text"
                    value={prodForm.stock}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setProdForm({ ...prodForm, stock: val as any });
                    }}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    setActiveProductItemIndex(null);
                  }}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-xs font-semibold text-white border border-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProduct}
                  disabled={prodSaving}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition disabled:opacity-50"
                >
                  {prodSaving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderTemplateModal()}
    </SidebarLayout>
  );
}
