'use client';

import { useEffect, useState } from 'react';
import { Apple, Check, Download, Share } from 'lucide-react';
import { BRAND_NAME } from '../lib/brand';

/** Chrome's install event. Not in the DOM lib, because it is Chromium-only. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Mode =
  | 'loading'
  | 'installed' // already running as an installed app
  | 'prompt' // the browser offered an install prompt we can fire
  | 'ios' // Safari: no API, so show the Add to Home Screen steps
  | 'unavailable'; // nothing we can do from here

/**
 * The "Install App" control.
 *
 * Three platforms, three different realities:
 *
 *  - **Android / desktop Chrome and Edge** — fire the browser's own
 *    `beforeinstallprompt`. Chrome's mini-infobar is easy to miss, so we
 *    capture the event and show a button people can actually see.
 *  - **iOS Safari** — Apple exposes no install API at all. The only route is
 *    the share sheet, so show those steps instead of a button that cannot work.
 *  - **Anything else** — say where to open the site instead of failing quietly.
 *
 * `compact` renders the sidebar-sized button; the full version is what the
 * /mobile-app page shows.
 */
export default function InstallApp({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('loading');
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari's own flag for a home-screen app.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setMode('installed');
      return;
    }

    const ua = window.navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setMode('ios');
      return;
    }

    // Chrome fires this only once it considers the site installable, and only
    // if it is not installed already — so its absence is itself information.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setMode('prompt');
    };
    const onInstalled = () => setMode('installed');

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // If the event has not arrived shortly after load, it is not coming.
    const t = setTimeout(() => setMode((m) => (m === 'loading' ? 'unavailable' : m)), 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(t);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use: Chrome will not let the same one fire twice.
    setDeferred(null);
    setMode(outcome === 'accepted' ? 'installed' : 'unavailable');
  };

  // Render nothing until we know which case we are in, so the control never
  // flips states in front of the user.
  if (mode === 'loading') return null;

  // ---- compact (sidebar / drawer) -----------------------------------------
  if (compact) {
    if (mode === 'installed' || mode === 'unavailable') return null;

    return (
      <>
        <button
          type="button"
          onClick={() => (mode === 'ios' ? setShowIosSteps(true) : install())}
          className={
            className ||
            'flex items-center gap-2 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition'
          }
        >
          <Download className="h-4 w-4" />
          Install App
        </button>

        {showIosSteps && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl">
              <IosSteps />
              <button
                type="button"
                onClick={() => setShowIosSteps(false)}
                className="mt-4 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ---- full (the /mobile-app page) ----------------------------------------
  const btn =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-zinc-950 shadow-sm transition-colors hover:bg-emerald-400';

  if (mode === 'installed') {
    return (
      <p className={`inline-flex items-center gap-2 text-sm font-semibold text-emerald-500 ${className}`}>
        <Check className="h-4.5 w-4.5" /> You&apos;re using the {BRAND_NAME} app
      </p>
    );
  }

  if (mode === 'prompt') {
    return (
      <button type="button" onClick={install} className={`${btn} ${className}`}>
        <Download className="h-4.5 w-4.5" /> Install App
      </button>
    );
  }

  if (mode === 'ios') {
    return (
      <div
        className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 text-sm ${className}`}
      >
        <IosSteps />
      </div>
    );
  }

  return (
    <p className={`text-sm text-zinc-500 ${className}`}>
      Open this site in Chrome on your phone to install the app.
    </p>
  );
}

/**
 * iOS instructions. Numbered, and explicit that the Share control belongs to
 * Safari and not to this page — Safari also hides its toolbar while you
 * scroll, which is why step 1 is about getting the toolbar back.
 */
function IosSteps() {
  return (
    <>
      <p className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
        <Apple className="h-4.5 w-4.5" /> Install on iPhone or iPad
      </p>
      <ol className="mt-3 space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
        <li>
          <strong className="text-zinc-900 dark:text-white">1.</strong> Tap the address bar at the
          bottom of the screen. Safari&apos;s toolbar slides back up — it hides itself while you
          scroll.
        </li>
        <li>
          <strong className="text-zinc-900 dark:text-white">2.</strong> In <em>that</em> toolbar —
          Safari&apos;s own, not this page — tap the Share button:
          <span className="mx-1 inline-flex h-6 w-6 translate-y-1 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
            <Share className="h-3 w-3" />
          </span>
          a square with an arrow pointing up.
        </li>
        <li>
          <strong className="text-zinc-900 dark:text-white">3.</strong> Scroll down the list and
          choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
      </ol>
      <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2.5 text-[13px] text-amber-900 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-500/20">
        There is no download on iPhone — Apple does not let any website install itself. Adding it to
        the home screen <em>is</em> the install. Open it from the new icon afterwards and it runs
        full screen.
      </p>
    </>
  );
}
