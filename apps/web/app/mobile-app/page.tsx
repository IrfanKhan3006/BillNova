'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle, Smartphone } from 'lucide-react';
import InstallApp from '../components/InstallApp';
import { BRAND_NAME } from '../lib/brand';
import '../landing-page/landing.css';
import ThemeToggle from '../components/ThemeToggle';

const PERKS = [
  'One tap from your home screen, with no browser bar in the way',
  'Create bills, take payments and check stock on the phone',
  'Shortcuts straight to Create Invoice, Invoices and Customers',
  'A proper offline page instead of a browser error when the signal drops',
  'Updates arrive on their own — nothing to download again',
];

export default function MobileAppPage() {
  return (
    <div className="landing-page-root">
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      <header>
        <div className="container nav-container">
          <Link href="/" className="logo">
            <div className="logo-box">B</div>
            <span className="logo-text">BillNova</span>
          </Link>
          <div className="nav-actions" style={{ display: 'flex' }}>
            <Link href="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Home
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section style={{ padding: '7rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="hero-badge" style={{ display: 'inline-flex' }}>
            <span></span> Mobile App
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              margin: '1.25rem 0 1rem',
            }}
          >
            <Smartphone style={{ width: 34, height: 34, verticalAlign: '-4px', marginRight: 10, color: 'var(--primary)' }} />
            {BRAND_NAME} on your phone
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 560 }}>
            {BRAND_NAME} installs straight onto your phone or laptop. It gets its own icon on the
            home screen and opens full screen, with no browser bar — exactly like an app from the
            store.
          </p>

          <div className="glass-card" style={{ marginTop: '2.5rem', padding: '1.75rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Install it now
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
              On Android and on a laptop the button below installs it. On an iPhone, Apple allows no
              install button at all — the steps for Safari appear instead.
            </p>
            <InstallApp />
          </div>

          <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.75rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
              What you get
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {PERKS.map((perk) => (
                <li key={perk} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  <CheckCircle style={{ width: 17, height: 17, marginTop: 3, flex: '0 0 auto', color: 'var(--primary)' }} />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Trouble installing? <Link href="/contact" style={{ color: 'var(--primary)', fontWeight: 600 }}>Contact our team</Link> and tell us which phone you are using.
          </p>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-bottom">
            <p>&copy; 2026 BillNova ERP Technologies. All rights reserved.</p>
            <p>Designed with ❤️ for modern businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
