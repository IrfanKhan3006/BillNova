'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/uiStore';
import {
  buildAppointmentMessage,
  buildWhatsAppLink,
  toWhatsAppNumber,
} from '../lib/whatsappAppointment';
import {
  buildGoogleCalendarUrl,
  endTimeLabel,
  DURATION_OPTIONS,
} from '../lib/googleCalendar';
import AppointmentCalendar from '../components/AppointmentCalendar';
import type { CalendarView } from '../lib/calendarGrid';
import {
  CalendarClock,
  Plus,
  MessageCircle,
  Receipt,
  Search,
  X,
  CheckCircle2,
  Trash2,
  User,
  CalendarPlus,
  CalendarDays,
  List as ListIcon,
  UserPlus,
  Pencil,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
}

interface Appointment {
  id: string;
  service: string;
  staffName?: string | null;
  startsAt: string;
  durationMins: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string | null;
  invoiceId?: string | null;
  customer: Customer;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  COMPLETED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'border-zinc-700 bg-zinc-800 text-zinc-400',
  NO_SHOW: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/** Local date/time inputs → an ISO string in the browser's own timezone. */
const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

/** ISO string → the `date` and `time` input values in the browser's own timezone. */
const localParts = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  const [date, rest] = d.toISOString().split('T');
  return { date, time: rest.slice(0, 5) };
};
const localDate = (iso: string) => localParts(iso).date;
const localTime = (iso: string) => localParts(iso).time;

