<script setup lang="ts">
import type { BackupFile, LanguageMode, SyncStatus, ThemeMode } from '~/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [], replayOnboarding: [] }>()

const THEME_MODES: ThemeMode[] = ['system', 'dark', 'light']
const LANGUAGES: LanguageMode[] = ['system', 'ru', 'en']

type Busy = 'export' | 'import' | 'login' | 'register' | 'sync'

interface Job {
  kind: Busy
  flash: (message: string | null) => void
  /** Put in front of a failure when the bare error would not read as one. */
  prefix?: string
}

const { t } = useI18n()
const fmt = useFormat()
const app = useAppStore()
const settings = useSettingsStore()
const { demoMode } = storeToRefs(app)
const { currency, defaultRate, themeMode, language, compactTaskForm } = storeToRefs(settings)

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
  return t('settings.registered')
})

const doLogin = () => run({ kind: 'login', flash: flashSync }, async () => {
  await syncLogin(url.value.trim(), email.value.trim(), password.value)
  password.value = ''
  await refreshSync()
  return t('settings.connected')
})

async function doLogout(): Promise<void> {
  await syncLogout().catch(() => {})
  await refreshSync()
  flashSync(t('settings.disconnected'))
}

const doSync = () => run({ kind: 'sync', flash: flashSync }, async () => {
  const result = await syncNow()
  // The merge rewrote rows underneath the stores, so they have to re-read.
  await app.hydrate()
  await refreshSync()
  return t('settings.synced', { sent: result.sent, received: result.received })
})

const doBackup = () => run({ kind: 'export', flash: flashNotice, prefix: t('settings.backupFailed') }, async () => {
  const saved = await saveBackup(await app.buildBackup(), t('backup.fileName'))
  return saved.status === 'saved' ? t('settings.backupSaved') : null
})

/** Restoring replaces everything, so the copy is described before it is applied. */
function confirmRestore(backup: BackupFile): boolean {
  const summary = summarize(backup)
  return window.confirm(t('settings.restoreConfirm', {
    projects: summary.projects,
    tasks: summary.tasks,
    invoices: summary.invoices,
    date: fmt.shortDate(summary.exportedAt.slice(0, 10)),
  }))
}

const doRestore = () => run({ kind: 'import', flash: flashNotice, prefix: t('settings.restoreFailed') }, async () => {
  const picked = await pickBackup(t('backup.fileName'))
  if (picked.status === 'cancelled') return null
  if (picked.status === 'error') return t(`backup.${picked.error}`, { detail: picked.detail ?? '' })
  if (!confirmRestore(picked.backup)) return null
  await app.restoreBackup(picked.backup)
  emit('close')
  return t('settings.restored')
})
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="t('settings.title')" @close="emit('close')" />
    <div class="stack" style="gap: 16px">
      <div class="card-box">
        <div class="card-label" style="margin-bottom: 6px">{{ t('settings.rate') }}</div>
        <div style="display: flex; align-items: center; gap: 10px">
          <div style="flex: 1">
            <UiField v-model="rateStr" numeric />
          </div>
          <span style="font-weight: 700; font-size: 18px; color: var(--dim)">
            {{ t('settings.ratePerHour', { currency }) }}
          </span>
        </div>
        <p class="card-note">{{ t('settings.rateHint') }}</p>
      </div>

      <div>
        <span class="field-label">{{ t('settings.currency') }}</span>
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
        <span class="field-label">{{ t('settings.theme') }}</span>
        <div class="chips">
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

      <div>
        <span class="field-label">{{ t('settings.language') }}</span>
        <div class="chips">
          <UiChip
            v-for="mode in LANGUAGES"
            :key="mode"
            :label="t(`language.${mode}`)"
            :active="language === mode"
            grow
            @click="settings.setLanguage(mode)"
          />
        </div>
      </div>

      <div class="card-box">
        <div class="switch-row">
          <div class="switch-text">
            <div class="card-label">{{ t('settings.compact') }}</div>
            <p class="card-note" style="margin-top: 4px">{{ t('settings.compactHint') }}</p>
          </div>
          <UiSwitch v-model="compact" />
        </div>
      </div>

      <div class="card-box">
        <div class="switch-row">
          <div class="switch-text">
            <div class="card-label">{{ t('settings.demo') }}</div>
            <p class="card-note" style="margin-top: 4px">{{ t('settings.demoHint') }}</p>
          </div>
          <UiSwitch v-model="demo" />
        </div>
        <div v-if="demoMode" class="badge-info">{{ t('settings.demoBadge') }}</div>
      </div>

      <div class="card-box">
        <div class="card-label">{{ t('settings.backup') }}</div>
        <p class="card-note" style="margin-bottom: 12px">{{ t('settings.backupHint') }}</p>
        <div class="btn-row">
          <button class="btn-secondary" :disabled="busy !== null" @click="doBackup">
            {{ busy === 'export' ? t('settings.backupBusy') : t('settings.backupSave') }}
          </button>
          <button class="btn-secondary" :disabled="busy !== null" @click="doRestore">
            {{ busy === 'import' ? t('settings.restoreBusy') : t('settings.restore') }}
          </button>
        </div>
        <div v-if="notice" class="badge-info">{{ notice }}</div>
      </div>

      <div class="card-box">
        <div class="card-label">{{ t('settings.sync') }}</div>
        <template v-if="sync?.connected">
          <p class="card-note" style="margin-bottom: 12px">
            {{ sync.email }} · {{ sync.url }}
            <br>
            {{ sync.lastSyncAt
              ? t('settings.lastSync', { at: sync.lastSyncAt.slice(0, 16).replace('T', ' ') })
              : t('settings.neverSynced') }}
          </p>
          <div class="btn-row">
            <button class="btn-secondary" :disabled="busy !== null" @click="doSync">
              {{ busy === 'sync' ? t('settings.syncBusy') : t('settings.syncNow') }}
            </button>
            <button class="btn-secondary" :disabled="busy !== null" @click="doLogout">{{ t('settings.disconnect') }}</button>
          </div>
        </template>
        <template v-else>
          <p class="card-note" style="margin-bottom: 10px">{{ t('settings.syncHint') }}</p>
          <div class="stack" style="gap: 8px">
            <UiField v-model="url" :placeholder="t('settings.serverPlaceholder')" />
            <UiField v-model="email" :placeholder="t('settings.emailPlaceholder')" />
            <UiField v-model="password" :placeholder="t('settings.passwordPlaceholder')" secure />
          </div>
          <div class="btn-row" style="margin-top: 10px">
            <button class="btn-secondary" :disabled="busy !== null || !canAuth" @click="doLogin">
              {{ busy === 'login' ? t('settings.loginBusy') : t('settings.login') }}
            </button>
            <button class="btn-secondary" :disabled="busy !== null || !canAuth" @click="doRegister">
              {{ busy === 'register' ? t('settings.registerBusy') : t('settings.register') }}
            </button>
          </div>
        </template>
        <div v-if="syncNotice" class="badge-info">{{ syncNotice }}</div>
      </div>

      <button class="btn-secondary" style="width: 100%" @click="emit('replayOnboarding')">
        {{ t('settings.replayOnboarding') }}
      </button>
    </div>
  </UiBottomSheet>
</template>
