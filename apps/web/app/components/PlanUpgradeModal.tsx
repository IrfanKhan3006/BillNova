'use client';

import React, { useState } from 'react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useAuthStore } from '../store/authStore';
import {
  Sparkles,
  CheckCircle2,
  X,
  CreditCard,
  MessageCircle,
  Copy,
  Check,
  Building,
  ShieldCheck,
  AlertCircle,
  Zap,
  Users,
  Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '../store/uiStore';

export default function PlanUpgradeModal() {
  const { isUpgradeModalOpen, closeUpgradeModal, modalMessage, planStatus, requestUpgrade } =
    useSubscriptionStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'plan' | 'upi' | 'whatsapp' | 'users'>('plan');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [enquiry, setEnquiry] = useState({ name: '', phone: '', email: '', usersNeeded: '3', message: '' });
  const [sendingEnquiry, setSendingEnquiry] = useState(false);

  if (!isUpgradeModalOpen) return null;

  // Platform owner's UPI ID — plan payments go to BillNova, not the tenant
  const upiId = 'yespay.mabs0639619akit0640@yesbankltd';
  const tenantName = user?.tenant?.name || 'My Business';
  const billsUsed = planStatus?.invoicesCount ?? user?.tenant?.maxFreeInvoices ?? 7;
  const maxBills = planStatus?.maxFreeInvoices ?? 7;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleRequestUpgrade = async () => {
    try {
      setSubmittingRequest(true);
      await requestUpgrade(`Requested activation for Basic Plan by ${user?.name || 'User'}`);
      setRequestSent(true);
      toast.success('Upgrade request submitted to Super Admin! Contact on WhatsApp for instant 5-minute activation.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit upgrade request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Pre-fill enquiry contact details from the logged-in account.
  const enquiryName = enquiry.name || user?.name || '';
  const enquiryPhone = enquiry.phone || user?.tenant?.phone || '';
  const enquiryEmail = enquiry.email || user?.email || '';

  const handleSendEnquiry = async () => {
    if (!enquiryName.trim() || !enquiryPhone.trim()) {
      toast.error('Please enter your name and phone number.');
      return;
    }
    const text =
      `Hello BillNova Team, I need more users for my business.\n\n` +
      `• Business Name: ${tenantName}\n• Name: ${enquiryName}\n• Phone: ${enquiryPhone}\n` +
      `• Email: ${enquiryEmail}\n• Users Needed: ${enquiry.usersNeeded}\n` +
      (enquiry.message.trim() ? `• Message: ${enquiry.message.trim()}\n` : '');
    // Open WhatsApp first (synchronously) so popup blockers don't stop it.
    window.open(`https://wa.me/918884979997?text=${encodeURIComponent(text)}`, '_blank');
    try {
      setSendingEnquiry(true);
      await api.post('/business/enquiry', {
        name: enquiryName,
        phone: enquiryPhone,
        email: enquiryEmail || undefined,
        usersNeeded: enquiry.usersNeeded,
        message: enquiry.message || undefined,
      });
      toast.success('Enquiry sent! Our team will contact you shortly.');
      setEnquiry({ name: '', phone: '', email: '', usersNeeded: '3', message: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save enquiry. Please send it on WhatsApp.');
    } finally {
      setSendingEnquiry(false);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello BillNova Team, I would like to activate the Basic Plan for my business:\n\n• Business Name: ${tenantName}\n• Email: ${user?.email || ''}\n• Phone: ${user?.tenant?.phone || ''}\n• Plan: Basic Plan\n\nPlease activate my account.`
  );
  const whatsappUrl = `https://wa.me/918884979997?text=${whatsappMessage}`;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 no-print overflow-y-auto">
      <div
        className="relative w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-zinc-100 my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Tag & Title */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
            <Sparkles className="h-3.5 w-3.5" /> Plan Selection & Upgrade
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Please Select Our Plan
          </h2>

          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            {modalMessage || (
              <>
                You have reached your <span className="text-emerald-400 font-semibold">{maxBills} free bills</span> limit. Upgrade now to unlock unlimited invoices, purchases, and full ERP features.
              </>
            )}
          </p>
        </div>

        {/* Free Trial Exhausted Notice */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="text-xs text-zinc-300">
            <span className="font-semibold text-amber-300">Free Trial Limit ({billsUsed}/{maxBills} bills):</span> Your 7 free bills have been utilized. Our simple Basic Plan allows unlimited bills and lifetime business continuity.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-900/60 p-1 rounded-2xl border border-zinc-800/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-2 px-3 rounded-xl transition ${
              activeTab === 'plan'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Basic Plan
          </button>
          <button
            onClick={() => setActiveTab('upi')}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'upi'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" /> Pay via UPI
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Help
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Need More Users?
          </button>
        </div>

        {/* TAB 1: Plan Details & Direct Request */}
        {activeTab === 'plan' && (
          <div className="space-y-5">
            <div className="relative rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 to-zinc-900/40 p-5 sm:p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider border border-emerald-500/30">
                    Recommended Plan
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">Basic Plan</h3>
                  <p className="text-xs text-zinc-400">Complete SaaS ERP for Growing Indian Businesses</p>
                </div>
              </div>

              {/* Features list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5 text-xs text-zinc-300">
                {[
                  'Unlimited Invoices & GST Bills',
                  'Unlimited Purchase Invoices',
                  'Vendor & Customer Management',
                  'Inventory & Stock Tracking',
                  'A4, A5 & Thermal Print Formats',
                  'WhatsApp & SMS Sharing',
                  'Daily P&L & Tax Reports',
                  '1-Year Validity + Dedicated Support',
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Activation Request Action */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRequestUpgrade}
                disabled={submittingRequest || requestSent}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {requestSent
                  ? 'Activation Request Sent!'
                  : submittingRequest
                  ? 'Submitting...'
                  : 'Request Plan Activation'}
              </button>

              <button
                onClick={() => setActiveTab('upi')}
                className="py-3 px-5 rounded-2xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4 text-purple-400" />
                Pay via UPI
              </button>
            </div>

            {requestSent && (
              <p className="text-center text-xs text-emerald-400 font-medium">
                ✓ Request recorded! Super Admin will activate your account within minutes. You can also message on WhatsApp for instant activation.
              </p>
            )}
          </div>
        )}

        {/* TAB 2: Direct UPI QR & Payment */}
        {activeTab === 'upi' && (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl max-w-[200px] mx-auto shadow-xl">
              <QRCodeSVG
                value={`upi://pay?pa=${upiId}&pn=BillNova&cu=INR&tn=BillNova_Basic_Plan_${tenantName.replace(/\s+/g, '_')}`}
                size={160}
                level="M"
              />
              <span className="text-[10px] text-zinc-600 font-bold mt-2 font-mono">Scan with GPay / PhonePe / Paytm</span>
            </div>

            <div className="flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl max-w-sm mx-auto">
              <span className="text-xs text-zinc-400">UPI ID:</span>
              <span className="text-xs font-mono font-bold text-white">{upiId}</span>
              <button
                onClick={handleCopyUpi}
                className="p-1 rounded text-zinc-400 hover:text-emerald-400"
                title="Copy UPI ID"
              >
                {copiedUpi ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Pay the plan amount directly via any UPI App. Once paid, click the button below to send payment confirmation on WhatsApp or Super Admin.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
              >
                <MessageCircle className="h-4 w-4" /> Share Screenshot on WhatsApp
              </a>
              <button
                onClick={handleRequestUpgrade}
                disabled={submittingRequest || requestSent}
                className="py-3 px-4 rounded-2xl border border-zinc-700 bg-zinc-900 text-white font-semibold text-xs hover:bg-zinc-800 transition"
              >
                {requestSent ? 'Request Recorded ✓' : 'I Have Paid (Notify Admin)'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Extra users enquiry */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="text-xs text-zinc-400">
              Basic Plan includes 2 users. Need more? Fill this form and our team will contact you on WhatsApp.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={enquiryName}
                onChange={(e) => setEnquiry({ ...enquiry, name: e.target.value })}
                placeholder="Your Name *"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <input
                value={enquiryPhone}
                onChange={(e) => setEnquiry({ ...enquiry, phone: e.target.value })}
                placeholder="Phone / WhatsApp *"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <input
                value={enquiryEmail}
                onChange={(e) => setEnquiry({ ...enquiry, email: e.target.value })}
                placeholder="Email"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <select
                value={enquiry.usersNeeded}
                onChange={(e) => setEnquiry({ ...enquiry, usersNeeded: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              >
                {['3', '4', '5', '6-10', '10+'].map((n) => (
                  <option key={n} value={n}>
                    {n} users needed
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={enquiry.message}
              onChange={(e) => setEnquiry({ ...enquiry, message: e.target.value })}
              rows={3}
              placeholder="Message (optional)"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleSendEnquiry}
              disabled={sendingEnquiry}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-60 transition"
            >
              <Send className="h-4 w-4" /> {sendingEnquiry ? 'Sending...' : 'Submit & Send on WhatsApp'}
            </button>
            <p className="text-[11px] text-zinc-500 text-center">
              WhatsApp will open with your details — just tap Send.
            </p>
          </div>
        )}

        {/* TAB 3: WhatsApp Support */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MessageCircle className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white">Instant WhatsApp Activation</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Connect directly with our billing support team to activate your Basic Plan immediately or for any billing queries.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-left text-xs space-y-1.5 max-w-sm mx-auto font-mono text-zinc-400">
              <div className="text-white font-semibold font-sans">Message Preview:</div>
              <div className="text-zinc-300">"Hello BillNova Team, I would like to activate Basic Plan for {tenantName}..."</div>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 py-3 px-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition"
            >
              <MessageCircle className="h-4 w-4" /> Open WhatsApp Chat
            </a>
          </div>
        )}

        {/* Footer Guarantee */}
        <div className="border-t border-zinc-850 pt-4 flex items-center justify-center gap-2 text-[11px] text-zinc-500 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>GST compliant invoices • Instant activation • Cancel anytime</span>
        </div>
      </div>
    </div>
  );
}
