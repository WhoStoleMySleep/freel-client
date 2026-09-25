import { describe, expect, test } from 'vitest'

describe('formatMinutes', () => {
  test('нули показывает одним «0м»', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(0, 'ru')).toBe('0м')
  })

  test('меньше часа — только минуты', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(45, 'ru')).toBe('45м')
  })

  test('ровно час — без минутной части', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(60, 'ru')).toBe('1ч')
  })

  test('часы и минуты разделяет пробелом', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(125, 'ru')).toBe('2ч 5м')
  })

  test('по-английски использует латинские сокращения', async () => {
    const { formatMinutes } = await import('~/utils/time')
    expect(formatMinutes(125, 'en')).toBe('2h 5m')
  })
})

describe('formatHoursRounded', () => {
  test('округляет до получаса вниз', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(70, 'ru')).toBe('1 ч')
  })

  test('половину пишет через запятую', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(95, 'ru')).toBe('1,5 ч')
  })

  test('ноль минут — ноль часов', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(0, 'ru')).toBe('0 ч')
  })

  test('по-английски половина пишется через точку', async () => {
    const { formatHoursRounded } = await import('~/utils/time')
    expect(formatHoursRounded(95, 'en')).toBe('1.5 h')
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
