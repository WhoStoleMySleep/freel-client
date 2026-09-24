<script setup lang="ts">
import type { BackupFile, SyncStatus, ThemeMode } from '~/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [], replayOnboarding: [] }>()

const THEME_OPTIONS: { mode: ThemeMode, label: string }[] = [
  { mode: 'system', label: 'Системная' },
  { mode: 'dark', label: 'Тёмная' },
  { mode: 'light', label: 'Светлая' },
]

type Busy = 'export' | 'import' | 'login' | 'register' | 'sync'

interface Job {
  kind: Busy
  flash: (message: string | null) => void
  /** Put in front of a failure when the bare error would not read as one. */
  prefix?: string
}

const app = useAppStore()
const settings = useSettingsStore()
const { demoMode } = storeToRefs(app)
const { currency, defaultRate, themeMode, compactTaskForm } = storeToRefs(settings)

const rateStr = ref(String(defaultRate.value))
const busy = ref<Busy | null>(null)
const { value: notice, flash: flashNotice } = useFlash<string | null>(null, 4000)

const sync = ref<SyncStatus | null>(null)
const url = ref('')
const email = ref('')
const password = ref('')
const { value: syncNotice, flash: flashSync } = useFlash<string | null>(null, 5000)
const canAuth = computed(() => url.value.trim().length > 8 && email.value.includes('@') && password.value.length >= 8)

const compact = computed({
  get: () => compactTaskForm.value,
  set: value => void settings.setCompactTaskForm(value),
})
const demo = computed({
  get: () => demoMode.value,
  set: () => void app.toggleDemoMode(),
})

watch(rateStr, (value) => {
  const rate = parseFloat(value)
  void settings.setDefaultRate(Number.isFinite(rate) ? rate : 0)
})

async function refreshSync(): Promise<void> {
  sync.value = await syncStatus().catch(() => null)
}

watch(() => props.open, async (open) => {
  if (!open) return
  rateStr.value = String(defaultRate.value)
  await refreshSync()
  if (sync.value?.url) url.value = sync.value.url
  if (sync.value?.email) email.value = sync.value.email
})

/** Runs one long operation, keeping every button in the modal disabled meanwhile. */
async function run(job: Job, action: () => Promise<string | null>): Promise<void> {
  busy.value = job.kind
  try {
    job.flash(await action())
  }
  catch (e) {
    job.flash((job.prefix ?? '') + String(e))
  }
  finally {
    busy.value = null
  }
}

const doRegister = () => run({ kind: 'register', flash: flashSync }, async () => {
  await syncRegister(url.value.trim(), email.value.trim(), password.value)
  return 'Аккаунт создан, теперь войдите'
})

const doLogin = () => run({ kind: 'login', flash: flashSync }, async () => {
  await syncLogin(url.value.trim(), email.value.trim(), password.value)
  password.value = ''
  await refreshSync()
  return 'Подключено'
})

async function doLogout(): Promise<void> {
  await syncLogout().catch(() => {})
  await refreshSync()
  flashSync('Отключено. Данные остались на устройстве.')
}

const doSync = () => run({ kind: 'sync', flash: flashSync }, async () => {
  const result = await syncNow()
  // The merge rewrote rows underneath the stores, so they have to re-read.
  await app.hydrate()
  await refreshSync()
  return `Обмен завершён: отправлено ${result.sent}, получено ${result.received}`
})

const doBackup = () => run({ kind: 'export', flash: flashNotice, prefix: 'Не получилось сохранить: ' }, async () => {
  const saved = await saveBackup(await app.buildBackup())
  return saved.status === 'saved' ? 'Копия сохранена' : null
})

/** Restoring replaces everything, so the copy is described before it is applied. */
function confirmRestore(backup: BackupFile): boolean {
  const summary = summarize(backup)
  return window.confirm(
    `В копии: проектов — ${summary.projects}, задач — ${summary.tasks}, счетов — ${summary.invoices}.\n`
    + `Создана: ${shortDate(summary.exportedAt.slice(0, 10))}.\n\n`
    + 'Текущие данные будут полностью заменены. Отменить это будет нельзя.'
  )
}

