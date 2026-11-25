// Shared plan data for the landing page's pricing section and the /pricing page.
import type React from 'react';
import { BarChart3, Building2, FileText } from 'lucide-react';

export type BillingPeriod = 'yearly' | 'monthly';

export interface Plan {
  id: string;
  name: string;
  tier: string;
  price: Record<BillingPeriod, string>;
  blurb: string;
  featureHeading: string;
  features: string[];
  carry?: string;
  featured?: boolean;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tier: 'Essential Business Management',
    price: { yearly: '₹3,000', monthly: '₹300' },
    blurb:
      'For startups, freelancers and small shops that need clean invoicing and day-to-day business control.',
    featureHeading: '11 features included',
    features: [
      'Dashboard',
      'Create invoice & invoice management',
      'Advance billing',
      'Appointment management',
      'Customer management',
      'Products & inventory management',
      'Payment management',
      'Revenue tracking',
      'Business reports',
      'Business settings',
    ],
    icon: FileText,
  },
  {
    id: 'business',
    name: 'Business',
    tier: 'Complete Business Management',
    price: { yearly: '₹6,000', monthly: '₹600' },
    blurb:
      'For growing companies running the full sales, purchase and financial cycle with a team.',
    featureHeading: '16 features — everything in Starter, plus',
    features: [
      'Quotation management',
      'Sales order management',
      'Purchase order management',
      'Purchase invoice management',
      'Team user management',
    ],
    carry: 'All 11 Starter features stay included.',
    featured: true,
    icon: BarChart3,
  },
  {
    id: 'premium',
    name: 'Premium',
    tier: 'Advanced Business Management',
    price: { yearly: '₹10,000', monthly: '₹1,000' },
    blurb:
      'For established businesses running several businesses under one login, with a setup tailored to them.',
    featureHeading: '21 features — everything in Business, plus',
    features: [
      'Manage multiple businesses',
      'Customizable features as per requirement',
      'Personalized solutions for your workflow',
      'Flexible configuration and setup',
      'Dedicated support for customization',
    ],
    carry: 'Includes all 16 Business features.',
    icon: Building2,
  },
];

export const COMPARISON: { group: string; rows: { feature: string; plans: [boolean, boolean, boolean] }[] }[] = [
  {
    group: 'Core billing',
    rows: [
      { feature: 'Dashboard', plans: [true, true, true] },
      { feature: 'Invoicing', plans: [true, true, true] },
      { feature: 'Advance bills', plans: [true, true, true] },
      { feature: 'Appointments', plans: [true, true, true] },
      { feature: 'Customers', plans: [true, true, true] },
      { feature: 'Products & inventory', plans: [true, true, true] },
      { feature: 'Payments & revenue', plans: [true, true, true] },
      { feature: 'Reports', plans: [true, true, true] },
    ],
  },
  {
    group: 'Sales & purchase',
    rows: [
      { feature: 'Quotations', plans: [false, true, true] },
      { feature: 'Sales orders', plans: [false, true, true] },
      { feature: 'Purchase orders', plans: [false, true, true] },
      { feature: 'Purchase invoices', plans: [false, true, true] },
      { feature: 'Team users', plans: [false, true, true] },
    ],
  },
  {
    group: 'Multi-business & customization',
    rows: [
      { feature: 'Manage multiple businesses', plans: [false, false, true] },
      { feature: 'Customizable features', plans: [false, false, true] },
      { feature: 'Personalized solutions', plans: [false, false, true] },
      { feature: 'Flexible configuration', plans: [false, false, true] },
      { feature: 'Dedicated support', plans: [false, false, true] },
    ],
  },
];
