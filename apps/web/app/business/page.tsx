'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Save, AlertCircle, CheckCircle, Building } from 'lucide-react';

export default function BusinessSettingsPage() {
  const { updateUserTenant } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    gstin: '',
    stateCode: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '',
    invoicePrefix: 'INV',
    dueDays: 30,
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await api.get('/business');
        setForm({
          name: res.name || '',
          gstin: res.gstin || '',
          stateCode: res.stateCode || '',
          address: res.address || '',
          phone: res.phone || '',
          email: res.email || '',
          logoUrl: res.logoUrl || '',
          invoicePrefix: res.invoicePrefix || 'INV',
          dueDays: res.dueDays ?? 30,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load business profile.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'dueDays' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await api.patch('/business', form);
      // Update local storage and zustand store details
      updateUserTenant({
        name: res.name,
        gstin: res.gstin,
        logoUrl: res.logoUrl,
      });
      setSuccess('Business profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update business profile.');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Business Settings</h1>
          <p className="mt-1 text-zinc-400 text-sm">Configure your white-label business settings, GSTIN, and default payment terms.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-550 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-450 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-805 bg-zinc-900/20 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Core Info */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-zinc-300">Registered Business Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  placeholder="Sharma Traders"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300">GSTIN Number (Optional)</label>
                <input
                  type="text"
                  name="gstin"
                  value={form.gstin}
                  onChange={handleChange}
                  maxLength={15}
                  className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none uppercase"
                  placeholder="e.g. 07AAAAA1111A1Z1"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300">GST State Code (e.g. 07 for Delhi, 27 for MH)</label>
                <input
                  type="text"
                  name="stateCode"
                  value={form.stateCode}
                  onChange={handleChange}
                  maxLength={2}
                  className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. 07"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300">Logo URL (White label branding)</label>
                <input
                  type="text"
                  name="logoUrl"
                  value={form.logoUrl}
                  onChange={handleChange}
                  className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. https://domain.com/logo.png"
                />
              </div>
            </div>

            {/* Contact Details */}
            <div className="border-t border-zinc-800 pt-6">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Contact Details</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300">Contact Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="9876543210"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300">Billing Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="billing@sharmatraders.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-zinc-300">Business Address</label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows={3}
                    className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="123, Ring Road, Industrial Area, New Delhi"
                  />
                </div>
              </div>
            </div>

            {/* Invoicing Rules */}
            <div className="border-t border-zinc-800 pt-6">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Invoicing Defaults</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300">Invoice Number Prefix</label>
                  <input
                    type="text"
                    name="invoicePrefix"
                    required
                    value={form.invoicePrefix}
                    onChange={handleChange}
                    className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none uppercase"
                    placeholder="e.g. INV"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300">Payment Due Terms (Days)</label>
                  <input
                    type="number"
                    name="dueDays"
                    required
                    min={0}
                    value={form.dueDays}
                    onChange={handleChange}
                    className="mt-2 block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="30"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 border-t border-zinc-800 pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition disabled:opacity-50"
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </SidebarLayout>
  );
}
