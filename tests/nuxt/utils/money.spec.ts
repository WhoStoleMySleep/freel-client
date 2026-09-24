import { describe, expect, test } from 'vitest'

describe('formatMoney', () => {
  test('подставляет символ валюты', async () => {
    const { formatMoney } = await import('~/utils/money')
    expect(formatMoney(1000, 'USD')).toContain('$')
  })

  test('округляет копейки', async () => {
    const { formatAmount } = await import('~/utils/money')
    expect(formatAmount(1499.6)).toBe((1500).toLocaleString('ru-RU'))
  })

  test('ноль остаётся нулём', async () => {
    const { formatAmount } = await import('~/utils/money')
    expect(formatAmount(0)).toBe('0')
  })
})

describe('nextCurrency', () => {
  test('перебирает валюты по кругу', async () => {
    const { CURRENCIES, nextCurrency } = await import('~/utils/currency')
    expect(nextCurrency(CURRENCIES.at(-1)!)).toBe(CURRENCIES[0])
  })
})
