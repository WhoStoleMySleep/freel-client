import type { Invoice } from '~/types'

const WIDTH = 304
const HEIGHT = 120
const PAD = 10

export interface MonthChart {
  width: number
  height: number
  /** Filled area under the actual (received) line. */
  actualAreaPath: string
  /** Solid line — money actually received. */
  actualPath: string
  /** Dashed line — what the invoices said was expected. */
  expectedPath: string
  calculatedTotal: number
  actualTotal: number
  hasDeviation: boolean
}

interface MonthTotals {
  /** Running total of what the invoices billed, one entry per day. */
  expected: number[]
  /** Running total of what actually arrived, one entry per day. */
  actual: number[]
  hasDeviation: boolean
}

function runningTotals(byDay: number[], days: number): number[] {
  const totals: number[] = []
  let sum = 0
  for (let day = 1; day <= days; day++) {
    sum += byDay[day] ?? 0
    totals.push(sum)
  }
  return totals
}

function monthTotals(invoices: Invoice[], days: number): MonthTotals {
  const billedByDay = new Array(days + 1).fill(0)
  const receivedByDay = new Array(days + 1).fill(0)
  let hasDeviation = false

  for (const invoice of invoices) {
    const day = dayOfMonth(invoice.dayKey)
    const received = invoice.factual ?? invoice.total
    billedByDay[day] += invoice.total
    receivedByDay[day] += received
    if (received !== invoice.total) hasDeviation = true
  }

  return {
    expected: runningTotals(billedByDay, days),
    actual: runningTotals(receivedByDay, days),
    hasDeviation,
  }
}

/** Projects cumulative values onto the SVG box; both lines share one scale. */
function createProjection(days: number, max: number) {
  const x = (i: number) => PAD + (i / (days - 1)) * (WIDTH - 2 * PAD)
  const y = (value: number) => HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD)

  const line = (values: number[]) =>
    values.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')

  const closeToBaseline = (path: string) =>
    `${path} L${x(days - 1).toFixed(1)} ${HEIGHT - PAD} L${x(0).toFixed(1)} ${HEIGHT - PAD} Z`

  return { line, closeToBaseline }
}

/**
 * Builds a cumulative-income chart for one calendar month from invoices dated
 * within it. The solid line is what was actually received; the dashed line is
 * the expected (invoiced) total — they diverge once a paid invoice's factual
 * amount differs from the amount billed.
 */
export function buildMonthChart(invoices: Invoice[], year: number, month: number): MonthChart {
  const days = daysInMonth(year, month)
  const monthInvoices = invoices.filter((invoice) => isDayKeyInMonth(invoice.dayKey, year, month))
  const { expected, actual, hasDeviation } = monthTotals(monthInvoices, days)

  const max = Math.max(1, expected.at(-1) ?? 0, actual.at(-1) ?? 0)
  const { line, closeToBaseline } = createProjection(days, max)
  const actualPath = line(actual)

  return {
    width: WIDTH,
    height: HEIGHT,
    actualAreaPath: closeToBaseline(actualPath),
    actualPath,
    expectedPath: line(expected),
    calculatedTotal: expected[days - 1] || 0,
    actualTotal: actual[days - 1] || 0,
    hasDeviation,
  }
}
