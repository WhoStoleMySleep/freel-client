<script setup lang="ts">
import type { IconName } from '~/types'

type Tab = 'dash' | 'projects' | 'billing'

/** The splash stays up this long even if the data is ready sooner. */
const MIN_SPLASH_MS = 2400

const TABS: { key: Tab, icon: IconName }[] = [
  { key: 'dash', icon: 'tab-dash' },
  { key: 'projects', icon: 'tab-projects' },
  { key: 'billing', icon: 'tab-billing' },
]

const app = useAppStore()
const { ready, phase } = storeToRefs(app)
const { hasOnboarded } = storeToRefs(useSettingsStore())

const tab = ref<Tab>('dash')
const minElapsed = ref(false)
const error = ref<string | null>(null)

const { t } = useI18n()
const isDark = useResolvedTheme()
useLocale()
useTimerInWindowTitle()
useDbSync()
useTimerActions()

let splash: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  app.hydrate().catch((e) => {
    error.value = String(e)
  })
  splash = setTimeout(() => {
    minElapsed.value = true
  }, MIN_SPLASH_MS)
})

onUnmounted(() => {
  if (splash) clearTimeout(splash)
})

watch([ready, minElapsed], () => {
  if (phase.value !== 'loading' || !ready.value || !minElapsed.value) return
  app.setPhase(hasOnboarded.value ? 'app' : 'onboarding')
})
</script>

<template>
  <div v-if="error" class="screen">
    <div class="empty">
      <div class="empty-title">{{ t('app.startupError') }}</div>
      <p class="empty-text">{{ error }}</p>
    </div>
  </div>

  <div v-else-if="phase === 'loading'" class="loading">
    <div class="wordmark">freel</div>
    <div class="loading-sub">{{ t('app.tagline') }}</div>
  </div>

  <ScreenOnboarding v-else-if="phase === 'onboarding'" @finish="app.setPhase('app')" />

  <div v-else class="app">
    <ScreenDashboard v-if="tab === 'dash'" :is-dark="isDark" @replay-onboarding="app.setPhase('onboarding')" />
    <ScreenProjects v-else-if="tab === 'projects'" />
    <ScreenBilling v-else />

    <nav class="tabbar">
      <div class="sidebar-brand">freel</div>
      <button
        v-for="item in TABS"
        :key="item.key"
        :class="tab === item.key ? 'tab active' : 'tab'"
        @click="tab = item.key"
      >
        <UiIcon :name="item.icon" />
        {{ t(`tabs.${item.key}`) }}
      </button>
    </nav>
  </div>
</template>
