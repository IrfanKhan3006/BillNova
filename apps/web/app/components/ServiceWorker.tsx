'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, which is what makes the site installable as an
 * app. Mounted once in the root layout; renders nothing.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unregistered SW only costs the offline page; never block the app.
      });
    };

    /*
     * When a new worker takes over, the page is still showing the previous
     * build's JavaScript — which is how a stale string survives an ordinary
     * refresh. Reload once, the first time control changes, so people always
     * end up on the deployed build without being told to hard refresh.
     */
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
