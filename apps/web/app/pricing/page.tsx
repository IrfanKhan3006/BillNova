'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { COMPARISON, PLANS, type BillingPeriod } from '../lib/plans';
import '../landing-page/landing.css';
import './pricing.css';
import ThemeToggle from '../components/ThemeToggle';

export default function PricingPage() {
  const { isAuthenticated } = useAuthStore();
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  return (
    <div className="landing-page-root">
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="ambient-glow glow-3"></div>

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
            <Link
              href={isAuthenticated ? '/dashboard' : '/register'}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ padding: '8rem 0 2rem' }}>
        <div className="container" style={{ maxWidth: 760, textAlign: 'center' }}>
          <div className="hero-badge" style={{ margin: '0 auto 1.5rem', display: 'inline-flex' }}>
            <span></span> Plans &amp; Pricing
          </div>
          <h1
            className="gradient-text"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(2.1rem, 5.5vw, 3.5rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}
          >
            One yearly plan for your <span className="emerald-text">whole billing desk</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 560, margin: '0 auto 2rem' }}>
            Invoicing, inventory, sales, purchase and reports in a single platform. Start where your business is
            today and upgrade whenever you outgrow it.
          </p>

          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={period === 'yearly'} onClick={() => setPeriod('yearly')}>
              Yearly
            </button>
            <button type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>
              Monthly
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            Billing is yearly. Monthly figures are shown only for comparison.
          </p>
        </div>
      </section>

      {/* PLAN CARDS */}
      <section style={{ padding: '3rem 0 2rem' }}>
        <div className="container">
          <div className="plans-grid">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <article
                  key={plan.id}
                  className={`glass-card plan-card${plan.featured ? ' featured' : ''}`}
                >
                  {plan.featured && <span className="plan-badge">Most popular</span>}
                  <div className="plan-icon">
                    <Icon style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <h2>{plan.name}</h2>
                    <span className="plan-tier">{plan.tier}</span>
                  </div>
                  <div className="plan-price">
                    <span className="amount">{plan.price[period]}</span>
                    <span className="period">{period === 'yearly' ? '/ year' : '/ month'}</span>
                  </div>
                  <p className="plan-blurb">{plan.blurb}</p>
                  <Link
                    href={isAuthenticated ? '/billing' : '/register'}
                    className={`btn ${plan.featured ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%' }}
                  >
                    Choose {plan.name}
                  </Link>
                  <p className="plan-divider">{plan.featureHeading}</p>
                  <ul className="plan-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check style={{ width: 15, height: 15 }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {plan.carry && <p className="plan-carry">{plan.carry}</p>}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section style={{ padding: '4rem 0 2rem' }}>
        <div className="container">
          <div className="section-header" style={{ marginBottom: '2.5rem' }}>
            <h2 className="gradient-text">Compare the plans</h2>
            <p>Every module BillNova ships, and the plan it belongs to.</p>
          </div>
          <div className="compare-wrapper">
            <table className="compare-table">
              <caption>Yearly plans · prices exclusive of applicable GST</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Starter</th>
                  <th scope="col">Business</th>
                  <th scope="col">Premium</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(({ group, rows }) => (
                  <React.Fragment key={group}>
                    <tr className="group-row">
                      <th scope="colgroup" colSpan={4}>
                        {group}
                      </th>
                    </tr>
                    {rows.map(({ feature, plans }) => (
                      <tr key={feature}>
                        <th scope="row">{feature}</th>
                        {plans.map((included, index) => (
                          <td key={index} className={included ? 'has-feature' : 'no-feature'}>
                            {included ? '✓' : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CUSTOMIZATION CTA */}
      <section className="cta-banner">
        <div className="container">
          <div className="cta-box">
            <div className="hero-badge" style={{ margin: '0 auto 1.5rem', display: 'inline-flex' }}>
              <span></span> Customizable solution
            </div>
            <h2 className="gradient-text">Need something specific?</h2>
            <p>
              We can customize the Premium plan around how your business actually works — extra modules, your own
              invoice formats, or a different approval flow. Talk to our team and we will scope a tailored setup.
            </p>
            <Link href="/contact" className="btn btn-primary">
              Contact our team
            </Link>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: '2rem' }}>
            All plans are billed per business. Your invoices, customers and stock carry over on every upgrade.
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
