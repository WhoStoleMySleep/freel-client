import { describe, expect, test } from 'vitest'

describe('formatMinutes', () => {
  test('нули показывает одним «0м»', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(0)).toBe('0м')
  })

  test('меньше часа — только минуты', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(45)).toBe('45м')
  })

  test('ровно час — без минутной части', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(60)).toBe('1ч')
  })

  test('часы и минуты разделяет пробелом', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(125)).toBe('2ч 5м')
  })
})

describe('formatHoursRounded', () => {
  test('округляет до получаса вниз', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(70)).toBe('1 ч')
  })

  test('половину пишет через запятую', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(95)).toBe('1,5 ч')
  })

  test('ноль минут — ноль часов', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(0)).toBe('0 ч')
  })
})

describe('formatClock', () => {
  test('до часа часы не показывает', async () => {
    const { formatClock } = await import('~/utils/time')
    expect(formatClock(65)).toBe('01:05')
  })

  test('от часа добавляет часовую группу', async () => {
    const { formatClock } = await import('~/utils/time')
    expect(formatClock(3725)).toBe('01:02:05')
  })
})
