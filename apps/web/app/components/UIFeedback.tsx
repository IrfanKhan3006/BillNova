'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export default function UIFeedback() {
  const { toasts, removeToast, confirmState, closeConfirm } = useUIStore();

  // Handle escape key to close confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmState.isOpen) {
        closeConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState.isOpen, closeConfirm]);

  return (
    <>
      {/* ─── TOAST NOTIFICATIONS CONTAINER ───────────────────────────────── */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none no-print px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-4 ${
                isSuccess
                  ? 'bg-zinc-900/95 border-emerald-500/40 text-zinc-100 shadow-emerald-500/10'
                  : isError
                  ? 'bg-zinc-900/95 border-red-500/40 text-zinc-100 shadow-red-500/10'
                  : 'bg-zinc-900/95 border-purple-500/40 text-zinc-100 shadow-purple-500/10'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                )}
                {isError && (
                  <AlertCircle className="h-5 w-5 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                )}
                {!isSuccess && !isError && (
                  <Info className="h-5 w-5 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
                )}
              </div>

              <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed pr-2">
                {t.message}
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-zinc-800"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── CONFIRMATION MODAL ───────────────────────────────────────────── */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 no-print">
          <div
            className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  confirmState.danger
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                }`}
              >
                {confirmState.danger ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <ShieldAlert className="h-6 w-6" />
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {confirmState.title || 'Confirm Action'}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition cursor-pointer"
              >
                {confirmState.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeConfirm(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-lg cursor-pointer ${
                  confirmState.danger
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                }`}
              >
                {confirmState.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
