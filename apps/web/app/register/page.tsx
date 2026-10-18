'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Eye, EyeOff, ArrowLeft, MailCheck } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const INPUT_CLASS =
  'mt-1 block w-full rounded-lg border border-zinc-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  // 'details' collects the form, 'otp' verifies the email before the account exists.
  const [step, setStep] = useState<'details' | 'otp'>('details');

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');

  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendOtp = async (isResend: boolean) => {
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/send-email-otp', { email });
      setStep('otp');
      setCode('');
      setResendIn(res.resendAfterSeconds ?? 60);
      setNotice(
        isResend
          ? `A new code was sent to ${email}.`
          : `We sent a 6-digit code to ${email}. Enter it below to continue.`,
      );
    } catch (err: any) {
      setError(err.message || 'Could not send the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const verification = await api.post('/auth/verify-email-otp', {
        email,
        code,
      });

      const res = await api.post('/auth/register', {
        businessName,
        ownerName,
        email,
        password,
        phone: phone || undefined,
        emailVerificationToken: verification.emailVerificationToken,
      });

      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4 py-12 transition-colors relative">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-8 shadow-xl dark:shadow-2xl backdrop-blur-xl transition-colors">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-3">
            {step === 'otp' ? (
              <MailCheck className="h-6 w-6" />
            ) : (
              <span className="text-2xl font-bold">B</span>
            )}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {step === 'otp' ? 'Verify Email' : 'Register Business'}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {step === 'otp'
              ? 'Enter the code we emailed you'
              : 'Launch your white label billing platform'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-600 dark:text-red-400">
            {error.includes(',') ? (
              <ul className="list-disc pl-5 space-y-1">
                {error.split(',').map((e, idx) => (
                  <li key={idx}>{e.trim()}</li>
                ))}
              </ul>
            ) : (
              error
            )}
          </div>
        )}

        {notice && !error && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            {notice}
          </div>
        )}

        {step === 'details' ? (
          <form onSubmit={handleDetailsSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Business Name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="e.g. Sharma Traders"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Owner Full Name *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="e.g. Rajesh Sharma"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
                placeholder="name@business.com"
              />
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                We&apos;ll email a 6-digit code to confirm this address.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone Number (e.g. 9876543210)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
                placeholder="e.g. 9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Password *</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 pl-4 pr-12 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50 mt-2 cursor-pointer shadow-sm"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">6-Digit Code *</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${INPUT_CLASS} text-center text-2xl font-semibold tracking-[0.5em]`}
                placeholder="------"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
              ) : (
                'Verify & Create Account'
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('details');
                  setError(null);
                  setNotice(null);
                }}
                className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Change details
              </button>

              <button
                type="button"
                disabled={loading || resendIn > 0}
                onClick={() => sendOtp(true)}
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already registered?{' '}
          <Link href="/login" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
