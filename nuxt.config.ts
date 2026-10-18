export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',

  // Тауриное окно — не сайт: индексировать нечего, а Nitro внутри бандла
  // взяться неоткуда. Весь фронт отдаётся статикой из .output/public.
  ssr: false,

  modules: ['@pinia/nuxt', '@nuxt/eslint'],

  // useI18n рядом с остальными автоимпортами: иначе его пришлось бы
  // импортировать руками в каждом компоненте, где есть хоть одна строка.
  imports: {
    presets: [{ from: 'vue-i18n', imports: ['useI18n'] }],
  },

  eslint: {
    config: { stylistic: false },
  },

  css: [
    '@fontsource/onest/400.css',
    '@fontsource/onest/500.css',
    '@fontsource/onest/600.css',
    '@fontsource/onest/700.css',
    '@fontsource/unbounded/500.css',
    '@fontsource/unbounded/600.css',
    '@fontsource/jetbrains-mono/400.css',
    '@fontsource/jetbrains-mono/500.css',
    '@fontsource/jetbrains-mono/600.css',
    '~/assets/css/theme.css',
    '~/assets/css/app.css',
    '~/assets/css/parts.css',
    '~/assets/css/desktop.css',
    '~/assets/css/panel.css',
  ],

  app: {
    head: {
      title: 'freel',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content',
        },
      ],
    },
  },

  devtools: { enabled: false },

  // Порт фиксированный: его ждёт devUrl в tauri.conf.json.
  devServer: { port: 1420 },

  vite: {
    clearScreen: false,
    server: {
      strictPort: true,
      watch: { ignored: ['**/src-tauri/**'] },
    },
  },
})