const doRestore = () => run({ kind: 'import', flash: flashNotice, prefix: 'Не получилось восстановить: ' }, async () => {
  const picked = await pickBackup()
  if (picked.status === 'cancelled') return null
  if (picked.status === 'error') return picked.message
  if (!confirmRestore(picked.backup)) return null
  await app.restoreBackup(picked.backup)
  emit('close')
  return 'Данные восстановлены'
})
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead title="Настройки" @close="emit('close')" />
    <div class="stack" style="gap: 16px">
      <div class="card-box">
        <div class="card-label" style="margin-bottom: 6px">Стоимость часа по умолчанию</div>
        <div style="display: flex; align-items: center; gap: 10px">
          <div style="flex: 1">
            <UiField v-model="rateStr" numeric />
          </div>
          <span style="font-weight: 700; font-size: 18px; color: var(--dim)">{{ currency }}/ч</span>
        </div>
        <p class="card-note">Подставляется как ставка при создании новой почасовой задачи.</p>
      </div>

      <div>
        <span class="field-label">Валюта</span>
        <div class="chips">
          <UiChip
            v-for="code in CURRENCIES"
            :key="code"
            :label="code"
            :active="currency === code"
            @click="settings.setCurrency(code)"
          />
        </div>
      </div>

      <div>
        <span class="field-label">Тема</span>
        <div class="chips">
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

      <div class="card-box">
        <div class="switch-row">
          <div class="switch-text">
            <div class="card-label">Компактное добавление задач</div>
            <p class="card-note" style="margin-top: 4px">
              В форме новой задачи скрываются ставка, тип ставки и время. Статус сразу «Далее».
            </p>
          </div>
          <UiSwitch v-model="compact" />
        </div>
      </div>

      <div class="card-box">
        <div class="switch-row">
          <div class="switch-text">
            <div class="card-label">Демо-данные</div>
            <p class="card-note" style="margin-top: 4px">
              Показать приложение с примерами проектов и задач. Ваши реальные данные не изменяются и вернутся как были.
            </p>
          </div>
          <UiSwitch v-model="demo" />
        </div>
        <div v-if="demoMode" class="badge-info">Сейчас показаны демо-данные</div>
      </div>

      <div class="card-box">
        <div class="card-label">Резервная копия</div>
        <p class="card-note" style="margin-bottom: 12px">
          Все проекты, задачи, время и счета одним файлом. Восстановление полностью заменяет текущие данные.
        </p>
        <div class="btn-row">
          <button class="btn-secondary" :disabled="busy !== null" @click="doBackup">
            {{ busy === 'export' ? 'Готовим…' : 'Сохранить копию' }}
          </button>
          <button class="btn-secondary" :disabled="busy !== null" @click="doRestore">
            {{ busy === 'import' ? 'Читаем…' : 'Восстановить' }}
          </button>
        </div>
        <div v-if="notice" class="badge-info">{{ notice }}</div>
      </div>

      <div class="card-box">
        <div class="card-label">Синхронизация</div>
        <template v-if="sync?.connected">
          <p class="card-note" style="margin-bottom: 12px">
            {{ sync.email }} · {{ sync.url }}
            <br>
            {{ sync.lastSyncAt ? `Последний обмен: ${sync.lastSyncAt.slice(0, 16).replace('T', ' ')}` : 'Обмена ещё не было' }}
          </p>
          <div class="btn-row">
            <button class="btn-secondary" :disabled="busy !== null" @click="doSync">
              {{ busy === 'sync' ? 'Обмен…' : 'Синхронизировать' }}
            </button>
            <button class="btn-secondary" :disabled="busy !== null" @click="doLogout">Отключить</button>
          </div>
        </template>
        <template v-else>
          <p class="card-note" style="margin-bottom: 10px">
            Данные останутся на устройстве. Аккаунт нужен только чтобы держать их
            одинаковыми на телефоне и компьютере.
          </p>
          <div class="stack" style="gap: 8px">
            <UiField v-model="url" placeholder="https://адрес-сервера" />
            <UiField v-model="email" placeholder="Почта" />
            <UiField v-model="password" placeholder="Пароль" secure />
          </div>
          <div class="btn-row" style="margin-top: 10px">
            <button class="btn-secondary" :disabled="busy !== null || !canAuth" @click="doLogin">
              {{ busy === 'login' ? 'Вход…' : 'Войти' }}
            </button>
            <button class="btn-secondary" :disabled="busy !== null || !canAuth" @click="doRegister">
              {{ busy === 'register' ? 'Создаём…' : 'Создать аккаунт' }}
            </button>
          </div>
        </template>
        <div v-if="syncNotice" class="badge-info">{{ syncNotice }}</div>
      </div>

      <button class="btn-secondary" style="width: 100%" @click="emit('replayOnboarding')">
        Показать экраны запуска заново
      </button>
    </div>
  </UiBottomSheet>
</template>
