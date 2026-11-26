'use client';

import React from 'react';
import { Undo2 } from 'lucide-react';
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
  resource: 'credit-notes',
  title: 'Credit Notes',
  subtitle:
    'Credit a customer for a sales return, a rate difference or a post-sale discount. Issuing the note adjusts their balance and puts returned stock back.',
  icon: Undo2,
  numberField: 'creditNoteNumber',
  partyKind: 'customer',
  partyLabel: 'Customer',
  partyEndpoint: '/customers',
  priceField: 'salesPrice',
  statuses: ['DRAFT', 'ISSUED', 'CANCELLED'],
  statusTone: {
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    ISSUED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  referenceField: {
    key: 'invoiceId',
    label: 'Against Bill',
    endpoint: '/invoices',
    numberField: 'invoiceNumber',
    createFromPath: 'from-invoice',
    hint: 'Picking a bill copies its lines in. Trim the lines for a partial return.',
  },
  choiceFields: [
    {
      key: 'reason',
      label: 'Reason',
      defaultValue: 'SALES_RETURN',
      options: [
        { value: 'SALES_RETURN', label: 'Sales return' },
        { value: 'RATE_DIFFERENCE', label: 'Rate difference' },
        { value: 'POST_SALE_DISCOUNT', label: 'Post-sale discount' },
        { value: 'DEFICIENCY_IN_SERVICE', label: 'Deficiency in service' },
        { value: 'CANCELLATION', label: 'Cancellation' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
  ],
  toggleFields: [
    {
      key: 'restock',
      label: 'Put the returned goods back into stock',
      hint: 'Leave this off for a rate difference or a discount, where no goods come back.',
      defaultValue: true,
    },
  ],
  termsFields: [
    {
      key: 'reasonNote',
      label: 'Reason Details',
      placeholder: 'Two units returned damaged',
    },
  ],
  printTitle: 'CREDIT NOTE',
  createLabel: 'New Credit Note',
  documentKind: 'CREDIT_NOTE',
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
      label: 'Issue Credit Note',
      enabledFor: (doc) => doc.status === 'DRAFT',
      confirm: (doc) => ({
        title: `Issue ${doc.creditNoteNumber}?`,
        message:
          'This credits the customer, sets the amount against the linked bill, and puts any returned goods back into stock. A draft can be edited; an issued note can only be cancelled.',
        confirmText: 'Issue Credit Note',
      }),
      run: (doc) => api.post(`/credit-notes/${doc.id}/issue`, {}),
      successMessage: (result) => `${result.creditNoteNumber} issued.`,
    },
    {
      key: 'cancel',
      label: 'Cancel Note',
      tone: 'neutral',
      enabledFor: (doc) => doc.status !== 'CANCELLED',
      confirm: (doc) => ({
        title: `Cancel ${doc.creditNoteNumber}?`,
        message:
          'The credit is reversed: the customer owes the amount again and any restocked goods are taken back out.',
        confirmText: 'Cancel Note',
        danger: true,
      }),
      run: (doc) => api.post(`/credit-notes/${doc.id}/cancel`, {}),
      successMessage: () => 'Credit note cancelled and the credit reversed.',
    },
  ],
};

export default function CreditNotesPage() {
  return (
    <SidebarLayout>
      <FeatureGate featureKey="creditNotesEnabled" featureName="Credit Notes">
        <OrderDocumentWorkspace config={config} />
      </FeatureGate>
    </SidebarLayout>
  );
}
