import type { ComputedRef } from 'vue'

/** Resolves the effective light/dark mode and stamps it on <html>. */
export function useResolvedTheme(): ComputedRef<boolean> {
  const { themeMode } = storeToRefs(useSettingsStore())
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const systemDark = ref(media?.matches ?? true)

  const onChange = (e: MediaQueryListEvent) => {
    systemDark.value = e.matches
  }
  media?.addEventListener('change', onChange)
  onScopeDispose(() => media?.removeEventListener('change', onChange))

  const isDark = computed(() => (themeMode.value === 'system' ? systemDark.value : themeMode.value === 'dark'))
  watchEffect(() => {
    document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
  })

  return isDark
}
