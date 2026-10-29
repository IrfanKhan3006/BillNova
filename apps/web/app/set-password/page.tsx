'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from '../components/ThemeToggle';
import { Eye, EyeOff, KeyRound, ShieldCheck, Loader2 } from 'lucide-react';

interface ResetTarget {
  email: string;
  name: string;
  businessName?: string | null;
  expiresAt: string;
}

/**
 * Opened from the one-time link a Super Admin hands to a business. The email is
 * fixed by the link (never typed), the user only chooses a password, and a
 * successful save logs them straight in.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || '';
  const setAuth = useAuthStore((state) => state.setAuth);

  const [target, setTarget] = useState<ResetTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTarget = useCallback(async () => {
    if (!token) {
      setLinkError('This link is incomplete. Please ask for a new one.');
      setLoading(false);
      return;
    }
    try {
      const data = await api.get(`/auth/password-reset/${encodeURIComponent(token)}`);
      setTarget(data);
    } catch (err: any) {
      setLinkError(err.message || 'This password link is no longer valid.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTarget();
  }, [loadTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Both passwords must match.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/auth/password-reset', { token, password });
      // Straight in — the point of the link is that no second login is needed.
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push(res.user.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Could not set the password. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 transition-colors dark:bg-zinc-950">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl transition-colors dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Set a new password
          </h1>
          {target && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {target.businessName ? `${target.businessName} — ` : ''}
              choose a password for your account.
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : linkError ? (
          <div className="space-y-5 text-center">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              {linkError}
            </div>
            <p className="text-xs text-zinc-500">
              Reset links expire for safety. Ask the BillCraft team for a fresh link.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* The email comes from the link itself, so it cannot be changed here. */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Account
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-slate-100 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="truncate font-mono text-sm text-zinc-700 dark:text-zinc-200">
                  {target?.email}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                New Password
              </label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="block w-full rounded-lg border border-zinc-300 bg-slate-50 px-4 py-3 pr-11 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                className="mt-2 block w-full rounded-lg border border-zinc-300 bg-slate-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Password & Continue'}
            </button>

            <p className="text-center text-xs text-zinc-500">
              Save hote hi aap seedha apne dashboard mein pahunch jayenge. Baaki devices logout ho
              jayenge.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
