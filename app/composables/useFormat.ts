import type { Currency, Locale } from '~/types'

/**
 * The formatters from `app/utils` with the current locale already applied.
 *
 * They take the locale as an argument so they stay pure and testable; this is
 * what saves every template from passing it at each call site.
 */
export function useFormat() {
  const { locale } = useI18n()
  const current = computed<Locale>(() => locale.value as Locale)

  return {
    money: (value: number, currency: Currency) => formatMoney(value, currency, current.value),
    amount: (value: number) => formatAmount(value, current.value),
    minutes: (value: number) => formatMinutes(value, current.value),
    hours: (value: number) => formatHoursRounded(value, current.value),
    shortDate: (dayKey: string) => shortDate(dayKey, current.value),
    monthLabel: (year: number, month: number) => monthLabel(year, month, current.value),
  }
}
