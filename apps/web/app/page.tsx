'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from './store/authStore';
import {
  PlayCircle,
  ArrowRight,
  Trash2,
  Plus,
  Receipt,
  Zap,
  Users,
  Package,
  Printer,
  BarChart3,
  ShieldCheck,
  LayoutDashboard,
  CreditCard,
  Play,
  UserPlus,
  CheckCircle,
  Menu,
  ArrowUpRight,
  X,
  PlusCircle,
  FileText,
  Settings
} from 'lucide-react';
import './landing-page/landing.css';

interface InvoiceItem {
  id: number;
  name: string;
  qty: number;
  price: number;
  tax: number;
}

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  // 1. FAQ Accordion State
  const [faqActiveIndex, setFaqActiveIndex] = useState<number | null>(null);

  // 2. Simulator State
  const [customerName, setCustomerName] = useState('Acme Corporation');
  const [customerGstin, setCustomerGstin] = useState('27AADCB8350F1Z1');
  const [gstFetching, setGstFetching] = useState(false);
  const [gstButtonText, setGstButtonText] = useState('Auto Fill');

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, name: 'Cloud Hosting Infrastructure', qty: 1, price: 12000, tax: 18 },
    { id: 2, name: 'Consulting & Setup Fee', qty: 5, price: 1500, tax: 18 }
  ]);

  // 3. Generated Invoice Modal State
  const [modalActive, setModalActive] = useState(false);
  const [pdfInvoiceNumber, setPdfInvoiceNumber] = useState('');
  const [pdfDate, setPdfDate] = useState('');
  const [pdfDueDate, setPdfDueDate] = useState('');

  // 4. Calculate Totals
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const taxTotal = items.reduce((sum, item) => sum + (item.qty * item.price * (item.tax / 100)), 0);
  const discountAmount = subtotal * 0.10; // Fixed 10% discount in demo
  const grandTotal = (subtotal + taxTotal) - discountAmount;

  // Simulator actions
  const handleAddItemRow = () => {
    const nextId = items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    setItems([
      ...items,
      { id: nextId, name: `Software Suite License v${nextId}`, qty: 1, price: 2500, tax: 18 }
    ]);
  };

  const handleRemoveItemRow = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    } else {
      alert('Invoice must contain at least one item!');
    }
  };

  const handleItemChange = (id: number, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          [field]: field === 'name' ? value : parseFloat(value) || 0
        };
      }
      return item;
    }));
  };

  const handleGstFetch = () => {
    if (customerGstin.trim().length < 15) {
      alert('Please enter a valid 15-character GSTIN code first.');
      return;
    }

    setGstButtonText('Fetching...');
    setGstFetching(true);

    setTimeout(() => {
      setCustomerName('Tata Consultancy Services Ltd.');
      setCustomerGstin(customerGstin.toUpperCase());
      setGstButtonText('Success!');
      setGstFetching(false);
      
      setTimeout(() => {
        setGstButtonText('Auto Fill');
      }, 1500);

      alert(`GSTIN Details Resolved!\n\nEntity Name: Tata Consultancy Services Ltd.\nStatus: Active (Regular Taxpayer)\nState: Maharashtra`);
    }, 800);
  };

  const handleGenerateInvoice = () => {
    // Generate static invoice number and dates
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setPdfInvoiceNumber(`#INV-2026-${randNum}`);

    const today = new Date();
    const due = new Date();
    due.setDate(today.getDate() + 15);

    setPdfDate(today.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));
    setPdfDueDate(due.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));

    setModalActive(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleFaq = (index: number) => {
    if (faqActiveIndex === index) {
      setFaqActiveIndex(null);
    } else {
      setFaqActiveIndex(index);
    }
  };

  return (
    <div className="landing-page-root">
      {/* Ambient Glows */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="ambient-glow glow-3"></div>

      {/* Header Navigation */}
      <header>
        <div className="container nav-container">
          <Link href="/" className="logo">
            <div className="logo-box">B</div>
            <span className="logo-text">BillNova</span>
          </Link>
          
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#demo">Interactive Demo</a></li>
            <li><a href="#dashboard">Dashboard Preview</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>

          <div className="nav-actions">
            <a href="#demo" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Try Simulator</a>
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Go to Dashboard
              </Link>
            ) : (
              <Link href="/login" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Sign In
              </Link>
            )}
          </div>

          <button className="mobile-menu-btn" onClick={() => window.location.href = '#demo'}>
            <Menu style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            {/* Left: Copy & Value Proposition */}
            <div className="hero-info">
              <div className="hero-badge">
                <span></span> BillNova ERP v2.4 Now Live
              </div>
              
              <h1 className="hero-title gradient-text">
                Smart Invoicing & <br />
                <span className="emerald-text">ERP Redefined</span> <br />
                for Modern Business
              </h1>
              
              <p className="hero-description">
                Instantly lookup business details via GSTIN, track outstanding ledger balances, manage multi-unit inventory, and print beautiful receipts. Experience zero-friction bookkeeping.
              </p>

              <div className="hero-ctas">
                <a href="#demo" className="btn btn-primary">
                  Try Live Simulator <PlayCircle style={{ width: '18px', height: '18px' }} />
                </a>
                {isAuthenticated ? (
                  <Link href="/dashboard" className="btn btn-secondary">
                    Go to Dashboard <ArrowRight style={{ width: '18px', height: '18px' }} />
                  </Link>
                ) : (
                  <Link href="/login" className="btn btn-secondary">
                    Get Started Free <ArrowRight style={{ width: '18px', height: '18px' }} />
                  </Link>
                )}
              </div>

              <div className="hero-stats">
                <div className="stat-item">
                  <h3>99.9%</h3>
                  <p>Uptime SLA</p>
                </div>
                <div className="stat-item">
                  <h3>10x</h3>
                  <p>Faster Billing</p>
                </div>
                <div className="stat-item">
                  <h3>Zero</h3>
                  <p>GST Errors</p>
                </div>
              </div>
            </div>

            {/* Right: Interactive Invoice Simulator */}
            <div id="demo" className="glass-card simulator-widget">
              <div className="sim-header">
                <div className="sim-title">
                  <span className="sim-title-dot"></span> Live Billing Sandbox
                </div>
                <span className="sim-badge">Interactive Demo</span>
              </div>

              {/* Customer Detail Section */}
              <div className="sim-field-group">
                <div className="sim-field">
                  <label className="sim-label">Customer Name</label>
                  <input
                    type="text"
                    className="sim-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="sim-field">
                  <label className="sim-label">GSTIN (India)</label>
                  <div className="gstin-input-wrapper">
                    <input
                      type="text"
                      className="sim-input"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value)}
                    />
                    <button
                      type="button"
                      className="gst-fetch-btn"
                      onClick={handleGstFetch}
                      disabled={gstFetching}
                    >
                      {gstButtonText}
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="sim-items-section">
                <div className="sim-items-header">
                  <label className="sim-label">Invoice Items</label>
                </div>
                
                <div className="sim-items-list">
                  {items.map((item) => (
                    <div className="sim-item-row" key={item.id}>
                      <input
                        type="text"
                        className="sim-input item-name"
                        placeholder="Item description"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                      />
                      <input
                        type="number"
                        className="sim-input item-qty"
                        placeholder="Qty"
                        value={item.qty}
                        min="1"
                        style={{ textAlign: 'center' }}
                        onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                      />
                      <input
                        type="number"
                        className="sim-input item-price"
                        placeholder="Price"
                        value={item.price}
                        min="0"
                        style={{ textAlign: 'right' }}
                        onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                      />
                      <input
                        type="number"
                        className="sim-input item-tax"
                        placeholder="GST %"
                        value={item.tax}
                        min="0"
                        style={{ textAlign: 'right' }}
                        onChange={(e) => handleItemChange(item.id, 'tax', e.target.value)}
                      />
                      <button
                        className="btn-icon-sm btn-remove-item"
                        onClick={() => handleRemoveItemRow(item.id)}
                      >
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="btn-add-item" onClick={handleAddItemRow}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Add Item Row
                </button>
              </div>

              {/* Live Calculations */}
              <div className="sim-calculations">
                <div className="calc-row">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="calc-row">
                  <span>GST Tax Total</span>
                  <span>₹{taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="calc-row">
                  <span>Discount (10% Default Applied)</span>
                  <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="calc-row total">
                  <span>Grand Total</span>
                  <span className="total-val">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Action Trigger */}
              <button className="btn btn-primary btn-generate" onClick={handleGenerateInvoice}>
                <Receipt style={{ width: '16px', height: '16px' }} /> Generate Digital Invoice
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section className="features" id="features">
        <div className="container">
          <div className="section-header">
            <h2>Engineered for High-Speed ERP</h2>
            <p>Manage all aspects of your sales lifecycle, tax regulations, and ledger summaries in a single modern ecosystem.</p>
          </div>

          <div className="features-grid">
            <div className="glass-card feature-card">
              <div className="feature-icon-wrapper">
                <Zap style={{ width: '20px', height: '20px' }} />
              </div>
              <h3>GSTIN Details Fetch</h3>
              <p>Enter any GSTIN and pull verified business details, addresses, and states directly from official legal APIs to prevent manual entry errors.</p>
            </div>

            <div className="glass-card feature-card">
              <div className="feature-icon-wrapper">
                <Users style={{ width: '20px', height: '20px' }} />
              </div>
              <h3>Customer Ledger Tracker</h3>
              <p>Track payments, invoice logs, running balances, and statement summaries for every customer dynamically in dedicated account interfaces.</p>
            </div>

            <div className="glass-card feature-card">
              <div className="feature-icon-wrapper">
                <Package style={{ width: '20px', height: '20px' }} />
              </div>
              <h3>Inventory & Stock Control</h3>
              <p>Set custom alert limits, track multi-unit types (PCS, BOX, KG), check live stock status, and adjust pricing instantly.</p>
            </div>

            <div className="glass-card feature-card">
              <div className="feature-icon-wrapper">
                <Printer style={{ width: '20px', height: '20px' }} />
              </div>
              <h3>Professional Layout Printing</h3>
              <p>Format, customize, and print clean invoices instantly. Generates compliant PDF copies with structured headers, notes, and terms.</p>
            </div>

            <div className="glass-card feature-card">
              <div className="feature-icon-wrapper">
                <BarChart3 style={{ width: '20px', height: '20px' }} />
              </div>
              <h3>Live Analytics Dashboard</h3>
              <p>Get immediate clarity on profit margins, monthly cash flow, outstanding client dues, and total tax liability (GST SGST/CGST/IGST).</p>
            </div>

            <div className="glass-card feature-card">
              <div className="feature-icon-wrapper">
                <ShieldCheck style={{ width: '20px', height: '20px' }} />
              </div>
              <h3>Role-based Permission</h3>
              <p>Maintain data integrity with secure, strict access controls separating executive oversight from billing staff operators.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="dashboard-preview" id="dashboard">
        <div className="container">
          <div className="section-header">
            <h2>Inside the Platform</h2>
            <p>A peek into the sleek ERP interface that makes monitoring business financials effortless.</p>
          </div>

          <div className="preview-wrapper">
            <div className="preview-bar">
              <div className="dot dot-red"></div>
              <div className="dot dot-yellow"></div>
              <div className="dot dot-green"></div>
              <span className="preview-title">BILLNOVA CLOUD - DASHBOARD_PREVIEW.JS</span>
            </div>
            
            <div className="mock-dashboard">
              {/* Mock Sidebar */}
              <div className="mock-sidebar">
                <div className="mock-logo">
                  <div className="logo-box" style={{ width: '1.5rem', height: '1.5rem', fontSize: '0.85rem', borderRadius: '0.25rem' }}>B</div>
                  <span>BillNova ERP</span>
                </div>
                <nav className="mock-nav">
                  <a href="#" className="mock-nav-item active"><LayoutDashboard style={{ width: '14px', height: '14px' }} /> Dashboard</a>
                  <a href="#" className="mock-nav-item"><Receipt style={{ width: '14px', height: '14px' }} /> Create Invoice</a>
                  <a href="#" className="mock-nav-item"><Users style={{ width: '14px', height: '14px' }} /> Customers</a>
                  <a href="#" className="mock-nav-item"><Package style={{ width: '14px', height: '14px' }} /> Products & Inventory</a>
                  <a href="#" className="mock-nav-item"><CreditCard style={{ width: '14px', height: '14px' }} /> Payments</a>
                  <a href="#" className="mock-nav-item"><BarChart3 style={{ width: '14px', height: '14px' }} /> Reports</a>
                </nav>
              </div>

              {/* Mock Main Panel */}
              <div className="mock-main">
                <div className="mock-header">
                  <h4>Overview Financials</h4>
                  <div className="sim-badge" style={{ border: '1px solid var(--border-color)' }}>Financial Year: 2026-27</div>
                </div>

                {/* Mini Stats Grid */}
                <div className="mock-grid-3">
                  <div className="mock-stats-card">
                    <h5>Total Sales Revenue</h5>
                    <div className="val">₹4,28,450</div>
                    <div className="trend"><ArrowUpRight style={{ width: '12px', height: '12px' }} /> +18.4% this month</div>
                  </div>
                  <div className="mock-stats-card">
                    <h5>Outstanding Balance</h5>
                    <div className="val" style={{ color: '#ef4444' }}>₹42,800</div>
                    <div className="trend" style={{ color: 'var(--text-muted)' }}>From 12 customers</div>
                  </div>
                  <div className="mock-stats-card">
                    <h5>Tax Collected (GST)</h5>
                    <div className="val" style={{ color: 'var(--secondary)' }}>₹77,121</div>
                    <div className="trend"><ArrowUpRight style={{ width: '12px', height: '12px' }} /> +12.1% progress</div>
                  </div>
                </div>

                {/* Table */}
                <div className="mock-table-wrapper">
                  <div className="mock-table-title">Recent Invoices</div>
                  <table className="mock-table">
                    <thead>
                      <tr>
                        <th>Invoice ID</th>
                        <th>Client Name</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>#INV-2026-042</td>
                        <td>Reliance Digital Ltd</td>
                        <td>July 5, 2026</td>
                        <td>₹89,200.00</td>
                        <td><span className="mock-badge mock-badge-success">Paid</span></td>
                      </tr>
                      <tr>
                        <td>#INV-2026-041</td>
                        <td>Tata Projects Co.</td>
                        <td>July 4, 2026</td>
                        <td>₹1,45,000.00</td>
                        <td><span className="mock-badge mock-badge-success">Paid</span></td>
                      </tr>
                      <tr>
                        <td>#INV-2026-040</td>
                        <td>Vanguard Solutions</td>
                        <td>July 2, 2026</td>
                        <td>₹21,060.00</td>
                        <td><span className="mock-badge mock-badge-warning">Pending</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="faq" id="faq">
        <div className="container">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
            <p>Have quick questions about integrating BillNova ERP in your business? We've got answers.</p>
          </div>

          <div className="faq-list">
            {[
              {
                q: "How does the GSTIN lookup integration operate?",
                a: "Our system integrates directly with government corporate database registers. By inputting a verified GSTIN, BillNova retrieves legal entity name, trade state, registered operating office address, and status instantly to populate forms without mistakes."
              },
              {
                q: "Can I customize the generated invoices with my brand logo?",
                a: "Yes. The platform allows upload of logo assets, customization of tax rates, layout presets (A4, thermal 80mm), terms & conditions, and signatures to ensure the generated invoices perfectly reflect your brand presence."
              },
              {
                q: "Is my database secure and private?",
                a: "Absolutely. We encrypt database storage logs at rest, run on premium server instances with private networks, and apply strict authentication schemas so you retain complete absolute control over client transactions."
              },
              {
                q: "Are there multi-user access permissions supported?",
                a: "Yes. BillNova supports Owner, Admin, Manager, and Billing Operator roles. Owners can review advanced profit records, while operator permissions can be locked strictly to invoice generations."
              }
            ].map((faq, idx) => (
              <div className={`faq-item ${faqActiveIndex === idx ? 'active' : ''}`} key={idx}>
                <div className="faq-question" onClick={() => toggleFaq(idx)}>
                  <span>{faq.q}</span>
                  <Plus className="faq-icon" style={{ width: '18px', height: '18px' }} />
                </div>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-banner" id="cta">
        <div className="container">
          <div className="cta-box">
            <h2>Take Control of Your Billing</h2>
            <p>Join thousands of business owners optimizing operations, recovering client dues faster, and generating compliant invoices in seconds.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#demo" className="btn btn-primary">
                Try Live Simulator <Play style={{ width: '16px', height: '16px' }} />
              </a>
              {isAuthenticated ? (
                <Link href="/dashboard" className="btn btn-secondary">
                  Go to Dashboard <LayoutDashboard style={{ width: '16px', height: '16px' }} />
                </Link>
              ) : (
                <Link href="/login" className="btn btn-secondary">
                  Create Free Account <UserPlus style={{ width: '16px', height: '16px' }} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-logo-desc">
              <a href="#" className="logo">
                <div className="logo-box">B</div>
                <span className="logo-text">BillNova</span>
              </a>
              <p>Next-generation ERP & invoicing software custom tailored for growing agencies, retail counters, and modern enterprises.</p>
            </div>
            <div className="footer-column">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#demo">Live Simulator</a></li>
                <li><a href="#dashboard">ERP Dashboard</a></li>
                <li><a href="#">API Documentation</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <ul>
                <li><a href="#">Help Center</a></li>
                <li><a href="#faq">FAQs</a></li>
                <li><a href="#">Contact Support</a></li>
                <li><a href="#">Security Audits</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
                <li><a href="#">GST Regulations</a></li>
                <li><a href="#">Refund Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 BillNova ERP Technologies. All rights reserved.</p>
            <p>Designed with ❤️ for modern businesses.</p>
          </div>
        </div>
      </footer>

      {/* -------------------------------------------------------------
         MODAL: GENERATED INVOICE PDF OVERLAY
      ------------------------------------------------------------- */}
      <div className={`modal-overlay ${modalActive ? 'active' : ''}`}>
        <div className="modal-container">
          {/* Top Controls */}
          <div className="modal-actions">
            <div className="modal-actions-title">
              <CheckCircle style={{ color: 'var(--primary)', width: '20px', height: '20px' }} /> Invoice Generated Successfully!
            </div>
            <div className="modal-btn-group">
              <button className="btn btn-primary" onClick={handlePrint} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
                <Printer style={{ width: '14px', height: '14px' }} /> Print Invoice
              </button>
              <button className="btn btn-secondary" onClick={() => setModalActive(false)} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
                Close Window
              </button>
            </div>
          </div>

          {/* Printable PDF content */}
          <div className="pdf-wrapper">
            {/* PDF Header */}
            <div className="invoice-pdf-header">
              <div className="pdf-brand">
                <div className="pdf-logo">
                  <div className="pdf-logo-box">B</div>
                  <span className="pdf-logo-text">BillNova Technologies</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  102, Emerald Tech Center, Sector V<br />
                  Mumbai, MH, 400051<br />
                  support@billnova.io | GSTIN: 27AAAAA1111A1Z1
                </p>
              </div>
              <div className="pdf-meta">
                <h2>Invoice</h2>
                <p className="pdf-meta-num">{pdfInvoiceNumber}</p>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Date: <span>{pdfDate}</span><br />
                  Due Date: <span>{pdfDueDate}</span>
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="pdf-details-grid">
              <div className="pdf-detail-col">
                <h4>Billed To:</h4>
                <p>
                  <strong>{customerName}</strong><br />
                  GSTIN: <span style={{ fontWeight: 500 }}>{customerGstin}</span><br />
                  Place of Supply: Maharashtra (MH)
                </p>
              </div>
              <div className="pdf-detail-col" style={{ textAlign: 'right' }}>
                <h4>Payment Mode:</h4>
                <p>
                  <strong>Bank Transfer / NetBanking</strong><br />
                  HDFC Bank - Current A/C<br />
                  IFS Code: HDFC0000104
                </p>
              </div>
            </div>

            {/* Products Table */}
            <table className="pdf-table">
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>Qty</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>Rate (₹)</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>GST %</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lineAmount = item.qty * item.price;
                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right' }}>₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'center' }}>{item.tax}%</td>
                      <td style={{ textAlign: 'right' }}>₹{lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary section */}
            <div className="pdf-summary-grid">
              <div className="pdf-notes">
                <h5>Terms & Conditions:</h5>
                <p>
                  1. Payment due within 15 days of invoice date.<br />
                  2. 18% p.a. interest chargeable on delayed payments.<br />
                  3. All disputes subject to Mumbai jurisdiction.<br />
                  Thank you for your business!
                </p>
              </div>
              <div>
                <table className="pdf-totals-table">
                  <tbody>
                    <tr>
                      <td>Subtotal:</td>
                      <td style={{ textAlign: 'right' }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td>GST Amount:</td>
                      <td style={{ textAlign: 'right' }}>₹{taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td>Discount (10%):</td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="grand-total">
                      <td>Grand Total:</td>
                      <td style={{ textAlign: 'right' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
