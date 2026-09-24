import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
        overrides: {
          experimental: { appManifest: false },
        },
      },
    },
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/composables/**', 'app/stores/**', 'app/utils/**', 'app/repositories/**'],
    },
    hookTimeout: 60000,
  },
})
