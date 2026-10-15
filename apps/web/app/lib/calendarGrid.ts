/**
 * Date and layout maths for the appointments calendar grid.
 *
 * Hand-rolled rather than pulling in a date library: the app has none, and
 * what the grid needs is a handful of day/week helpers plus the packing that
 * lets overlapping bookings sit side by side.
 */

export type CalendarView = 'day' | 'workweek' | 'week';

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Day',
  workweek: 'Work week',
  week: 'Week',
};

/** Hours the grid always shows, even on an empty day. */
export const DEFAULT_START_HOUR = 9;
export const DEFAULT_END_HOUR = 21;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday-first, matching how the week reads in India. */
export function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const weekday = (out.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  return addDays(out, -weekday);
}

/** The days a view covers, starting from the anchor date. */
export function daysForView(view: CalendarView, anchor: Date): Date[] {
  if (view === 'day') return [startOfDay(anchor)];
  const monday = startOfWeek(anchor);
  const count = view === 'workweek' ? 5 : 7;
  return Array.from({ length: count }, (_, i) => addDays(monday, i));
}

/** How far to jump when stepping the view forward or back. */
export function stepForView(view: CalendarView): number {
  return view === 'day' ? 1 : 7;
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function rangeLabel(view: CalendarView, days: Date[]): string {
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];

  if (view === 'day') {
    return first.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const sameMonth = first.getMonth() === last.getMonth();
  const firstPart = first.toLocaleDateString('en-IN', {
    day: 'numeric',
    ...(sameMonth ? {} : { month: 'short' }),
  });
  const lastPart = last.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${firstPart} – ${lastPart}`;
}

export interface GridItem<T> {
  item: T;
  start: Date;
  /** Minutes from midnight. */
  startMin: number;
  endMin: number;
  /** Which of `cols` side-by-side columns this one sits in. */
  col: number;
  cols: number;
}

interface Timed {
  startsAt: string;
  durationMins?: number | null;
}

/**
 * Picks the hour window to render: the default working hours, widened so no
 * appointment falls outside the grid.
 */
export function hourWindow(items: Timed[]): { startHour: number; endHour: number } {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;

  for (const it of items) {
    const start = new Date(it.startsAt);
    if (Number.isNaN(start.getTime())) continue;
    const mins = it.durationMins && it.durationMins > 0 ? it.durationMins : 60;
    const end = new Date(start.getTime() + mins * 60 * 1000);

    startHour = Math.min(startHour, start.getHours());
    // Round the end up so a 17:30 finish still shows a complete 18:00 row.
    endHour = Math.max(endHour, end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours());
  }

  return { startHour: Math.max(0, startHour), endHour: Math.min(24, Math.max(endHour, startHour + 1)) };
}

/**
 * Lays out one day's appointments, giving overlapping ones their own column so
 * they sit next to each other instead of on top of each other.
 */
export function layoutDay<T extends Timed>(items: T[]): GridItem<T>[] {
  const timed = items
    .map((item) => {
      const start = new Date(item.startsAt);
      if (Number.isNaN(start.getTime())) return null;
      const mins = item.durationMins && item.durationMins > 0 ? item.durationMins : 60;
      const startMin = minutesSinceMidnight(start);
      return { item, start, startMin, endMin: startMin + mins };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out: GridItem<T>[] = [];
  // A cluster is a run of appointments that overlap each other, so the column
  // count only widens the entries that actually clash.
  let cluster: GridItem<T>[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = cluster.reduce((max, c) => Math.max(max, c.col + 1), 0);
    for (const c of cluster) c.cols = cols;
    out.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const t of timed) {
    if (cluster.length > 0 && t.startMin >= clusterEnd) flush();

    // First column whose last booking has already finished.
    const used = new Set(cluster.filter((c) => c.endMin > t.startMin).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col += 1;

    cluster.push({ ...t, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, t.endMin);
  }
  if (cluster.length > 0) flush();

  return out;
}
