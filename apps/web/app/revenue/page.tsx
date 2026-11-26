'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import FeatureGate from '../components/FeatureGate';
import { api } from '../lib/api';
import { toast } from '../store/uiStore';
import { downloadCsv, csvAmount } from '../lib/exportCsv';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Wallet,
  Clock,
  Download,
  Loader2,
  Percent,
} from 'lucide-react';

/**
 * Revenue dashboard.
 *
 * Answers the three questions the spec asks of it: how much revenue we made,
 * where it came from, and how much of it we have actually collected. Every
 * figure comes from `/reports/revenue`, which fixes one revenue basis (before
 * or after GST) for the whole response so the panels always reconcile.
 */

const SERIES_REVENUE = '#3987e5';
const SERIES_COLLECTED = '#d95926';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatCompact = (amount: number) => {
  const value = Number(amount) || 0;
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
};

const monthLabel = (key: string) => {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    'en-IN',
    { month: 'short' },
  );
};

function MonthlyTrend({ monthly }: { monthly: any[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const width = 720;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const max = Math.max(
    1,
    ...monthly.map((m) => Math.max(m.revenue || 0, m.collected || 0)),
  );
  const step = monthly.length > 1 ? plotW / (monthly.length - 1) : 0;
  const x = (i: number) => pad.left + i * step;
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;

  const pathFor = (key: 'revenue' | 'collected') =>
    monthly
      .map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m[key] || 0)}`)
      .join(' ');

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const active = hover !== null ? monthly[hover] : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Monthly revenue trend</h3>
          <p className="text-xs text-zinc-500">
            Revenue invoiced against cash actually collected, by month.
          </p>
        </div>
        {/* Two series, so a legend is always present. */}
        <div className="flex items-center gap-4 text-xs">
          {[
            { label: 'Revenue', color: SERIES_REVENUE },
            { label: 'Collected', color: SERIES_COLLECTED },
          ].map((series) => (
            <span key={series.label} className="flex items-center gap-1.5 text-zinc-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Monthly revenue and collections"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#3f3f46"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={pad.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-zinc-500"
                fontSize="11"
              >
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          <path
            d={pathFor('revenue')}
            fill="none"
            stroke={SERIES_REVENUE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={pathFor('collected')}
            fill="none"
            stroke={SERIES_COLLECTED}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {monthly.map((m, i) => (
            <g key={m.month}>
              <circle
                cx={x(i)}
                cy={y(m.revenue || 0)}
                r={hover === i ? 5 : 4}
                fill={SERIES_REVENUE}
                stroke="#18181b"
                strokeWidth="2"
              />
              <circle
                cx={x(i)}
                cy={y(m.collected || 0)}
                r={hover === i ? 5 : 4}
                fill={SERIES_COLLECTED}
                stroke="#18181b"
                strokeWidth="2"
              />
              <text
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-zinc-500"
                fontSize="11"
              >
                {monthLabel(m.month)}
              </text>
              {/* Generous hit target for the crosshair. */}
              <rect
                x={x(i) - step / 2}
                y={pad.top}
                width={Math.max(step, 24)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              {hover === i && (
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="#52525b"
                  strokeWidth="1"
                />
              )}
            </g>
          ))}
        </svg>

        {active && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl">
            <p className="font-bold text-white">{monthLabel(active.month)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-zinc-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SERIES_REVENUE }}
              />
              Revenue {formatCurrency(active.revenue)}
            </p>
            <p className="flex items-center gap-1.5 text-zinc-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SERIES_COLLECTED }}
              />
              Collected {formatCurrency(active.collected)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBars({ data }: { data: any[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue || 0));

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-sm font-bold text-white">Revenue by category</h3>
      <p className="text-xs text-zinc-500">
        Which products and services bring the money in.
      </p>

      {data.length === 0 ? (
        <p className="mt-6 text-center text-xs text-zinc-600">
          No revenue in this period yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.slice(0, 8).map((row) => (
            <div key={row.category} className="group">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">{row.category}</span>
                <span className="font-bold text-white">
                  {formatCurrency(row.revenue)}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.max(2, (row.revenue / max) * 100)}%`,
                    backgroundColor: SERIES_REVENUE,
                  }}
                  title={formatCurrency(row.revenue)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RevenuePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [basis, setBasis] = useState<'NET' | 'GROSS'>('NET');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { basis };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      setData(await api.get('/reports/revenue', params));
    } catch (err: any) {
      toast.error(err.message || 'Could not load the revenue dashboard.');
    } finally {
      setLoading(false);
    }
  }, [basis, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;

  const tiles = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Total Revenue',
        value: formatCurrency(summary.totalRevenue),
        hint:
          basis === 'NET' ? 'Before GST, selected period' : 'Including GST, selected period',
        icon: IndianRupee,
      },
      {
        label: 'Growth',
        value:
          summary.revenueGrowth === null
            ? '—'
            : `${summary.revenueGrowth >= 0 ? '+' : ''}${summary.revenueGrowth.toFixed(1)}%`,
        hint: 'Compared with the previous period',
        icon: summary.revenueGrowth !== null && summary.revenueGrowth < 0 ? TrendingDown : TrendingUp,
        tone:
          summary.revenueGrowth === null
            ? 'text-zinc-400'
            : summary.revenueGrowth >= 0
              ? 'text-emerald-400'
              : 'text-rose-400',
      },
      {
        label: 'Collected',
        value: formatCurrency(summary.collected),
        hint: 'Payments received',
        icon: Wallet,
      },
      {
        label: 'Outstanding',
        value: formatCurrency(summary.outstanding),
        hint: 'Invoice balances still unpaid',
        icon: Clock,
      },
    ];
  }, [summary, basis]);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      'revenue-dashboard',
      ['Metric', 'Value'],
      [
        ['Revenue basis', basis === 'NET' ? 'Before GST' : 'Including GST'],
        ['Total revenue', csvAmount(summary.totalRevenue)],
        ['Previous period revenue', csvAmount(summary.previousRevenue)],
        [
          'Revenue growth %',
          summary.revenueGrowth === null ? '' : summary.revenueGrowth.toFixed(2),
        ],
        ['Collected', csvAmount(summary.collected)],
        ['Outstanding', csvAmount(summary.outstanding)],
        ['Cost of goods', csvAmount(summary.costOfGoods)],
        ['Gross profit', csvAmount(summary.grossProfit)],
        [
          'Gross margin %',
          summary.grossMargin === null ? '' : summary.grossMargin.toFixed(2),
        ],
        ['Invoices', summary.invoiceCount],
        ['Average invoice value', csvAmount(summary.averageInvoiceValue)],
        ['Quotations', summary.quotationCount],
        ['Sales orders', summary.salesOrderCount],
        [
          'Sales conversion %',
          summary.salesConversion === null
            ? ''
            : summary.salesConversion.toFixed(2),
        ],
      ],
    );
  };

  return (
    <SidebarLayout>
      <FeatureGate featureKey="reportsEnabled" featureName="Revenue">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Revenue
                </h1>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                How much you earned, where it came from, and how much is still to
                be collected.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={!data}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>

          {/* Filters, in one row above the charts */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Revenue counted
              </label>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as 'NET' | 'GROSS')}
                className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
              >
                <option value="NET">Before GST</option>
                <option value="GROSS">Including GST</option>
              </select>
            </div>
          </div>

          {loading || !summary ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-16 text-center text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading revenue…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {tiles.map((tile) => {
                  const TileIcon = tile.icon;
                  return (
                    <div
                      key={tile.label}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
                    >
                      <div className="flex items-center gap-2 text-zinc-500">
                        <TileIcon className="h-4 w-4" />
                        <p className="text-[11px] font-semibold uppercase tracking-wide">
                          {tile.label}
                        </p>
                      </div>
                      <p
                        className={`mt-2 text-2xl font-black ${tile.tone || 'text-white'}`}
                      >
                        {tile.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">{tile.hint}</p>
                    </div>
                  );
                })}
              </div>

              <MonthlyTrend monthly={data.monthly || []} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryBars data={data.byCategory || []} />

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <h3 className="text-sm font-bold text-white">Top customers</h3>
                  <p className="text-xs text-zinc-500">
                    Ranked by revenue in the selected period.
                  </p>

                  {(data.topCustomers || []).length === 0 ? (
                    <p className="mt-6 text-center text-xs text-zinc-600">
                      No customer revenue in this period yet.
                    </p>
                  ) : (
                    <table className="mt-4 w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wide text-zinc-500">
                          <th className="pb-2 font-semibold">Customer</th>
                          <th className="pb-2 font-semibold text-right">Bills</th>
                          <th className="pb-2 font-semibold text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topCustomers.map((row: any) => (
                          <tr
                            key={row.customerId}
                            className="border-b border-zinc-800/60 last:border-0"
                          >
                            <td className="py-2 text-zinc-300">{row.name}</td>
                            <td className="py-2 text-right text-zinc-500">
                              {row.invoices}
                            </td>
                            <td className="py-2 text-right font-bold text-white">
                              {formatCurrency(row.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Profitability and pipeline health */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Gross Profit',
                    value: formatCurrency(summary.grossProfit),
                    hint:
                      summary.grossMargin === null
                        ? 'Revenue less cost of goods'
                        : `${summary.grossMargin.toFixed(1)}% margin`,
                  },
                  {
                    label: 'Cost of Goods',
                    value: formatCurrency(summary.costOfGoods),
                    hint: 'Purchase cost of what was sold',
                  },
                  {
                    label: 'Average Bill',
                    value: formatCurrency(summary.averageInvoiceValue),
                    hint: `Across ${summary.invoiceCount} bills`,
                  },
                  {
                    label: 'Sales Conversion',
                    value:
                      summary.salesConversion === null
                        ? '—'
                        : `${summary.salesConversion.toFixed(1)}%`,
                    hint: `${summary.salesOrderCount} orders from ${summary.quotationCount} quotations`,
                    icon: Percent,
                  },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {tile.label}
                    </p>
                    <p className="mt-2 text-xl font-black text-white">{tile.value}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">{tile.hint}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </FeatureGate>
    </SidebarLayout>
  );
}
