'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Users, Phone, Mail, MessageCircle, Check, RefreshCw } from 'lucide-react';
import { toast } from '../store/uiStore';

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  usersNeeded: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  tenant: { id: string; name: string; plan: string } | null;
}

// Super Admin list of "need more users" enquiries sent from the plan modal.
export default function UserEnquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/enquiries');
      setEnquiries(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load enquiries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markDone = async (id: string) => {
    try {
      await api.patch(`/admin/enquiries/${id}/done`, {});
      setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'DONE' } : e)));
      toast.success('Enquiry marked as done.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update enquiry.');
    }
  };

  const newCount = enquiries.filter((e) => e.status === 'NEW').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users className="h-5 w-5" />
          </span>
          <h3 className="text-2xl font-extrabold tracking-tight text-white">Extra User Enquiries</h3>
          {newCount > 0 && (
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-black text-zinc-950">{newCount} New</span>
          )}
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {!loading && enquiries.length === 0 ? (
        <p className="rounded-2xl border border-zinc-800 p-8 text-center text-sm text-zinc-500">No enquiries yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {enquiries.map((e) => (
            <div
              key={e.id}
              className={`rounded-2xl border p-5 space-y-3 ${
                e.status === 'NEW' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/20 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white">{e.tenant?.name || '—'}</p>
                  <p className="text-xs text-zinc-400">
                    {e.name} · {new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-400 whitespace-nowrap">
                  {e.usersNeeded || '?'} users
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-300">
                <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-zinc-500" /> {e.phone}</p>
                {e.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-zinc-500" /> {e.email}</p>}
              </div>

              {e.message && (
                <p className="rounded-lg bg-zinc-950/60 border border-zinc-800 p-3 text-xs text-zinc-300 whitespace-pre-line">{e.message}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://wa.me/${e.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                {e.status === 'NEW' ? (
                  <button
                    onClick={() => markDone(e.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark Done
                  </button>
                ) : (
                  <span className="text-xs font-bold text-zinc-500">✓ Done</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