const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export default function AppointmentsPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  const [calendarView, setCalendarView] = useState<CalendarView>('workweek');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '' });

  const [form, setForm] = useState({
    customerId: '',
    service: '',
    staffName: '',
    date: todayStr(),
    time: '10:00',
    durationMins: 60,
    notes: '',
  });

  const load = useCallback(async () => {
    try {
      setError(null);
      const [appts, custs] = await Promise.all([api.get('/appointments'), api.get('/customers')]);
      setAppointments(appts);
      setCustomers(custs);
      setForm((prev) => ({ ...prev, customerId: prev.customerId || custs[0]?.id || '' }));
    } catch (err: any) {
      setError(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  /** Opens WhatsApp with the confirmation message ready to send. */
  const sendWhatsApp = (appt: Appointment) => {
    const phone = toWhatsAppNumber(appt.customer.phone);
    if (!phone) {
      toast.error(
        appt.customer.phone
          ? 'Customer ka phone number valid nahi hai.'
          : 'Is customer ka phone number save nahi hai. Pehle Customers page par number add karein.',
      );
      return;
    }

    const message = buildAppointmentMessage({
      customerName: appt.customer.name,
      businessName: user?.tenant?.name,
      businessPhone: user?.tenant?.phone,
      service: appt.service,
      staffName: appt.staffName,
      startsAt: appt.startsAt,
      calendarUrl: calendarUrlFor(appt),
      template: user?.tenant?.appointmentTemplate,
    });

    window.open(buildWhatsAppLink(phone, message), '_blank', 'noopener,noreferrer');
  };

  /**
   * The Google Calendar "add event" link for an appointment. The same link
   * serves both sides: the business opens it from the Calendar button, and the
   * customer gets it in the WhatsApp message and saves it to their own
   * calendar — it needs no account linking on either end.
   */
  const calendarUrlFor = (appt: Appointment) => {
    const details = [
      `Customer: ${appt.customer.name}${appt.customer.phone ? ` (${appt.customer.phone})` : ''}`,
      appt.staffName ? `With: ${appt.staffName}` : '',
      appt.notes ? `Notes: ${appt.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return buildGoogleCalendarUrl({
      title: `${appt.service} — ${user?.tenant?.name || appt.customer.name}`,
      startsAt: appt.startsAt,
      durationMins: appt.durationMins,
      details,
      location: user?.tenant?.address || user?.tenant?.name || '',
    });
  };

  /** Opens Google Calendar with the appointment filled in, ready to save. */
  const addToCalendar = (appt: Appointment) => {
    const url = calendarUrlFor(appt);

    if (!url) {
      toast.error('Is appointment ki date/time theek nahi hai.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /** Blank form, back to "book a new one" mode. */
  const resetForm = () => {
    setEditingId(null);
    setForm((prev) => ({
      ...prev,
      customerId: prev.customerId || customers[0]?.id || '',
      service: '',
      staffName: '',
      date: todayStr(),
      time: '10:00',
      durationMins: 60,
      notes: '',
    }));
  };

  /** Loads an existing appointment into the form for editing. */
  const startEdit = (appt: Appointment) => {
    setEditingId(appt.id);
    setShowQuickCustomer(false);
    setForm({
      customerId: appt.customer.id,
      service: appt.service,
      staffName: appt.staffName || '',
      date: localDate(appt.startsAt),
      time: localTime(appt.startsAt),
      durationMins: appt.durationMins,
      notes: appt.notes || '',
    });
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Quick-add a customer without leaving the booking form. */
  const handleQuickCustomer = async () => {
    if (!quickCustomer.name.trim()) {
      toast.error('Customer ka naam likhein.');
      return;
    }

    setSavingCustomer(true);
    try {
      const created: Customer = await api.post('/customers', {
        name: quickCustomer.name.trim(),
        phone: quickCustomer.phone.trim() || undefined,
      });
      setCustomers((prev) => [created, ...prev]);
      setForm((prev) => ({ ...prev, customerId: created.id }));
      setQuickCustomer({ name: '', phone: '' });
      setShowQuickCustomer(false);
      toast.success(`Customer "${created.name}" add ho gaya.`);
    } catch (err: any) {
      toast.error(err.message || 'Customer add nahi ho paya.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error('Pehle customer chunein.');
      return;
    }
    if (!form.service.trim()) {
      toast.error('Appointment ka purpose / service likhein.');
      return;
    }

    setSaving(true);
    const payload = {
      customerId: form.customerId,
      service: form.service.trim(),
      staffName: form.staffName.trim() || '',
      startsAt: toIso(form.date, form.time),
      durationMins: form.durationMins,
      notes: form.notes.trim() || '',
    };

    try {
      if (editingId) {
        const updated: Appointment = await api.patch(`/appointments/${editingId}`, payload);
        setAppointments((prev) =>
          prev
            .map((a) => (a.id === editingId ? { ...a, ...updated } : a))
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        );
        setShowForm(false);
        resetForm();
        toast.success('Appointment updated.');
        return;
      }

      const created: Appointment = await api.post('/appointments', {
        ...payload,
        staffName: payload.staffName || undefined,
        notes: payload.notes || undefined,
      });
      setAppointments((prev) =>
        [...prev, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
      setShowForm(false);
      setForm((prev) => ({ ...prev, service: '', staffName: '', notes: '' }));
      toast.success('Appointment booked.');
      // Straight into WhatsApp, which is the point of booking it.
      sendWhatsApp(created);
    } catch (err: any) {
      toast.error(
        err.message || (editingId ? 'Appointment update nahi hua.' : 'Appointment book nahi ho paya.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (appt: Appointment, status: Appointment['status']) => {
    try {
      const updated = await api.patch(`/appointments/${appt.id}`, { status });
      setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, ...updated } : a)));
    } catch (err: any) {
      toast.error(err.message || 'Status update nahi hua.');
    }
  };

  const remove = async (appt: Appointment) => {
    try {
      await api.delete(`/appointments/${appt.id}`);
      setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
      if (editingId === appt.id) {
        setShowForm(false);
        resetForm();
      }
      toast.success('Appointment deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Delete nahi hua.');
    }
  };

  const createBill = (appt: Appointment) => {
    const params = new URLSearchParams({
      customerId: appt.customer.id,
      itemName: appt.service,
      appointmentId: appt.id,
    });
    router.push(`/billing?${params.toString()}`);
  };

  const q = search.toLowerCase();
  const visible = appointments.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (!q) return true;
    return (
      a.customer.name.toLowerCase().includes(q) ||
      a.service.toLowerCase().includes(q) ||
      (a.staffName || '').toLowerCase().includes(q)
    );
  });

  // Group by day so the list reads like a diary.
  const grouped = visible.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = dayLabel(a.startsAt);
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              <CalendarClock className="h-7 w-7 text-emerald-500" /> Appointments
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Appointment book karein — confirmation WhatsApp par customer ko bhej dein.
            </p>
          </div>
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="flex items-center gap-2 self-start rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Close' : 'Book Appointment'}
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Booking form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5"
          >
            <h2 className="font-bold text-zinc-900 dark:text-white">
              {editingId ? 'Edit Appointment' : 'New Appointment'}
            </h2>

            {customers.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-500">
                  Abhi koi customer nahi hai — yahin se ek add kar lein.
                </p>
                {showQuickCustomer ? null : (
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomer(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> New Customer
                  </button>
                )}
              {showQuickCustomer && (
                <div className="rounded-xl border border-emerald-500/30 bg-white p-4 dark:bg-zinc-950">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Naam *
                      </label>
                      <input
                        value={quickCustomer.name}
                        onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                        placeholder="Customer ka naam"
                        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                        WhatsApp Number
                      </label>
                      <input
                        value={quickCustomer.phone}
                        onChange={(e) => setQuickCustomer({ ...quickCustomer, phone: e.target.value })}
                        placeholder="e.g. 9876543210"
                        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleQuickCustomer}
                      disabled={savingCustomer}
                      className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {savingCustomer ? 'Saving...' : 'Save Customer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickCustomer(false)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Customer *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowQuickCustomer((v) => !v)}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-500 transition hover:text-emerald-400"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {showQuickCustomer ? 'Cancel' : 'New Customer'}
                      </button>
                    </div>
                    <select
                      value={form.customerId}
                      onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : '(no phone)'}
                        </option>
                      ))}
                    </select>

                    {showQuickCustomer && (
                      <div className="mt-3 space-y-3 rounded-xl border border-emerald-500/30 bg-white p-3 dark:bg-zinc-950">
                        <input
                          value={quickCustomer.name}
                          onChange={(e) =>
                            setQuickCustomer({ ...quickCustomer, name: e.target.value })
                          }
                          placeholder="Customer ka naam *"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                        />
                        <input
                          value={quickCustomer.phone}
                          onChange={(e) =>
                            setQuickCustomer({ ...quickCustomer, phone: e.target.value })
                          }
                          placeholder="WhatsApp number"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={handleQuickCustomer}
                          disabled={savingCustomer}
                          className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {savingCustomer ? 'Saving...' : 'Save Customer'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Purpose / Service *
                    </label>
                    <input
                      value={form.service}
                      onChange={(e) => setForm({ ...form, service: e.target.value })}
                      placeholder="e.g. Consultation, Site Visit, Hair Cut"
                      className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Staff / Assigned To
                    </label>
                    <input
                      value={form.staffName}
                      onChange={(e) => setForm({ ...form, staffName: e.target.value })}
                      placeholder="e.g. Rahul"
                      className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Time *
                      </label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Duration
                      </label>
                      <select
                        value={form.durationMins}
                        onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })}
                        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Koi khaas baat..."
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-zinc-950 transition disabled:opacity-60 ${
                      editingId
                        ? 'bg-emerald-500 hover:bg-emerald-400'
                        : 'bg-[#25D366] hover:bg-[#1ebe5b]'
                    }`}
                  >
                    {editingId ? (
                      <Pencil className="h-4 w-4" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                    {saving
                      ? editingId
                        ? 'Updating...'
                        : 'Booking...'
                      : editingId
                        ? 'Update Appointment'
                        : 'Book & Send on WhatsApp'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}
                      className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Cancel
                    </button>
                  )}
                  <p className="text-[11px] text-zinc-500">
                    {editingId
                      ? 'Changes save karne ke baad customer ko dobara WhatsApp bhej sakte hain.'
                      : 'Book hote hi WhatsApp khulega — aapko bas Send dabana hai.'}
                  </p>
                </div>
              </>
            )}
          </form>
        )}

        {/* View switch */}
        <div className="flex rounded-xl border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900 w-fit">
          {([
            { key: 'list' as const, label: 'List', Icon: ListIcon },
            { key: 'calendar' as const, label: 'Calendar', Icon: CalendarDays },
          ]).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                mode === key
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, service or staff..."
              className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        {mode === 'calendar' && !loading && (
          <>
            <AppointmentCalendar
              appointments={visible}
              view={calendarView}
              onViewChange={setCalendarView}
              onSelect={(a) => setSelectedId((id) => (id === a.id ? null : a.id))}
              selectedId={selectedId}
            />
            {/* Actions for the block the user picked */}
            {(() => {
              const a = visible.find((x) => x.id === selectedId);
              if (!a) return null;
              return (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{a.service}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {dayLabel(a.startsAt)} · {timeLabel(a.startsAt)} –{' '}
                        {endTimeLabel(a.startsAt, a.durationMins)}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.customer.name}
                        {a.customer.phone ? ` · ${a.customer.phone}` : ''}
                        {a.staffName ? ` · With: ${a.staffName}` : ''}
                      </p>
                      {a.notes && <p className="mt-1 text-xs italic text-zinc-500">{a.notes}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => startEdit(a)}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => sendWhatsApp(a)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-[#1ebe5b]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </button>
                      <button
                        onClick={() => addToCalendar(a)}
                        className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" /> Calendar
                      </button>
                      <button
                        onClick={() => createBill(a)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <Receipt className="h-3.5 w-3.5" /> Create Bill
                      </button>
                      <select
                        value={a.status}
                        onChange={(e) => setStatus(a, e.target.value as Appointment['status'])}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold text-zinc-700 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          remove(a);
                          setSelectedId(null);
                        }}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* List */}
        {mode === 'list' && (loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-emerald-500 dark:border-zinc-800" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <CalendarClock className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {appointments.length === 0 ? 'Abhi koi appointment nahi hai.' : 'Is filter se kuch nahi mila.'}
            </p>
            {appointments.length === 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                "Book Appointment" dabakar pehla appointment banayein.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([day, list]) => (
              <div key={day}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {day} · {list.length} appointment{list.length > 1 ? 's' : ''}
                </h3>
                <div className="space-y-2">
                  {list.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
                    >
                      <div className="min-w-[200px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-emerald-500">
                            {timeLabel(a.startsAt)} – {endTimeLabel(a.startsAt, a.durationMins)}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[a.status]}`}
                          >
                            {STATUS_LABELS[a.status]}
                          </span>
                          {a.invoiceId && (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              Billed
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 font-bold text-zinc-900 dark:text-white">{a.service}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {a.customer.name}
                            {a.customer.phone ? ` · ${a.customer.phone}` : ''}
                          </span>
                          {a.staffName && <span>With: {a.staffName}</span>}
                        </p>
                        {a.notes && (
                          <p className="mt-1 text-xs italic text-zinc-500">{a.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => startEdit(a)}
                          title="Appointment edit karein"
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => sendWhatsApp(a)}
                          title="Confirmation WhatsApp par bhejein"
                          className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-[#1ebe5b]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </button>
                        <button
                          onClick={() => addToCalendar(a)}
                          title="Google Calendar mein save karein"
                          className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" /> Calendar
                        </button>
                        {a.status === 'SCHEDULED' && (
                          <button
                            onClick={() => setStatus(a, 'COMPLETED')}
                            title="Mark as completed"
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Done
                          </button>
                        )}
                        <button
                          onClick={() => createBill(a)}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        >
                          <Receipt className="h-3.5 w-3.5" /> Create Bill
                        </button>
                        <select
                          value={a.status}
                          onChange={(e) => setStatus(a, e.target.value as Appointment['status'])}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold text-zinc-700 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => remove(a)}
                          title="Delete appointment"
                          className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {mode === 'calendar' && loading && (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-emerald-500 dark:border-zinc-800" />
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
