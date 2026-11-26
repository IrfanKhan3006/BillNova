import type { MetadataRoute } from 'next';
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE, BRAND_THEME_COLOR } from './lib/brand';

/**
 * Served at /manifest.webmanifest. Two jobs:
 *
 *  1. It is what makes the site installable ("Install app" / "Add to Home
 *     Screen"), so the phone opens it full-screen with no address bar.
 *  2. Bubblewrap reads it to generate the Android TWA project, so the name,
 *     colours and icons here are what a Play Store build would wear.
 *
 * The icons live in public/icons and are part of the live deploy, like the
 * favicon — they carry the live logo, which is deliberately not in git.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    // Relative, so the same manifest is correct on the live host and on a dev copy.
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: BRAND_THEME_COLOR,
    lang: 'en-IN',
    dir: 'ltr',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops launcher icons to the device's own shape; this one keeps
      // the mark clear of that crop.
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the installed icon to jump straight into a task.
    shortcuts: [
      { name: 'Create Invoice', short_name: 'Bill', url: '/billing', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Invoices', short_name: 'Invoices', url: '/invoices', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Customers', short_name: 'Customers', url: '/customers', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
