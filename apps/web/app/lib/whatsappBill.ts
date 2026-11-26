/**
 * Builds the WhatsApp "your bill is ready" message and the wa.me link used by
 * the Send on WhatsApp button on the billing page.
 */

export const WHATSAPP_PLACEHOLDERS = [
  '{customer}',
  '{business}',
  '{invoiceNo}',
  '{amount}',
  '{amountDue}',
  '{billLink}',
  '{review}',
  '{phone}',
] as const;

export const DEFAULT_WHATSAPP_TEMPLATE = `Invoice
Hi {customer},

We thank you for the payment of {amount}/-.

We hope to see you soon.

View your Invoice: {billLink}

Please review us on google : {review}

To book Your appointment Please call us on {phone}.

{business}`;

/**
 * Turns a user-entered phone number into the digits wa.me expects: country code
 * plus number, no "+", spaces or punctuation. Indian 10-digit numbers get 91.
 */
export function toWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');

  // Strip a leading 0 (e.g. 088849...) or a 00 international prefix.
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  // Bare Indian mobile number — add the country code.
  if (digits.length === 10) digits = `91${digits}`;

  // Shortest valid international numbers are 8 digits with country code.
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

// No thousands separator — matches the plain "1798/-" style of the message.
const formatAmount = (val: number) => {
  const num = val || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
};

export interface WhatsAppMessageInput {
  customerName?: string | null;
  businessName?: string | null;
  businessPhone?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number;
  amountDue?: number;
  billLink?: string | null;
  googleReviewUrl?: string | null;
  template?: string | null;
}

/**
 * Fills the template placeholders. Any line whose placeholders all resolve to
 * empty (no review link, no contact number, no bill link) is dropped, so an
 * unconfigured business never sends a dangling "Please review us on google :".
 */
export function buildWhatsAppMessage(input: WhatsAppMessageInput): string {
  const values: Record<string, string> = {
    '{customer}': (input.customerName || 'there').trim(),
    '{business}': (input.businessName || '').trim(),
    '{invoiceNo}': (input.invoiceNumber || '').trim(),
    '{amount}': formatAmount(input.totalAmount || 0),
    '{amountDue}': formatAmount(input.amountDue || 0),
    '{billLink}': (input.billLink || '').trim(),
    '{review}': (input.googleReviewUrl || '').trim(),
    '{phone}': (input.businessPhone || '').trim(),
  };

  // Lines are dropped only for the optional placeholders; {customer}/{amount}
  // always resolve to something, so those lines always survive.
  const optional = new Set(['{billLink}', '{review}', '{phone}', '{business}', '{invoiceNo}']);

  const template = input.template?.trim() || DEFAULT_WHATSAPP_TEMPLATE;

  const lines = template.split('\n').filter((line) => {
    const used = WHATSAPP_PLACEHOLDERS.filter((key) => line.includes(key));
    if (used.length === 0) return true;
    // Keep the line unless every placeholder on it is optional and empty.
    return used.some((key) => !optional.has(key) || values[key]);
  });

  let message = lines.join('\n');
  for (const [key, val] of Object.entries(values)) {
    message = message.split(key).join(val);
  }

  // Collapse the blank-line gaps left behind by dropped lines.
  return message.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Public bill URL for a share token, e.g. https://billcrafts.com/bill?s=<token>
 *
 * The host comes from NEXT_PUBLIC_APP_URL so the link a customer receives is
 * always the public domain — never localhost in dev, and never a preview host
 * like *.hostingersite.com if a bill happens to be created through one.
 */
export function buildBillLink(shareToken?: string | null): string | null {
  if (!shareToken) return null;

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  const origin = configured || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin) return null;

  return `${origin}/bill?s=${encodeURIComponent(shareToken)}`;
}

/** wa.me click-to-chat link that opens WhatsApp with the message pre-filled. */
export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
