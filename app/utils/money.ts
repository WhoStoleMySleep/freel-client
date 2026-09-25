import type { Currency, Locale } from '~/types'

const GROUPING_LOCALE: Record<Locale, string> = { ru: 'ru-RU', en: 'en-US' }

/**
 * Currency symbols are kept rather than left to `Intl` with `style: 'currency'`:
 * it renders RUB as «RUB» in English and CNY as «CN¥» in both, where the app
 * wants the bare ₽ and ¥ it shows everywhere else.
 */
export function formatMoney(value: number, currency: Currency, locale: Locale): string {
  const amount = formatAmount(value, locale)
  const symbol = CURRENCY_SYMBOL[currency]
  return locale === 'en' ? `${symbol}${amount}` : `${amount} ${symbol}`
}

export function formatAmount(value: number, locale: Locale): string {
  return Math.round(value).toLocaleString(GROUPING_LOCALE[locale])
}
