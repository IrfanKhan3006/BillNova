'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { BRAND_NAME } from '../lib/brand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Install app" entry. Android/desktop Chrome hand us a beforeinstallprompt
 * event we can fire on a click; iOS has no such API, so Safari users get the
 * Add to Home Screen steps instead. Hidden once the app is already installed.
 */
export default function InstallAppButton({ className = '' }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!promptEvent && !isIos) return null;

  const handleClick = async () => {
    if (isIos && !promptEvent) {
      setShowIosHelp(true);
      return;
    }
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          className ||
          'flex items-center gap-2 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition'
        }
      >
        <Download className="h-4 w-4" />
        Install App
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Add {BRAND_NAME} to your Home Screen
              </h2>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <li className="flex gap-2">
                <span className="font-bold text-emerald-500">1.</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tap <Share className="h-4 w-4 inline" /> Share at the bottom of Safari
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-500">2.</span>
                <span>Scroll down and choose <strong>Add to Home Screen</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-500">3.</span>
                <span>Tap <strong>Add</strong> — the app opens full screen, like any other app</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
