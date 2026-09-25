// All dates are handled as local-time ISO day strings ('YYYY-MM-DD') for calendar
// comparisons, and full ISO timestamps for ordering/audit fields.

import type { Locale } from '~/types'

/**
 * Month names are listed rather than taken from `Intl`, which renders them for
 * a full date — «сентябрь 2026 г.» — where the app wants a bare capitalised
 * name standing on its own.
 */
const MONTH_NAMES: Record<Locale, string[]> = {
  ru: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}

const MONTH_SHORT: Record<Locale, string[]> = {
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(): string {
  return toDayKey(new Date())
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function dayKeyFromIso(iso: string): string {
  return toDayKey(new Date(iso))
}

export function isTodayIso(iso: string): boolean {
  return dayKeyFromIso(iso) === todayKey()
}

export function monthLabel(year: number, month: number, locale: Locale): string {
  return `${MONTH_NAMES[locale][month]} ${year}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function shortDate(dayKey: string, locale: Locale): string {
  const [, m, d] = dayKey.split('-').map(Number)
  const month = MONTH_SHORT[locale][m! - 1]
  return locale === 'en' ? `${month} ${pad(d!)}` : `${pad(d!)} ${month}`
}

export function isDayKeyInMonth(dayKey: string, year: number, month: number): boolean {
  const [y, m] = dayKey.split('-').map(Number)
  return y === year && m! - 1 === month
}

export function dayOfMonth(dayKey: string): number {
  return Number(dayKey.split('-')[2])
}

/** Which greeting the hour calls for; the caller turns it into words. */
export function greetingKey(): 'night' | 'morning' | 'day' | 'evening' {
  const h = new Date().getHours()
  if (h < 6) return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'day'
  return 'evening'
}
