'use client';

import React from 'react';
import { Truck } from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import OrderDocumentWorkspace, {
  OrderDocumentConfig,
} from '../components/OrderDocumentWorkspace';
import { api } from '../lib/api';

const config: OrderDocumentConfig = {
  resource: 'challans',
  title: 'Delivery Challans',
  subtitle:
    'Send goods out before the bill — a delivery, job work, a sample or returnable packaging. Stock leaves on dispatch, and the invoice raised later will not deduct it twice.',
  icon: Truck,
  numberField: 'challanNumber',
  partyKind: 'customer',
  partyLabel: 'Customer',
  partyEndpoint: '/customers',
  priceField: 'salesPrice',
  statuses: ['DRAFT', 'DISPATCHED', 'DELIVERED', 'INVOICED', 'CANCELLED'],
  statusTone: {
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    DISPATCHED: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    DELIVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    INVOICED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  referenceField: {
    key: 'salesOrderId',
    label: 'Against Sales Order',
    endpoint: '/sales-orders',
    numberField: 'salesOrderNumber',
    createFromPath: 'from-sales-order',
    hint: 'Picking an order copies its lines in. Trim the lines for a part dispatch.',
  },
  choiceFields: [
    {
      key: 'challanType',
      label: 'Challan Type',
      defaultValue: 'DELIVERY',
      options: [
        { value: 'DELIVERY', label: 'Delivery' },
        { value: 'JOB_WORK', label: 'Job work' },
        { value: 'SAMPLE', label: 'Sample' },
        { value: 'RETURNABLE', label: 'Returnable' },
      ],
    },
  ],
  termsFields: [
    {
      key: 'vehicleNumber',
      label: 'Vehicle Number',
      placeholder: 'MH 12 AB 1234',
    },
    {
      key: 'despatchedThrough',
      label: 'Despatched Through',
      placeholder: 'Own vehicle / transporter name',
    },
    {
      key: 'destination',
      label: 'Destination',
      placeholder: 'Pune',
    },
    {
      key: 'termsOfDelivery',
      label: 'Terms of Delivery',
      placeholder: 'Door delivery',
    },
  ],
  printTitle: 'DELIVERY CHALLAN',
  createLabel: 'New Delivery Challan',
  documentKind: 'DELIVERY_CHALLAN',
  printMeta: (doc) =>
    doc.challanType
      ? [{ label: 'Type', value: doc.challanType.replace(/_/g, ' ') }]
      : [],
  actions: [
    {
      key: 'dispatch',
      label: 'Mark as Dispatched',
      enabledFor: (doc) => doc.status === 'DRAFT',
      confirm: (doc) => ({
        title: `Dispatch ${doc.challanNumber}?`,
        message:
          'The goods are leaving, so these quantities come out of stock now. The invoice raised from this challan will not deduct them again.',
        confirmText: 'Mark as Dispatched',
      }),
      run: (doc) =>
        api.post(`/challans/${doc.id}/dispatch`, { status: 'DISPATCHED' }),
      successMessage: () => 'Challan dispatched and stock updated.',
    },
    {
      key: 'delivered',
      label: 'Mark as Delivered',
      tone: 'neutral',
      enabledFor: (doc) => doc.status === 'DISPATCHED',
      run: (doc) =>
        api.post(`/challans/${doc.id}/dispatch`, { status: 'DELIVERED' }),
      successMessage: () => 'Challan marked as delivered.',
    },
    {
      key: 'invoice',
      label: 'Create Invoice',
      enabledFor: (doc) =>
        doc.status !== 'CANCELLED' && !doc.convertedInvoiceId,
      confirm: (doc) => ({
        title: `Bill ${doc.challanNumber}?`,
        message:
          'An invoice is created from these challan lines and the customer balance updates as it would for any bill. Stock is left alone if the goods have already been dispatched.',
        confirmText: 'Create Invoice',
      }),
      run: (doc) => api.post(`/challans/${doc.id}/invoice`, {}),
      successMessage: (result) => `Invoice ${result.invoiceNumber} created.`,
    },
    {
      key: 'cancel',
      label: 'Cancel Challan',
      tone: 'neutral',
      enabledFor: (doc) =>
        !['CANCELLED', 'INVOICED'].includes(doc.status) &&
        !doc.convertedInvoiceId,
      confirm: (doc) => ({
        title: `Cancel ${doc.challanNumber}?`,
        message:
          'A cancelled challan can no longer be billed. Any stock that left on dispatch comes back in.',
        confirmText: 'Cancel Challan',
        danger: true,
      }),
      run: (doc) => api.post(`/challans/${doc.id}/cancel`, {}),
      successMessage: () => 'Challan cancelled and any dispatched stock returned.',
    },
  ],
};

export default function ChallansPage() {
  return (
    <SidebarLayout>
      <FeatureGate featureKey="challansEnabled" featureName="Delivery Challans">
        <OrderDocumentWorkspace config={config} />
      </FeatureGate>
    </SidebarLayout>
  );
}
