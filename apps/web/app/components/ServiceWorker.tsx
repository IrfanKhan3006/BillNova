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

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
