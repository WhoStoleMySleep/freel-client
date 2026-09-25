<script setup lang="ts">
import type { ThemeMode } from '~/types'

const emit = defineEmits<{ finish: [] }>()

const THEME_MODES: ThemeMode[] = ['system', 'dark', 'light']

const { t } = useI18n()
const settings = useSettingsStore()
const { currency, themeMode, defaultRate } = storeToRefs(settings)

const step = ref<1 | 2>(1)
const rateStr = ref(String(defaultRate.value))

watch(rateStr, (value) => {
  const rate = parseFloat(value)
  void settings.setDefaultRate(Number.isFinite(rate) ? rate : 0)
})

async function finish(): Promise<void> {
  await settings.completeOnboarding()
  emit('finish')
}
</script>

<template>
  <div class="onb">
    <div class="onb-top">
      <button v-if="step === 1" class="onb-skip" @click="finish">{{ t('onboarding.skip') }}</button>
    </div>

    <div v-if="step === 1" class="onb-step1">
      <div class="onb-logo">
        <UiLogoMark :size="62" />
      </div>
      <h1 class="onb-h1">{{ t('onboarding.welcome') }}<br>{{ t('onboarding.welcomeApp') }}</h1>
      <p class="onb-p">
        {{ t('onboarding.intro') }}
      </p>
    </div>

    <div v-else class="onb-step2">
      <h2 class="onb-h2">{{ t('onboarding.basics') }}</h2>
      <p class="onb-p2">{{ t('onboarding.basicsHint') }}</p>

      <div class="onb-section">
        <div class="onb-label">{{ t('onboarding.currency') }}</div>
        <div class="chips" style="gap: 8px">
          <UiChip
            v-for="code in CURRENCIES"
            :key="code"
            :label="code"
            :active="currency === code"
            @click="settings.setCurrency(code)"
          />
        </div>
      </div>

      <div class="onb-section">
        <div class="onb-label">{{ t('onboarding.rate') }}</div>
        <UiField v-model="rateStr" numeric />
      </div>

      <div class="onb-section">
        <div class="onb-label">{{ t('onboarding.theme') }}</div>
        <div class="chips" style="gap: 8px">
          <UiChip
            v-for="mode in THEME_MODES"
            :key="mode"
            :label="t(`theme.${mode}`)"
            :active="themeMode === mode"
            grow
            @click="settings.setThemeMode(mode)"
          />
        </div>
      </div>
    </div>

    <div class="onb-footer">
      <div class="onb-dots">
        <span :class="step === 1 ? 'onb-dot active' : 'onb-dot'" />
        <span :class="step === 2 ? 'onb-dot active' : 'onb-dot'" />
      </div>
      <button class="onb-next" @click="step === 1 ? (step = 2) : finish()">
        {{ step === 1 ? t('onboarding.start') : t('onboarding.finish') }}
      </button>
    </div>
  </div>
</template>
