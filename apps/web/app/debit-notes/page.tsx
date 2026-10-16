'use client';

import React from 'react';
import { Redo2 } from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import OrderDocumentWorkspace, {
  OrderDocumentConfig,
} from '../components/OrderDocumentWorkspace';
import { api } from '../lib/api';

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

const config: OrderDocumentConfig = {
  resource: 'debit-notes',
  title: 'Debit Notes',
  subtitle:
    'Debit a supplier for goods going back or a bill overcharged. Issuing the note reduces what you owe them and takes the returned stock out.',
  icon: Redo2,
  numberField: 'debitNoteNumber',
  partyKind: 'vendor',
  partyLabel: 'Vendor',
  partyEndpoint: '/purchases/vendors',
  priceField: 'purchasePrice',
  statuses: ['DRAFT', 'ISSUED', 'CANCELLED'],
  statusTone: {
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    ISSUED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  referenceField: {
    key: 'purchaseInvoiceId',
    label: 'Against Purchase Bill',
    endpoint: '/purchases',
    numberField: 'purchaseNumber',
    createFromPath: 'from-purchase-invoice',
    hint: 'Picking a purchase bill copies its lines in. Trim the lines for a partial return.',
  },
  choiceFields: [
    {
      key: 'reason',
      label: 'Reason',
      defaultValue: 'PURCHASE_RETURN',
      options: [
        { value: 'PURCHASE_RETURN', label: 'Purchase return' },
        { value: 'RATE_DIFFERENCE', label: 'Rate difference' },
        { value: 'DEFICIENCY_IN_SERVICE', label: 'Deficiency in service' },
        { value: 'CANCELLATION', label: 'Cancellation' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
  ],
  toggleFields: [
    {
      key: 'restock',
      label: 'Take the returned goods out of stock',
      hint: 'Leave this off for a rate difference, where no goods go back.',
      defaultValue: true,
    },
  ],
  termsFields: [
    {
      key: 'reasonNote',
      label: 'Reason Details',
      placeholder: 'Short supply against the bill',
    },
  ],
  printTitle: 'DEBIT NOTE',
  createLabel: 'New Debit Note',
  documentKind: 'DEBIT_NOTE',
  printMeta: (doc) => {
    const meta: { label: string; value: string }[] = [];
    if (doc.originalInvoiceNumber) {
      meta.push({ label: 'Against Bill', value: doc.originalInvoiceNumber });
    }
    if (doc.originalInvoiceDate) {
      meta.push({
        label: 'Bill Date',
        value: formatDate(doc.originalInvoiceDate),
      });
    }
    if (doc.reason) {
      meta.push({ label: 'Reason', value: doc.reason.replace(/_/g, ' ') });
    }
    return meta;
  },
  actions: [
    {
      key: 'issue',
      label: 'Issue Debit Note',
      enabledFor: (doc) => doc.status === 'DRAFT',
      confirm: (doc) => ({
        title: `Issue ${doc.debitNoteNumber}?`,
        message:
          'This reduces what you owe the supplier, sets the amount against the linked purchase bill, and takes any returned goods out of stock. A draft can be edited; an issued note can only be cancelled.',
        confirmText: 'Issue Debit Note',
      }),
      run: (doc) => api.post(`/debit-notes/${doc.id}/issue`, {}),
      successMessage: (result) => `${result.debitNoteNumber} issued.`,
    },
    {
      key: 'cancel',
      label: 'Cancel Note',
      tone: 'neutral',
      enabledFor: (doc) => doc.status !== 'CANCELLED',
      confirm: (doc) => ({
        title: `Cancel ${doc.debitNoteNumber}?`,
        message:
          'The debit is reversed: you owe the supplier the amount again and any returned goods come back into stock.',
        confirmText: 'Cancel Note',
        danger: true,
      }),
      run: (doc) => api.post(`/debit-notes/${doc.id}/cancel`, {}),
      successMessage: () => 'Debit note cancelled and the debit reversed.',
    },
  ],
};

export default function DebitNotesPage() {
  return (
    <SidebarLayout>
      <FeatureGate featureKey="debitNotesEnabled" featureName="Debit Notes">
        <OrderDocumentWorkspace config={config} />
      </FeatureGate>
    </SidebarLayout>
  );
}
