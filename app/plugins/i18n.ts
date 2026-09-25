import { createI18n } from 'vue-i18n'
import en from '~/locales/en'
import ru from '~/locales/ru'

/**
 * Locale messages only — numbers and dates are formatted by `app/utils`, which
 * has to produce shapes `Intl` does not offer: «2ч 30м», a bare capitalised
 * month name, hours rounded to the half.
 *
 * The starting locale is deliberately the fallback rather than the setting: the
 * settings row is read from SQLite after the app has mounted, and `useLocale`
 * switches to it then.
 */
export default defineNuxtPlugin(({ vueApp }) => {
  const i18n = createI18n({
    legacy: false,
    locale: 'ru',
    fallbackLocale: 'ru',
    messages: { ru, en },
    // Russian counts in three forms; the built-in rule is the English
    // two-form one, which would fold «задачи» and «задач» into one branch.
    pluralRules: {
      ru: (choice: number): number => {
        const ones = choice % 10
        const hundreds = choice % 100
        if (ones === 1 && hundreds !== 11) return 0
        if (ones >= 2 && ones <= 4 && (hundreds < 12 || hundreds > 14)) return 1
        return 2
      },
    },
  })

  vueApp.use(i18n)
  setGlobalI18n(i18n.global)
})
