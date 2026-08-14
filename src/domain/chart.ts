import { daysInMonth, dayOfMonth, isDayKeyInMonth } from '../utils/date';
import { Invoice } from './types';

export interface MonthChart {
  width: number;
  height: number;
  /** Filled area under the actual (received) line. */
  actualAreaPath: string;
  /** Solid line — money actually received. */
  actualPath: string;
  /** Dashed line — what the invoices said was expected. */
  expectedPath: string;
  calculatedTotal: number;
  actualTotal: number;
  hasDeviation: boolean;
}

// Builds a cumulative-income chart for one calendar month from invoices dated
// within it. The solid line is what was actually received; the dashed line is
// the expected (invoiced) total — they diverge once a paid invoice's factual
// amount differs from the amount billed.
export function buildMonthChart(invoices: Invoice[], year: number, month: number): MonthChart {
  const width = 304;
  const height = 120;
  const pad = 10;
  const days = daysInMonth(year, month);

  const monthInvoices = invoices.filter((inv) => isDayKeyInMonth(inv.dayKey, year, month));

  const calcByDay = new Array(days + 1).fill(0);
  const actualByDay = new Array(days + 1).fill(0);
  let hasDeviation = false;

  for (const inv of monthInvoices) {
    const d = dayOfMonth(inv.dayKey);
    calcByDay[d] += inv.total;
    const actual = inv.factual != null ? inv.factual : inv.total;
    actualByDay[d] += actual;
    if (actual !== inv.total) hasDeviation = true;
  }

  const calcCumulative: number[] = [];
  const actualCumulative: number[] = [];
  let ca = 0;
  let aa = 0;
  for (let d = 1; d <= days; d++) {
    ca += calcByDay[d];
    aa += actualByDay[d];
    calcCumulative.push(ca);
    actualCumulative.push(aa);
  }

  const max = Math.max(1, calcCumulative[days - 1], actualCumulative[days - 1]);
  const x = (i: number) => pad + (i / (days - 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - (v / max) * (height - 2 * pad);

  const toPath = (vals: number[]) =>
    vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');

  const expectedPath = toPath(calcCumulative);
  const actualPath = toPath(actualCumulative);
  const actualAreaPath =
    actualPath + ' L' + x(days - 1).toFixed(1) + ' ' + (height - pad) + ' L' + x(0).toFixed(1) + ' ' + (height - pad) + ' Z';

  return {
    width,
    height,
    actualAreaPath,
    actualPath,
    expectedPath,
    calculatedTotal: calcCumulative[days - 1] || 0,
    actualTotal: actualCumulative[days - 1] || 0,
    hasDeviation,
  };
}
