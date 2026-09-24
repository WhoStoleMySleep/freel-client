import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'

let systemDark = true
const listeners = new Set<(e: MediaQueryListEvent) => void>()

function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      get matches() {
        return systemDark
      },
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    }),
  })
}

function systemSwitchesTo(dark: boolean): void {
  systemDark = dark
  for (const fn of listeners) fn({ matches: dark } as MediaQueryListEvent)
}

async function settingsStore() {
  const { useAppStore } = await import('~/stores/app')
  const { useSettingsStore } = await import('~/stores/settings')
  await useAppStore().hydrate()
  return useSettingsStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
  listeners.clear()
  systemDark = true
  stubMatchMedia()
})

describe('useResolvedTheme', () => {
  test('выбранная тема важнее системной', async () => {
    const settings = await settingsStore()
    await settings.setThemeMode('light')
    const { useResolvedTheme } = await import('~/composables/useResolvedTheme')
    const scope = effectScope()
    const isDark = scope.run(() => useResolvedTheme())!
    await nextTick()

    expect(isDark.value).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    scope.stop()
  })

  test('системная тема следует за системой', async () => {
    const settings = await settingsStore()
    await settings.setThemeMode('system')
    const { useResolvedTheme } = await import('~/composables/useResolvedTheme')
    const scope = effectScope()
    const isDark = scope.run(() => useResolvedTheme())!
    await nextTick()
    expect(isDark.value).toBe(true)

    systemSwitchesTo(false)
    await nextTick()

    expect(isDark.value).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    scope.stop()
  })

  test('смена темы в настройках сразу видна на странице', async () => {
    const settings = await settingsStore()
    await settings.setThemeMode('light')
    const { useResolvedTheme } = await import('~/composables/useResolvedTheme')
    const scope = effectScope()
    scope.run(() => useResolvedTheme())
    await nextTick()

    await settings.setThemeMode('dark')
    await nextTick()

    expect(document.documentElement.dataset.theme).toBe('dark')
    scope.stop()
  })

  test('закрытая область видимости отписывается от системной темы', async () => {
    const settings = await settingsStore()
    await settings.setThemeMode('system')
    const { useResolvedTheme } = await import('~/composables/useResolvedTheme')
    const scope = effectScope()
    scope.run(() => useResolvedTheme())

    scope.stop()

    expect(listeners.size).toBe(0)
  })
})
