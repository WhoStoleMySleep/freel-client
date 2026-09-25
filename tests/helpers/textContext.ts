import en from '~/locales/en'
import ru from '~/locales/ru'
import type { Locale, TextContext } from '~/types'

const MESSAGES = { ru, en }

function lookup(locale: Locale, key: string): string {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    MESSAGES[locale],
  )
  if (typeof value !== 'string') throw new Error(`нет ключа ${key} в локали ${locale}`)
  return value
}

/**
 * The real dictionaries behind a minimal `t`, so a test also fails when a key
 * is missing — vue-i18n itself needs a Vue app, which pure helpers never have.
 */
export function textContext(locale: Locale = 'ru'): TextContext {
  return {
    locale,
    t: (key, params) => lookup(locale, key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '')),
  }
}
