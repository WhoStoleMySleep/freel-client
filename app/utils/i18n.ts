import type { Locale } from '~/types'

/** The part of vue-i18n's composer this bridge needs, spelled out so the
 * dictionary-shaped generics of the real one do not have to be repeated. */
interface GlobalI18n {
  t: (key: string, params?: Record<string, unknown>) => string
  locale: { value: string }
}

let composer: GlobalI18n | null = null

/** Called once by the i18n plugin; each window fills in its own instance. */
export function setGlobalI18n(instance: GlobalI18n): void {
  composer = instance
}

/**
 * Translation for code that runs outside a component: stores, notifications,
 * window titles. `useI18n` needs a component instance, and these run long after
 * setup — from a timer tick or a sync exchange.
 */
export function translate(key: string, params?: Record<string, unknown>): string {
  if (!composer) return key
  return params ? composer.t(key, params) : composer.t(key)
}

export function currentLocale(): Locale {
  return (composer?.locale.value as Locale) ?? 'ru'
}
