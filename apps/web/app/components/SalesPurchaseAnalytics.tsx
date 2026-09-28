'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { Receipt, ShoppingBag, TrendingUp, Table2, BarChart3, Printer, CalendarRange } from 'lucide-react';

interface MonthPoint {
  label: string;
  sales: number;
  salesCount: number;
  purchases: number;
  purchaseCount: number;
}

interface RangeInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  status: string;
  totalAmount: number;
  customerName: string;
}

interface Analytics {
  scope: 'USER' | 'BUSINESS';
  granularity: 'day' | 'month';
  totals: { salesCount: number; salesAmount: number; purchaseCount: number; purchaseAmount: number };
  buckets: MonthPoint[];
  invoices: RangeInvoice[];
}

// yyyy-mm-dd in local time, for <input type="date">
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(preset: string): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  if (preset === 'today') {
    // from = today
  } else if (preset === '7d') {
    from.setDate(today.getDate() - 6);
  } else if (preset === 'month') {
    from.setDate(1);
  } else if (preset === 'year') {
    from.setMonth(0, 1);
  } else {
    from.setDate(1);
    from.setMonth(today.getMonth() - 5);
  }
  return { from: ymd(from), to: ymd(today) };
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: 'month', label: 'This Month' },
  { id: '6m', label: '6 Months' },
  { id: 'year', label: 'This Year' },
];

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// Compact axis labels: ₹1.2L, ₹45K
const inrShort = (v: number) => {
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${+(v / 1e3).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
};

// Round the axis max up to a "nice" number so ticks read cleanly.
function niceMax(v: number) {
  if (v <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v)!;
  return step * pow;
}

// Categorical slots 1 (blue) and 2 (orange), validated for light and dark surfaces.
const vizStyles = `
.bn-viz { --series-sales: #2a78d6; --series-purchases: #eb6834; --viz-grid: #e4e4e7; --viz-axis: #71717a; --viz-surface: #ffffff; }
.dark .bn-viz { --series-sales: #3987e5; --series-purchases: #d95926; --viz-grid: #27272a; --viz-axis: #a1a1aa; --viz-surface: #09090b; }
`;

const SERIES = [
  { key: 'sales' as const, countKey: 'salesCount' as const, label: 'Sales (Invoices)', color: 'var(--series-sales)' },
  { key: 'purchases' as const, countKey: 'purchaseCount' as const, label: 'Purchases', color: 'var(--series-purchases)' },
];

function BarChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 230;
  const pad = { top: 16, right: 12, bottom: 28, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.flatMap((d) => [d.sales, d.purchases])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const groupW = innerW / data.length;
  const barW = Math.max(2, Math.min(28, (groupW - 6) / 2));
  // Thin out x labels when there are many buckets (daily ranges).
  const labelEvery = Math.ceil(data.length / 12);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  // Bar with a 4px rounded top and a square base on the axis.
  const barPath = (x: number, v: number) => {
    const h = Math.max(0, (v / max) * innerH);
    if (h === 0) return '';
    const r = Math.min(4, h, barW / 2);
    const top = pad.top + innerH - h;
    const bottom = pad.top + innerH;
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`;
  };

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly sales and purchases bar chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-axis)">
              {inrShort(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = pad.left + i * groupW;
          const x0 = gx + groupW / 2 - barW - 1; // 2px gap between the pair
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Hit target spans the whole month column */}
              <rect x={gx} y={pad.top} width={groupW} height={innerH} fill={hover === i ? 'var(--viz-grid)' : 'transparent'} opacity={0.5} />
              <path d={barPath(x0, d.sales)} fill="var(--series-sales)" />
              <path d={barPath(x0 + barW + 2, d.purchases)} fill="var(--series-purchases)" />
              {i % labelEvery === 0 && (
                <text x={gx + groupW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--viz-axis)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((pad.left + (hover + 0.5) * groupW) / W) * 100}%`,
            transform: hover > data.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          }}
        >
          <p className="mb-1.5 font-bold text-zinc-900 dark:text-white">{hovered.label}</p>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {inr(hovered[s.key])} <span className="font-normal text-zinc-500">({hovered[s.countKey]})</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesPurchaseAnalytics({ title }: { title?: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [range, setRange] = useState(() => presetRange('6m'));
  const [preset, setPreset] = useState<string | null>('6m');
  // Bills made before per-user tracking have no creator, so "All Business" is the default.
  const [mine, setMine] = useState(false);

  useEffect(() => {
    if (range.from && range.to && range.from > range.to) {
      setError('"From" date must be before "To" date.');
      return;
    }
    setError(null);
    api
      .get(`/dashboard/analytics?from=${range.from}&to=${range.to}&mine=${mine}`)
      .then(setData)
      .catch((err: any) => setError(err.message || 'Failed to load analytics.'));
  }, [range.from, range.to, mine]);

  const dateFilter = (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-4">
      <CalendarRange className="h-4 w-4 text-zinc-400" />
      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        From
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => {
            setPreset(null);
            setRange({ ...range, from: e.target.value });
          }}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        To
        <input
          type="date"
          value={range.to}
          min={range.from}
          onChange={(e) => {
            setPreset(null);
            setRange({ ...range, to: e.target.value });
          }}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPreset(p.id);
              setRange(presetRange(p.id));
            }}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              preset === p.id
                ? 'bg-emerald-500 text-zinc-950'
                : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
        {[
          { v: false, label: 'All Business' },
          { v: true, label: 'Created by Me' },
        ].map((o) => (
          <button
            key={o.label}
            onClick={() => setMine(o.v)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mine === o.v ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (error || !data) {
    return (
      <div className="space-y-6">
        {dateFilter}
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500 border-zinc-300 dark:border-zinc-800" />
          </div>
        )}
      </div>
    );
  }

  const { totals, buckets: monthly } = data;
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN');
  const tiles = [
    { label: 'Invoices Created', value: totals.salesCount.toLocaleString('en-IN'), icon: Receipt, dot: 'var(--series-sales)' },
    { label: 'Sales Amount', value: inr(totals.salesAmount), icon: TrendingUp, dot: 'var(--series-sales)' },
    { label: 'Purchase Invoices', value: totals.purchaseCount.toLocaleString('en-IN'), icon: ShoppingBag, dot: 'var(--series-purchases)' },
    { label: 'Purchase Amount', value: inr(totals.purchaseAmount), icon: TrendingUp, dot: 'var(--series-purchases)' },
  ];
  const hasData = monthly.some((m) => m.sales > 0 || m.purchases > 0);

  return (
    <div className="bn-viz space-y-6">
      <style>{vizStyles}</style>
      {dateFilter}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-5 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: t.dot }} />
                {t.label}
              </span>
              <t.icon className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-zinc-900 dark:text-white">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Chart and invoice list side by side, same height */}
      <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex h-[440px] flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-6 shadow-sm dark:shadow-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">{title || 'Sales vs Purchases'}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {fmtDate(range.from)} – {fmtDate(range.to)} · by {data.granularity}
              {data.scope === 'USER' ? ' · only bills created by you (from 29 Sep 2026)' : ' · whole business'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            <button
              onClick={() => setShowTable(!showTable)}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
        {showTable ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <th className="py-2">{data.granularity === 'day' ? 'Day' : 'Month'}</th>
                <th className="py-2 text-right">Invoices</th>
                <th className="py-2 text-right">Sales</th>
                <th className="py-2 text-right">Purchases</th>
                <th className="py-2 text-right">Purchase Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {monthly.map((m) => (
                <tr key={m.label} className="text-zinc-700 dark:text-zinc-300">
                  <td className="py-2 font-semibold">{m.label}</td>
                  <td className="py-2 text-right">{m.salesCount}</td>
                  <td className="py-2 text-right">{inr(m.sales)}</td>
                  <td className="py-2 text-right">{m.purchaseCount}</td>
                  <td className="py-2 text-right">{inr(m.purchases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : hasData ? (
          <BarChart data={monthly} />
        ) : (
          <p className="py-16 text-center text-sm text-zinc-500">No invoices or purchases in this date range.</p>
        )}
        </div>
      </div>

      {/* Invoices in the selected range */}
      <div className="flex h-[440px] flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 shadow-sm dark:shadow-none overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h3 className="font-bold text-zinc-900 dark:text-white">Invoices in this range</h3>
          <span className="text-xs text-zinc-500">
            {data.invoices.length < totals.salesCount
              ? `Latest ${data.invoices.length} of ${totals.salesCount}`
              : `${totals.salesCount} invoices`}
          </span>
        </div>
        {data.invoices.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No invoices in this date range.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-950">
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-2.5 pl-6">Invoice</th>
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Customer</th>
                  <th className="hidden py-2.5 2xl:table-cell">Status</th>
                  <th className="py-2.5 text-right">Amount</th>
                  <th className="py-2.5 pr-6 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className="py-2.5 pl-6 font-mono font-bold text-zinc-900 dark:text-white">{inv.invoiceNumber}</td>
                    <td className="py-2.5">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td className="max-w-[180px] truncate py-2.5" title={inv.customerName}>{inv.customerName}</td>
                    <td className="hidden py-2.5 text-xs font-semibold uppercase 2xl:table-cell">{inv.status}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-900 dark:text-white">{inr(inv.totalAmount)}</td>
                    <td className="py-2.5 pr-6 text-right">
                      <Link
                        href={`/billing?invoiceId=${inv.id}`}
                        title="View / Print"
                        aria-label={`View or print ${inv.invoiceNumber}`}
                        className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
