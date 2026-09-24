import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

async function settingsStore() {
  const { useAppStore } = await import('~/stores/app')
  const { useSettingsStore } = await import('~/stores/settings')
  await useAppStore().hydrate()
  return useSettingsStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('настройки', () => {
  test('смена темы видна через геттер', async () => {
    const settings = await settingsStore()

    await settings.setThemeMode('dark')

    expect(settings.themeMode).toBe('dark')
  })

  test('смена валюты не трогает остальные настройки', async () => {
    const settings = await settingsStore()
    const rate = settings.defaultRate

    await settings.setCurrency('USD')

    expect(settings.currency).toBe('USD')
    expect(settings.defaultRate).toBe(rate)
  })

  test('ставка по умолчанию сохраняется', async () => {
    const settings = await settingsStore()

    await settings.setDefaultRate(4200)

    expect(settings.defaultRate).toBe(4200)
  })

  test('пройденный онбординг больше не показывается', async () => {
    const settings = await settingsStore()

    await settings.completeOnboarding()

    expect(settings.hasOnboarded).toBe(true)
  })

  test('компактная форма задачи переключается', async () => {
    const settings = await settingsStore()

    await settings.setCompactTaskForm(true)

    expect(settings.compactTaskForm).toBe(true)
  })
})
