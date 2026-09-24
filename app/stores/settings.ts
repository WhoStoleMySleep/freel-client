import type { Currency, Settings, ThemeMode } from '~/types'

/** App settings: a single database row every screen reads from. */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

  const themeMode = computed(() => settings.value.themeMode)
  const currency = computed(() => settings.value.currency)
  const defaultRate = computed(() => settings.value.defaultRate)
  const hasOnboarded = computed(() => settings.value.hasOnboarded)
  const compactTaskForm = computed(() => settings.value.compactTaskForm)
  const deviceCode = computed(() => settings.value.deviceCode ?? '')

  /** Takes settings from the data source — on load and after a sync exchange. */
  function apply(next: Settings): void {
    settings.value = next
  }

  async function patch(part: Partial<Settings>): Promise<void> {
    await useAppStore().source.updateSettings(part)
    settings.value = { ...settings.value, ...part }
  }

  return {
    settings,
    themeMode,
    currency,
    defaultRate,
    hasOnboarded,
    compactTaskForm,
    deviceCode,
    apply,
    setThemeMode: (mode: ThemeMode) => patch({ themeMode: mode }),
    setCurrency: (next: Currency) => patch({ currency: next }),
    setDefaultRate: (rate: number) => patch({ defaultRate: rate }),
    setCompactTaskForm: (value: boolean) => patch({ compactTaskForm: value }),
    completeOnboarding: () => patch({ hasOnboarded: true }),
  }
})
