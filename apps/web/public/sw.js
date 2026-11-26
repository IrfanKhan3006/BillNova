/*
 * BillCraft / BillNova service worker.
 *
 * Deliberately small. Its only jobs are to make the site installable and to
 * show a real page instead of the browser's offline dinosaur. It is NOT an
 * offline-first cache: invoices, stock and payments are live data that must
 * never be served stale.
 *
 *  1. Anything under /api, and every non-GET request, is left completely
 *     alone — the SW does not call respondWith(), so those go to the network
 *     exactly as if it were not installed.
 *  2. Next's build output under /_next/static is content-hashed, so a given
 *     URL's bytes can never change: safe to serve cache-first.
 *  3. Page navigations are network-first, falling back to a cached shell only
 *     when the network genuinely fails.
 *
 * Bump VERSION to roll the cache; old caches are dropped on activate.
 */

const VERSION = 'bc-v1';
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Other origins (the API lives on api.billcrafts.com) are never touched.
  if (url.origin !== self.location.origin) return;

  // Never cache anything that bills, prices, pays or is per-user.
  if (url.pathname.startsWith('/api/')) return;

  // Content-hashed build output: cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy)).catch(() => undefined);
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page loads: network first, offline page only when the network fails.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit || Response.error()),
      ),
    );
  }
});
