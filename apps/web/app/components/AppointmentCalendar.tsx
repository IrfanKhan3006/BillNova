'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CalendarView,
  VIEW_LABELS,
  addDays,
  daysForView,
  hourWindow,
  isSameDay,
  layoutDay,
  minutesSinceMidnight,
  rangeLabel,
  startOfDay,
  stepForView,
} from '../lib/calendarGrid';

/** One pixel per minute, so an hour row is 60px tall. */
const PX_PER_MIN = 1;

export interface CalendarAppointment {
  id: string;
  service: string;
  staffName?: string | null;
  startsAt: string;
  durationMins: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  customer: { name: string; phone?: string | null };
}

const BLOCK_STYLES: Record<string, string> = {
  SCHEDULED: 'border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-100',
  COMPLETED:
    'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100',
  CANCELLED:
    'border-zinc-300 bg-zinc-100 text-zinc-500 line-through dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  NO_SHOW: 'border-red-400 bg-red-50 text-red-900 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-100',
};

const timeLabel = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

const hourLabel = (hour: number) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true });
};

interface Props {
  appointments: CalendarAppointment[];
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onSelect: (appointment: CalendarAppointment) => void;
  selectedId?: string | null;
}

export default function AppointmentCalendar({
  appointments,
  view,
  onViewChange,
  onSelect,
  selectedId,
}: Props) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  // Re-rendered on a timer so the "now" line creeps down the grid.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const days = daysForView(view, anchor);
  const visible = appointments.filter((a) => {
    const d = new Date(a.startsAt);
    return !Number.isNaN(d.getTime()) && days.some((day) => isSameDay(day, d));
  });

  const { startHour, endHour } = hourWindow(visible);
  const gridTopMin = startHour * 60;
  const gridHeight = (endHour - startHour) * 60 * PX_PER_MIN;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const todayIndex = days.findIndex((d) => isSameDay(d, now));
  const nowOffset = (minutesSinceMidnight(now) - gridTopMin) * PX_PER_MIN;
  const nowVisible = todayIndex >= 0 && nowOffset >= 0 && nowOffset <= gridHeight;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor(startOfDay(new Date()))}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Today
          </button>
          <button
            onClick={() => setAnchor((a) => addDays(a, -stepForView(view)))}
            aria-label="Previous"
            className="rounded-lg border border-zinc-300 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAnchor((a) => addDays(a, stepForView(view)))}
            aria-label="Next"
            className="rounded-lg border border-zinc-300 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-sm font-bold text-zinc-900 dark:text-white">
            {rangeLabel(view, days)}
          </span>
        </div>

        <div className="flex rounded-lg border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                view === v
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className={view === 'day' ? 'min-w-full' : 'min-w-[720px]'}>
          {/* Day headers */}
          <div
            className="grid border-b border-zinc-200 dark:border-zinc-800"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div />
            {days.map((d) => {
              const isToday = isSameDay(d, now);
              return (
                <div
                  key={d.toISOString()}
                  className={`border-l border-zinc-200 px-2 py-2 text-center dark:border-zinc-800 ${
                    isToday ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''
                  }`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
                    }`}
                  >
                    {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Hour rows + appointment blocks */}
          <div
            className="relative grid"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {/* Hour gutter */}
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-zinc-400"
                  style={{ top: i * 60 * PX_PER_MIN }}
                >
                  {i === 0 ? '' : hourLabel(h)}
                </div>
              ))}
            </div>

            {days.map((day, dayIdx) => {
              const dayAppts = visible.filter((a) => isSameDay(new Date(a.startsAt), day));
              const laid = layoutDay(dayAppts);

              return (
                <div
                  key={day.toISOString()}
                  className="relative border-l border-zinc-200 dark:border-zinc-800"
                  style={{ height: gridHeight }}
                >
                  {/* Hour lines */}
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-800/60"
                      style={{ top: i * 60 * PX_PER_MIN }}
                    />
                  ))}

                  {/* Now line */}
                  {nowVisible && dayIdx === todayIndex && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                      style={{ top: nowOffset }}
                    >
                      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  )}

                  {/* Appointments */}
                  {laid.map((g) => {
                    const top = (g.startMin - gridTopMin) * PX_PER_MIN;
                    const height = Math.max((g.endMin - g.startMin) * PX_PER_MIN, 22);
                    const widthPct = 100 / g.cols;
                    const isSelected = selectedId === g.item.id;
                    const compact = height < 44;

                    return (
                      <button
                        key={g.item.id}
                        onClick={() => onSelect(g.item)}
                        title={`${timeLabel(g.start)} · ${g.item.service} · ${g.item.customer.name}`}
                        className={`absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight transition hover:z-30 hover:shadow-md ${
                          BLOCK_STYLES[g.item.status]
                        } ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
                        style={{
                          top,
                          height,
                          left: `calc(${g.col * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                      >
                        <span className="block truncate font-bold">{g.item.service}</span>
                        {!compact && (
                          <>
                            <span className="block truncate opacity-80">{timeLabel(g.start)}</span>
                            <span className="block truncate opacity-80">{g.item.customer.name}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-center text-xs text-zinc-500">
          Is {view === 'day' ? 'din' : 'hafte'} koi appointment nahi hai.
        </p>
      )}
    </div>
  );
}
