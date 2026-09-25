import type { ComputedRef } from 'vue'
import type { Locale } from '~/types'

/** Anything but Russian falls to English — those are the two locales shipped. */
export function systemLocale(): Locale {
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

/**
 * Resolves the effective locale and applies it to vue-i18n and <html lang>.
 *
 * Both windows call this: each runs its own Vue app with its own i18n
 * instance, so the panel would otherwise stay on the starting locale while the
 * main window follows the setting.
 */
export function useLocale(): ComputedRef<Locale> {
  const { language } = storeToRefs(useSettingsStore())
  const i18n = useI18n()

  const locale = computed<Locale>(() => (language.value === 'system' ? systemLocale() : language.value))
  watchEffect(() => {
    i18n.locale.value = locale.value
    document.documentElement.lang = locale.value
  })

  return locale
}
