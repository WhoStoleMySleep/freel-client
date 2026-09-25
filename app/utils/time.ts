import type { Locale } from '~/types'

/** Single-letter unit suffixes, the compact form task cards are built around. */
const UNITS: Record<Locale, { hour: string, minute: string, hoursShort: string }> = {
  ru: { hour: 'ч', minute: 'м', hoursShort: 'ч' },
  en: { hour: 'h', minute: 'm', hoursShort: 'h' },
}

export function formatMinutes(totalMinutes: number, locale: Locale): string {
  const u = UNITS[locale]
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (!h && !m) return `0${u.minute}`
  return (h ? `${h}${u.hour}` : '') + (m ? (h ? ' ' : '') + `${m}${u.minute}` : '')
}

/** Hours rounded to the nearest half hour: 1, 1.5, 2 … */
export function formatHoursRounded(totalMinutes: number, locale: Locale): string {
  const hours = Math.round((totalMinutes / 60) * 2) / 2
  const text = Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(1).replace('.', locale === 'ru' ? ',' : '.')
  return `${text} ${UNITS[locale].hoursShort}`
}

export function formatClock(seconds: number): string {
  const hh = Math.floor(seconds / 3600)
  const mm = Math.floor((seconds % 3600) / 60)
  const ss = Math.floor(seconds % 60)
  const p = (n: number) => String(n).padStart(2, '0')
  return (hh ? `${p(hh)}:` : '') + `${p(mm)}:${p(ss)}`
}
