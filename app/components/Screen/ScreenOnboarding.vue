<script setup lang="ts">
import type { ThemeMode } from '~/types'

const emit = defineEmits<{ finish: [] }>()

const THEME_OPTIONS: { mode: ThemeMode, label: string }[] = [
  { mode: 'system', label: 'Системная' },
  { mode: 'dark', label: 'Тёмная' },
  { mode: 'light', label: 'Светлая' },
]

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
      <button v-if="step === 1" class="onb-skip" @click="finish">Пропустить</button>
    </div>

    <div v-if="step === 1" class="onb-step1">
      <div class="onb-logo">
        <UiLogoMark :size="62" />
      </div>
      <h1 class="onb-h1">Добро пожаловать<br>в freel</h1>
      <p class="onb-p">
        Считайте отработанные часы, ведите задачи по статусам и генерируйте счета — полностью офлайн, ничего лишнего.
      </p>
    </div>

    <div v-else class="onb-step2">
      <h2 class="onb-h2">Базовые настройки</h2>
      <p class="onb-p2">Их всегда можно изменить в разделе «Настройки».</p>

      <div class="onb-section">
        <div class="onb-label">Валюта</div>
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
        <div class="onb-label">Стоимость часа по умолчанию</div>
        <UiField v-model="rateStr" numeric />
      </div>

      <div class="onb-section">
        <div class="onb-label">Тема оформления</div>
        <div class="chips" style="gap: 8px">
          <UiChip
            v-for="option in THEME_OPTIONS"
            :key="option.mode"
            :label="option.label"
            :active="themeMode === option.mode"
            grow
            @click="settings.setThemeMode(option.mode)"
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
        {{ step === 1 ? 'Начать' : 'Готово, к работе' }}
      </button>
    </div>
  </div>
</template>
