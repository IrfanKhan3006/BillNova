'use client';

import React from 'react';
import { ScrollText } from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import OrderDocumentWorkspace, {
  OrderDocumentConfig,
} from '../components/OrderDocumentWorkspace';
import { api } from '../lib/api';

const config: OrderDocumentConfig = {
  resource: 'purchase-orders',
  title: 'Purchase Orders',
  subtitle:
    'Order stock from a supplier, get it approved, and record the supplier bill when the goods arrive.',
  icon: ScrollText,
  numberField: 'purchaseOrderNumber',
  partyKind: 'vendor',
  partyLabel: 'Supplier',
  partyEndpoint: '/purchases/vendors',
  priceField: 'purchasePrice',
  statuses: [
    'DRAFT',
    'SENT',
    'APPROVED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CANCELLED',
  ],
  statusTone: {
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    SENT: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PARTIALLY_RECEIVED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    RECEIVED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
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
      placeholder: 'Within 30 days of invoice receipt',
    },
    {
      key: 'deliveryAddress',
      label: 'Delivery Address',
      placeholder: 'Where the supplier should deliver',
    },
    {
      key: 'termsAndConditions',
      label: 'Terms & Conditions',
      placeholder: 'Applicable taxes and conditions',
    },
  ],
  printTitle: 'PURCHASE ORDER',
  createLabel: 'New Purchase Order',
  actions: [
    {
      key: 'send',
      label: 'Mark as Sent',
      tone: 'neutral',
      enabledFor: (doc) => doc.status === 'DRAFT',
      run: (doc) => api.patch(`/purchase-orders/${doc.id}`, { status: 'SENT' }),
      successMessage: () => 'Purchase order marked as sent.',
    },
    {
      key: 'approve',
      label: 'Approve',
      enabledFor: (doc) => !doc.approvedAt && doc.status !== 'CANCELLED',
      confirm: (doc) => ({
        title: `Approve ${doc.purchaseOrderNumber}?`,
        message:
          'Your name and the approval date are recorded on the purchase order before it goes to the supplier.',
        confirmText: 'Approve',
      }),
      run: (doc) => api.post(`/purchase-orders/${doc.id}/approve`, {}),
      successMessage: () => 'Purchase order approved.',
    },
    {
      key: 'receive',
      label: 'Receive Goods',
      enabledFor: (doc) =>
        doc.status !== 'CANCELLED' && !doc.convertedPurchaseInvoiceId,
      confirm: (doc) => ({
        title: `Receive ${doc.purchaseOrderNumber}?`,
        message:
          'A supplier bill is recorded from these lines. Stock and the supplier balance update exactly as they would for a purchase entered by hand.',
        confirmText: 'Receive Goods',
      }),
      run: (doc) => api.post(`/purchase-orders/${doc.id}/receive`, {}),
      successMessage: (result) =>
        `Purchase bill ${result.purchaseNumber} recorded.`,
    },
    {
      key: 'cancel',
      label: 'Cancel Order',
      tone: 'neutral',
      enabledFor: (doc) =>
        !['CANCELLED', 'RECEIVED'].includes(doc.status) &&
        !doc.convertedPurchaseInvoiceId,
      confirm: (doc) => ({
        title: `Cancel ${doc.purchaseOrderNumber}?`,
        message: 'A cancelled purchase order can no longer be received.',
        confirmText: 'Cancel Order',
        danger: true,
      }),
      run: (doc) =>
        api.patch(`/purchase-orders/${doc.id}`, { status: 'CANCELLED' }),
      successMessage: () => 'Purchase order cancelled.',
    },
  ],
};

export default function PurchaseOrdersPage() {
  return (
    <SidebarLayout>
      <FeatureGate
        featureKey="purchaseOrdersEnabled"
        featureName="Purchase Orders"
      >
        <OrderDocumentWorkspace config={config} />
      </FeatureGate>
    </SidebarLayout>
  );
}
