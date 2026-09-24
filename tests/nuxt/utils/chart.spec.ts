import { describe, expect, test } from 'vitest'
import type { Invoice } from '~/types'

function invoice(dayKey: string, total: number, factual: number | null = null): Invoice {
  return {
    id: dayKey + total,
    number: '#P-00001',
    projectName: 'Проект',
    dayKey,
    status: factual == null ? 'awaiting' : 'paid',
    factual,
    total,
    items: [],
  }
}

describe('buildMonthChart', () => {
  test('складывает счета месяца нарастающим итогом', async () => {
    const { buildMonthChart } = await import('~/utils/chart')

    const chart = buildMonthChart([invoice('2026-03-05', 1000), invoice('2026-03-20', 500)], 2026, 2)

    expect(chart.calculatedTotal).toBe(1500)
    expect(chart.actualTotal).toBe(1500)
  })

  test('не берёт счета из других месяцев', async () => {
    const { buildMonthChart } = await import('~/utils/chart')

    const chart = buildMonthChart([invoice('2026-02-28', 1000), invoice('2026-04-01', 700)], 2026, 2)

    expect(chart.calculatedTotal).toBe(0)
    expect(chart.actualTotal).toBe(0)
  })

  test('фактическая сумма расходится с выставленной', async () => {
    const { buildMonthChart } = await import('~/utils/chart')

    const chart = buildMonthChart([invoice('2026-03-05', 1000, 800)], 2026, 2)

    expect(chart.calculatedTotal).toBe(1000)
    expect(chart.actualTotal).toBe(800)
    expect(chart.hasDeviation).toBe(true)
  })

  test('оплата ровно на сумму счёта расхождением не считается', async () => {
    const { buildMonthChart } = await import('~/utils/chart')

    const chart = buildMonthChart([invoice('2026-03-05', 1000, 1000)], 2026, 2)

    expect(chart.hasDeviation).toBe(false)
  })

  test('пустой месяц даёт плоскую линию по числу дней', async () => {
    const { buildMonthChart } = await import('~/utils/chart')

    const chart = buildMonthChart([], 2026, 1)

    expect(chart.expectedPath.split(' ')).toHaveLength(28 * 2)
    expect(chart.expectedPath.startsWith('M')).toBe(true)
    expect(chart.hasDeviation).toBe(false)
  })

  test('область под линией замыкается на базовую линию', async () => {
    const { buildMonthChart } = await import('~/utils/chart')

    const chart = buildMonthChart([invoice('2026-03-05', 1000)], 2026, 2)

    expect(chart.actualAreaPath.startsWith(chart.actualPath)).toBe(true)
    expect(chart.actualAreaPath.endsWith('Z')).toBe(true)
  })
})
