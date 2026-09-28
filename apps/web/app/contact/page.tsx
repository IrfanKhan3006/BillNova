'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Phone, Mail, MessageCircle, Copy, Check, ArrowLeft } from 'lucide-react';
import '../landing-page/landing.css';
import ThemeToggle from '../components/ThemeToggle';

const PHONE = '+91-88849-79997';
const PHONE_RAW = '918884979997';
const EMAIL = 'support@billcrafts.com';

export default function ContactPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1500);
  };

  const cards = [
    { label: 'Call us', value: PHONE, href: `tel:+${PHONE_RAW}`, icon: Phone },
    { label: 'WhatsApp', value: PHONE, href: `https://wa.me/${PHONE_RAW}`, icon: MessageCircle },
    { label: 'Email us', value: EMAIL, href: `mailto:${EMAIL}`, icon: Mail },
  ];

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
              <ArrowLeft style={{ width: 16, height: 16 }} /> Home
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section style={{ padding: '6rem 0 5rem' }}>
        <div className="container" style={{ maxWidth: 880, textAlign: 'center' }}>
          <div className="hero-badge" style={{ margin: '0 auto 1.5rem', display: 'inline-flex' }}>
            <span className="badge-dot"></span> WE USUALLY REPLY WITHIN A FEW HOURS
          </div>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem' }}>
            Let&apos;s <span className="emerald-text">talk</span>.
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 560, margin: '0 auto 3rem' }}>
            Questions about plans, setup or your invoices? Reach out any way you like — a real person will answer.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', textAlign: 'left' }}>
            {cards.map(({ label, value, href, icon: Icon }) => (
              <div key={label} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-glow)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                  <Icon style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 4, wordBreak: 'break-all' }}>{value}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                    className="btn btn-primary" style={{ flex: 1, padding: '0.55rem 1rem', fontSize: '0.85rem', justifyContent: 'center' }}>
                    Open
                  </a>
                  <button type="button" onClick={() => copy(value)} className="btn btn-secondary"
                    aria-label={`Copy ${label}`} style={{ padding: '0.55rem 0.8rem' }}>
                    {copied === value ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
