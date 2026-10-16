'use client';

import React from 'react';
import { FileSignature } from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import OrderDocumentWorkspace, {
  OrderDocumentConfig,
} from '../components/OrderDocumentWorkspace';
import { api } from '../lib/api';

const config: OrderDocumentConfig = {
  resource: 'quotations',
  title: 'Quotations',
  subtitle:
    'Quote a price to a customer, track its validity, and turn an accepted quote into a sales order.',
  icon: FileSignature,
  numberField: 'quotationNumber',
  partyKind: 'customer',
  partyLabel: 'Customer',
  partyEndpoint: '/customers',
  priceField: 'salesPrice',
  statuses: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'],
  statusTone: {
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    SENT: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACCEPTED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    EXPIRED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CONVERTED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  secondaryDateField: { key: 'validUntil', label: 'Valid Until' },
  termsFields: [
    {
      key: 'paymentTerms',
      label: 'Payment Terms',
      placeholder: '30 days, subject to agreement',
    },
    {
      key: 'deliveryTerms',
      label: 'Delivery Terms',
      placeholder: 'As mutually agreed',
    },
  ],
  printTitle: 'SALES QUOTATION',
  createLabel: 'New Quotation',
  actions: [
    {
      key: 'send',
      label: 'Mark as Sent',
      tone: 'neutral',
      enabledFor: (doc) => doc.status === 'DRAFT',
      run: (doc) => api.patch(`/quotations/${doc.id}`, { status: 'SENT' }),
      successMessage: () => 'Quotation marked as sent.',
    },
    {
      key: 'accept',
      label: 'Customer Accepted',
      tone: 'neutral',
      enabledFor: (doc) => ['DRAFT', 'SENT'].includes(doc.status),
      run: (doc) => api.patch(`/quotations/${doc.id}`, { status: 'ACCEPTED' }),
      successMessage: () => 'Quotation accepted.',
    },
    {
      key: 'reject',
      label: 'Customer Declined',
      tone: 'neutral',
      enabledFor: (doc) => ['DRAFT', 'SENT'].includes(doc.status),
      run: (doc) => api.patch(`/quotations/${doc.id}`, { status: 'REJECTED' }),
      successMessage: () => 'Quotation marked as declined.',
    },
    {
      key: 'convert',
      label: 'Create Sales Order',
      enabledFor: (doc) =>
        !['CONVERTED', 'REJECTED'].includes(doc.status) &&
        !doc.convertedSalesOrderId,
      confirm: (doc) => ({
        title: `Create a sales order from ${doc.quotationNumber}?`,
        message:
          'The quoted items and terms are copied to a new sales order, and this quotation is closed as converted.',
        confirmText: 'Create Sales Order',
      }),
      run: (doc) =>
        api.post('/sales-orders/from-quotation', { quotationId: doc.id }),
      successMessage: (result) => `Sales order ${result.salesOrderNumber} created.`,
    },
  ],
};

export default function QuotationsPage() {
  return (
    <SidebarLayout>
      <FeatureGate featureKey="quotationsEnabled" featureName="Quotations">
        <OrderDocumentWorkspace config={config} />
      </FeatureGate>
    </SidebarLayout>
  );
}
