'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { api } from '../lib/api';
import { toast, showConfirm } from '../store/uiStore';
import { UserPlus, Trash2, Key, Lock, ShieldCheck } from 'lucide-react';

interface TeamUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

interface TeamData {
  enabled: boolean;
  maxUsers: number;
  emailDomain: string;
  users: TeamUser[];
}

const inputClass =
  'mt-1.5 block w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-emerald-500 focus:outline-none';

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = async () => {
    try {
      setData(await api.get('/users'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load team users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await api.post('/users', form);
      toast.success(`User created. Login: ${user.email}`);
      setForm({ name: '', username: '', password: '' });
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassword = async (id: string) => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      await api.patch(`/users/${id}/password`, { password: newPassword });
      toast.success('Password updated.');
      setPasswordFor(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password.');
    }
  };

  const handleRemove = async (u: TeamUser) => {
    const ok = await showConfirm({
      title: 'Remove User',
      message: `Remove ${u.name} (${u.email})? They will not be able to log in anymore. Bills they created stay.`,
      confirmText: 'Remove User',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('User removed.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove user.');
    }
  };

  const limitReached = !!data && data.users.length >= data.maxUsers;

  return (
    <SidebarLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Team Users</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">
            Give your team their own login. Users can only create and print sales bills and purchase invoices.
          </p>
        </div>

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-emerald-500 border-zinc-200 dark:border-zinc-800" />
          </div>
        ) : !data?.enabled ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
            <Lock className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-3 font-bold text-zinc-900 dark:text-white">Available after plan activation</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Team users are not part of the free trial.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Create form */}
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-6 space-y-4 h-fit"
            >
              <h3 className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                <UserPlus className="h-5 w-5 text-emerald-500" /> Add User
              </h3>
              {limitReached ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  You have reached the limit of {data.maxUsers} users. Remove one to add another.
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Full Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputClass}
                      placeholder="Ravi Kumar"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Username</label>
                    <div className="mt-1.5 flex items-stretch overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 focus-within:border-emerald-500">
                      <input
                        required
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })
                        }
                        className="min-w-0 flex-1 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none"
                        placeholder="ravi"
                      />
                      <span className="flex items-center bg-zinc-100 dark:bg-zinc-900 px-3 text-xs font-mono text-zinc-500">
                        @{data.emailDomain}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Password</label>
                    <input
                      required
                      type="password"
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={inputClass}
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </>
              )}
            </form>

            {/* List */}
            <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
                <span className="font-bold text-zinc-900 dark:text-white">Users</span>
                <span className="text-xs font-semibold text-zinc-500">
                  {data.users.length} / {data.maxUsers} used
                </span>
              </div>
              {data.users.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-500">No users yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.users.map((u) => (
                    <li key={u.id} className="px-6 py-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">{u.name}</p>
                          <p className="font-mono text-xs text-zinc-500">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" /> User
                          </span>
                          <button
                            onClick={() => {
                              setPasswordFor(passwordFor === u.id ? null : u.id);
                              setNewPassword('');
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          >
                            <Key className="h-3.5 w-3.5" /> Password
                          </button>
                          <button
                            onClick={() => handleRemove(u)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                      {passwordFor === u.id && (
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={`${inputClass} mt-0`}
                            placeholder="New password (min 6)"
                          />
                          <button
                            onClick={() => handlePassword(u.id)}
                            className="rounded-lg bg-emerald-500 px-4 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
