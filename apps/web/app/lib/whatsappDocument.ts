/**
 * "Send on WhatsApp" for the order documents, the credit/debit notes and
 * delivery challans.
 *
 * Mirrors the bill sharing in `whatsappBill.ts`: the party receives a link to a
 * public page showing the real document, because a plain text message cannot
 * carry the line items and WhatsApp cannot attach a PDF from a link.
 *
 * Phone number normalisation is shared with the bill flow (`toWhatsAppNumber`)
 * so both features treat Indian numbers the same way.
 */

export type DocumentKind =
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'PURCHASE_ORDER'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'DELIVERY_CHALLAN';

const formatAmount = (val: number) => {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
};

const formatDate = (value?: string | Date | null) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

export interface DocumentMessageInput {
  kind: DocumentKind;
  /** Customer name, or supplier name for a purchase order. */
  partyName?: string | null;
  businessName?: string | null;
  businessPhone?: string | null;
  documentNumber: string;
  totalAmount: number;
  /** Valid-until for a quotation, expected delivery for an order. */
  secondaryDate?: string | Date | null;
  /** The bill a note is raised against, shown as the GST reference. */
  referenceNumber?: string | null;
  documentLink?: string | null;
}

/**
 * Wording per document type. A purchase order is addressed to a supplier we are
 * buying from, so it asks them to confirm rather than thanking them for an order.
 */
export function buildDocumentMessage(input: DocumentMessageInput): string {
  const who = (input.partyName || 'there').trim();
  const amount = `${formatAmount(input.totalAmount)}/-`;
  const business = (input.businessName || '').trim();
  const when = formatDate(input.secondaryDate);

  const lines: string[] = [];

  if (input.kind === 'QUOTATION') {
    lines.push(`Quotation ${input.documentNumber}`);
    lines.push('');
    lines.push(`Hi ${who},`);
    lines.push('');
    lines.push(`Please find our quotation for ${amount}.`);
    if (when) lines.push(`This quotation is valid until ${when}.`);
  } else if (input.kind === 'SALES_ORDER') {
    lines.push(`Sales Order ${input.documentNumber}`);
    lines.push('');
    lines.push(`Hi ${who},`);
    lines.push('');
    lines.push(`Thank you for your order. We have confirmed it for ${amount}.`);
    if (when) lines.push(`Expected delivery: ${when}.`);
  } else if (input.kind === 'PURCHASE_ORDER') {
    lines.push(`Purchase Order ${input.documentNumber}`);
    lines.push('');
    lines.push(`Hi ${who},`);
    lines.push('');
    lines.push(`Please find our purchase order for ${amount}.`);
    if (when) lines.push(`Required delivery by: ${when}.`);
    lines.push('Kindly confirm receipt of this order.');
  } else if (input.kind === 'CREDIT_NOTE') {
    lines.push(`Credit Note ${input.documentNumber}`);
    lines.push('');
    lines.push(`Hi ${who},`);
    lines.push('');
    lines.push(`We have raised a credit note of ${amount} in your favour.`);
    if (input.referenceNumber) {
      lines.push(`This is against bill ${input.referenceNumber}.`);
    }
    lines.push('The amount has been adjusted against your account.');
  } else if (input.kind === 'DEBIT_NOTE') {
    lines.push(`Debit Note ${input.documentNumber}`);
    lines.push('');
    lines.push(`Hi ${who},`);
    lines.push('');
    lines.push(`We have raised a debit note of ${amount} against your account.`);
    if (input.referenceNumber) {
      lines.push(`This is against bill ${input.referenceNumber}.`);
    }
    lines.push('Kindly confirm and adjust the same at your end.');
  } else {
    lines.push(`Delivery Challan ${input.documentNumber}`);
    lines.push('');
    lines.push(`Hi ${who},`);
    lines.push('');
    lines.push('Your goods have been dispatched. The delivery challan is below.');
    lines.push('Please check the items on arrival and confirm receipt.');
  }

  if (input.documentLink) {
    lines.push('');
    lines.push(`View the details here: ${input.documentLink}`);
  }

  if (input.businessPhone) {
    lines.push('');
    lines.push(`For any questions, call us on ${input.businessPhone}.`);
  }

  if (business) {
    lines.push('');
    lines.push(business);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Public document URL for a share token, e.g. https://billcrafts.com/doc?s=<token>
 *
 * The host comes from NEXT_PUBLIC_APP_URL so the party always receives the
 * public domain, never localhost or a preview host.
 */
export function buildDocumentLink(shareToken?: string | null): string | null {
  if (!shareToken) return null;

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  const origin =
    configured || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin) return null;

  return `${origin}/doc?s=${encodeURIComponent(shareToken)}`;
}
