import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AuthProvider from './components/AuthProvider';
import UIFeedback from './components/UIFeedback';
import ServiceWorker from './components/ServiceWorker';
import { BRAND_NAME, BRAND_THEME_COLOR } from './lib/brand';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BillNova - White Label Billing ERP Platform',
  description: 'Modern Cloud-Based SaaS Billing & ERP Platform',
  applicationName: BRAND_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  /*
   * iOS before 16.4 ignores `display: standalone` in the manifest. Without
   * this, Add to Home Screen still makes an icon, but tapping it reopens
   * Safari complete with the address bar, so the install looks like it failed.
   */
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: 'black-translucent',
  },
  other: {
    // The legacy tag older iOS versions actually read.
    'apple-mobile-web-app-capable': 'yes',
  },
};

/*
 * themeColor paints the status bar in the brand green once the app runs
 * installed; viewportFit lets the layout reach under the notch, which the
 * safe-area padding in globals.css then clears.
 */
export const viewport: Viewport = {
  themeColor: BRAND_THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('billnova_theme');
                if (stored === 'DARK') {
                  document.documentElement.classList.remove('light');
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased font-sans flex flex-col">
        <AuthProvider>
          {children}
          <UIFeedback />
        </AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
