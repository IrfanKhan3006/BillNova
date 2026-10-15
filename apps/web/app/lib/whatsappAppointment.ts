/**
 * Builds the WhatsApp "appointment confirmed" message.
 *
 * Shares the phone normalisation and wa.me link helpers with the bill message,
 * so adding an automatic sender later only has to replace the link step.
 */
import { toWhatsAppNumber, buildWhatsAppLink } from './whatsappBill';

export { toWhatsAppNumber, buildWhatsAppLink };

export const APPOINTMENT_PLACEHOLDERS = [
  '{customer}',
  '{business}',
  '{service}',
  '{staff}',
  '{date}',
  '{time}',
  '{phone}',
  '{calendar}',
] as const;

export const DEFAULT_APPOINTMENT_TEMPLATE = `Appointment Confirmed
Hi {customer},

Your appointment is confirmed for {date} at {time}.

Service: {service}
With: {staff}

Add to your calendar: {calendar}

To reschedule or cancel, please call us on {phone}.

See you soon!
{business}`;

export interface AppointmentMessageInput {
  customerName?: string | null;
  businessName?: string | null;
  businessPhone?: string | null;
  service?: string | null;
  staffName?: string | null;
  /** The appointment's start, as an ISO string or Date. */
  startsAt?: string | Date | null;
  /** Google Calendar "add event" link the customer can tap to save it. */
  calendarUrl?: string | null;
  template?: string | null;
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (value?: string | Date | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Fills the template placeholders. A line whose placeholders are all optional
 * and empty is dropped, so a booking without a stylist does not send a bare
 * "With:" line.
 */
export function buildAppointmentMessage(input: AppointmentMessageInput): string {
  const values: Record<string, string> = {
    '{customer}': (input.customerName || 'there').trim(),
    '{business}': (input.businessName || '').trim(),
    '{service}': (input.service || '').trim(),
    '{staff}': (input.staffName || '').trim(),
    '{date}': formatDate(input.startsAt),
    '{time}': formatTime(input.startsAt),
    '{phone}': (input.businessPhone || '').trim(),
    '{calendar}': (input.calendarUrl || '').trim(),
  };

  const optional = new Set([
    '{staff}',
    '{phone}',
    '{business}',
    '{service}',
    '{calendar}',
  ]);

  const template = input.template?.trim() || DEFAULT_APPOINTMENT_TEMPLATE;

  const lines = template.split('\n').filter((line) => {
    const used = APPOINTMENT_PLACEHOLDERS.filter((key) => line.includes(key));
    if (used.length === 0) return true;
    return used.some((key) => !optional.has(key) || values[key]);
  });

  let message = lines.join('\n');
  for (const [key, val] of Object.entries(values)) {
    message = message.split(key).join(val);
  }

  return message.replace(/\n{3,}/g, '\n\n').trim();
}
