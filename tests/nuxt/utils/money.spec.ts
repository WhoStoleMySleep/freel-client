import { describe, expect, test } from 'vitest'

describe('formatMoney', () => {
  test('подставляет символ валюты', async () => {
    const { formatMoney } = await import('~/utils/money')
    expect(formatMoney(1000, 'USD', 'ru')).toContain('$')
  })

  test('по-русски символ идёт после суммы, по-английски — перед', async () => {
    const { formatMoney } = await import('~/utils/money')
    expect(formatMoney(1000, 'USD', 'ru').endsWith('$')).toBe(true)
    expect(formatMoney(1000, 'USD', 'en').startsWith('$')).toBe(true)
  })

  test('округляет копейки', async () => {
    const { formatAmount } = await import('~/utils/money')
    expect(formatAmount(1499.6, 'ru')).toBe((1500).toLocaleString('ru-RU'))
  })

  test('разряды разделяются по правилам локали', async () => {
    const { formatAmount } = await import('~/utils/money')
    expect(formatAmount(1500, 'en')).toBe('1,500')
  })

  test('ноль остаётся нулём', async () => {
    const { formatAmount } = await import('~/utils/money')
    expect(formatAmount(0, 'ru')).toBe('0')
  })
})

describe('nextCurrency', () => {
  test('перебирает валюты по кругу', async () => {
    const { CURRENCIES, nextCurrency } = await import('~/utils/currency')
    expect(nextCurrency(CURRENCIES.at(-1)!)).toBe(CURRENCIES[0])
  })
})
