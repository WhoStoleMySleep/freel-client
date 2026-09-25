import { describe, expect, test, vi } from 'vitest'

describe('monthLabel', () => {
  test('берёт название месяца из локали', async () => {
    const { monthLabel } = await import('~/utils/date')
    expect(monthLabel(2026, 8, 'ru')).toBe('Сентябрь 2026')
    expect(monthLabel(2026, 8, 'en')).toBe('September 2026')
  })
})

describe('shortDate', () => {
  test('по-русски день идёт перед месяцем', async () => {
    const { shortDate } = await import('~/utils/date')
    expect(shortDate('2026-09-05', 'ru')).toBe('05 сен')
  })

  test('по-английски месяц идёт перед днём', async () => {
    const { shortDate } = await import('~/utils/date')
    expect(shortDate('2026-09-05', 'en')).toBe('Sep 05')
  })
})

describe('greetingKey', () => {
  test('час определяет время суток', async () => {
    const { greetingKey } = await import('~/utils/date')
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 8, 5, 3))
      expect(greetingKey()).toBe('night')
      vi.setSystemTime(new Date(2026, 8, 5, 9))
      expect(greetingKey()).toBe('morning')
      vi.setSystemTime(new Date(2026, 8, 5, 14))
      expect(greetingKey()).toBe('day')
      vi.setSystemTime(new Date(2026, 8, 5, 21))
      expect(greetingKey()).toBe('evening')
    }
    finally {
      vi.useRealTimers()
    }
  })
})
