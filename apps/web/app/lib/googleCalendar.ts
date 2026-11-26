/**
 * Builds a Google Calendar "add event" link.
 *
 * This is the click-to-add template URL, the same idea as the wa.me links: it
 * opens Google Calendar with everything filled in and the person presses Save.
 * It needs no OAuth, no Google Cloud project and no per-user connection.
 */

export interface CalendarEventInput {
  title: string;
  /** Event start, as an ISO string or Date. */
  startsAt: string | Date;
  /** Length in minutes; falls back to an hour. */
  durationMins?: number;
  details?: string;
  location?: string;
}

/** Google's template URL wants UTC basic format: 20261020T153000Z */
function toGoogleUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string | null {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) return null;

  const mins = input.durationMins && input.durationMins > 0 ? input.durationMins : 60;
  const end = new Date(start.getTime() + mins * 60 * 1000);

  const params = new URLSearchParams({ action: 'TEMPLATE', text: input.title });
  if (input.details) params.set('details', input.details);
  if (input.location) params.set('location', input.location);

  // `dates` keeps its literal "/" separator — that is the form Google documents.
  const dates = `${toGoogleUtc(start)}/${toGoogleUtc(end)}`;

  return `https://calendar.google.com/calendar/render?${params.toString()}&dates=${dates}`;
}

/** Human-readable end time for a start + duration, e.g. "11:30 am". */
export function endTimeLabel(startsAt: string | Date, durationMins?: number): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';
  const mins = durationMins && durationMins > 0 ? durationMins : 60;
  const end = new Date(start.getTime() + mins * 60 * 1000);
  return end.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
];
