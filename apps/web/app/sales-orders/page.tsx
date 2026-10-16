'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import OrderDocumentWorkspace, {
  OrderDocumentConfig,
} from '../components/OrderDocumentWorkspace';
import { api } from '../lib/api';

const config: OrderDocumentConfig = {
  resource: 'sales-orders',
  title: 'Sales Orders',
  subtitle:
    'Confirm what a customer has ordered, track delivery, and raise the invoice when it ships.',
  icon: ClipboardList,
  numberField: 'salesOrderNumber',
  partyKind: 'customer',
  partyLabel: 'Customer',
  partyEndpoint: '/customers',
  priceField: 'salesPrice',
  statuses: [
    'DRAFT',
    'CONFIRMED',
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'INVOICED',
    'CANCELLED',
  ],
  statusTone: {
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    CONFIRMED: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    PARTIALLY_DELIVERED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DELIVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    INVOICED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  secondaryDateField: {
    key: 'expectedDeliveryDate',
    label: 'Expected Delivery',
  },
  termsFields: [
    {
      key: 'paymentTerms',
      label: 'Payment Terms',
      placeholder: '30 days, subject to agreement',
    },
    {
      key: 'deliveryTerms',
      label: 'Delivery Terms',
      placeholder: 'As agreed',
    },
  ],
  printTitle: 'SALES ORDER',
  createLabel: 'New Sales Order',
  defaultCreateStatus: 'CONFIRMED',
  actions: [
    {
      key: 'dispatch',
      label: 'Mark as Delivered',
      tone: 'neutral',
      enabledFor: (doc) =>
        ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED'].includes(doc.status),
      run: (doc) => api.patch(`/sales-orders/${doc.id}`, { status: 'DELIVERED' }),
      successMessage: () => 'Sales order marked as delivered.',
    },
    {
      key: 'invoice',
      label: 'Create Invoice',
      enabledFor: (doc) =>
        doc.status !== 'CANCELLED' && !doc.convertedInvoiceId,
      confirm: (doc) => ({
        title: `Bill ${doc.salesOrderNumber}?`,
        message:
          'An invoice is created from these order lines. Stock and the customer balance update exactly as they would for a bill raised by hand.',
        confirmText: 'Create Invoice',
      }),
      run: (doc) => api.post(`/sales-orders/${doc.id}/invoice`, {}),
      successMessage: (result) => `Invoice ${result.invoiceNumber} created.`,
    },
    {
      key: 'cancel',
      label: 'Cancel Order',
      tone: 'neutral',
      enabledFor: (doc) =>
        !['CANCELLED', 'INVOICED'].includes(doc.status) &&
        !doc.convertedInvoiceId,
      confirm: (doc) => ({
        title: `Cancel ${doc.salesOrderNumber}?`,
        message: 'A cancelled order can no longer be billed.',
        confirmText: 'Cancel Order',
        danger: true,
      }),
      run: (doc) => api.patch(`/sales-orders/${doc.id}`, { status: 'CANCELLED' }),
      successMessage: () => 'Sales order cancelled.',
    },
  ],
};

export default function SalesOrdersPage() {
  return (
    <SidebarLayout>
      <FeatureGate featureKey="salesOrdersEnabled" featureName="Sales Orders">
        <OrderDocumentWorkspace config={config} />
      </FeatureGate>
    </SidebarLayout>
  );
}
