import type { Currency } from '~/types'

export function formatMoney(value: number, currency: Currency): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ${CURRENCY_SYMBOL[currency]}`
}

export function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('ru-RU')
}
