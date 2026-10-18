<script setup lang="ts">
import type { Locale, ReportMode, TaskStatus } from '~/types'

/**
 * Builds the "what is sitting with you" message: the tasks handed off for
 * review, grouped by project, each with its link — or, if the recipient cares
 * about effort rather than where to look, its hours.
 *
 * Deliberately produces nothing but text. An invoice is a record and is stored;
 * a report is a snapshot of statuses that change by the hour, so keeping copies
 * of it would only leave stale ones lying around — regenerate instead.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const fmt = useFormat()
const tasks = useTasksStore()
const projects = useProjectsStore()

const statuses = ref<TaskStatus[]>([...REVIEW_STATUSES])
const mode = ref<ReportMode>('link')
const filterProjectId = ref('')
const { value: copied, flash: flashCopied } = useFlash(false, 2000)

const pool = computed(() => tasks.items.filter(task => statuses.value.includes(task.status)))
const visible = computed(() =>
  pool.value.filter(task => !filterProjectId.value || task.projectId === filterProjectId.value)
)

const { groups, master, chosen, setMany, reset } = useTaskSelection(pool, visible)

const text = computed(() => reportToText(
  chosen.value.map(task => ({
    projectName: projects.nameOf(task.projectId),
    title: task.title,
    link: task.link,
    minutes: task.minutes,
  })),
  mode.value,
  { locale: locale.value as Locale, t },
))

/** Only the detail the chosen mode actually prints is worth warning about. */
const incomplete = computed(() =>
  chosen.value.filter(task => (mode.value === 'hours' ? task.minutes <= 0 : !task.link.trim())).length
)

watch(() => props.open, (open) => {
  if (!open) return
  statuses.value = [...REVIEW_STATUSES]
  mode.value = 'link'
  filterProjectId.value = ''
  reset(tasks.items.filter(task => REVIEW_STATUSES.includes(task.status)))
  flashCopied(false)
})

/**
 * Turning a status on ticks its tasks, turning it off unticks them — so the
 * chips read as "include this group" without quietly discarding the manual
 * choices already made inside the other groups.
 */
function toggleStatus(status: TaskStatus): void {
  const on = statuses.value.includes(status)
  statuses.value = on ? statuses.value.filter(key => key !== status) : [...statuses.value, status]
  setMany((tasks.byStatus.get(status) ?? []).map(task => task.id), !on)
}

function rowDetail(minutes: number, link: string): string {
  if (mode.value === 'hours') return minutes > 0 ? fmt.hours(minutes) : t('report.noHours')
  return link.trim() || t('report.noLink')
}

function hasDetail(minutes: number, link: string): boolean {
  return mode.value === 'hours' ? minutes > 0 : !!link.trim()
}

async function copy(): Promise<void> {
  if (!chosen.value.length) return
  await copyText(text.value)
  flashCopied(true)
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="t('report.title')" @close="emit('close')" />
    <p class="modal-hint">
      {{ mode === 'hours' ? t('report.hintHours') : t('report.hintLink') }}
      {{ t('report.hintStatuses') }}
    </p>

    <div style="margin-bottom: 16px">
      <span class="field-label">{{ t('report.lineLabel') }}</span>
      <div class="segmented two" style="max-width: 280px">
        <button class="segment" :class="{ active: mode === 'link' }" @click="mode = 'link'">
          {{ t('report.modeLink') }}
        </button>
        <button class="segment" :class="{ active: mode === 'hours' }" @click="mode = 'hours'">
          {{ t('report.modeHours') }}
        </button>
      </div>
    </div>

    <div style="margin-bottom: 16px">
      <span class="field-label">{{ t('report.statuses') }}</span>
      <div class="chips">
        <UiChip
          v-for="key in DASH_ORDER"
          :key="key"
          :label="t(`status.${key}`)"
          :dot-color="STATUS_COLOR[key]"
          :active="statuses.includes(key)"
          round
          @click="toggleStatus(key)"
        />
      </div>
    </div>

    <div style="margin-bottom: 16px">
      <span class="field-label">{{ t('report.project') }}</span>
      <div class="chips scroll">
        <UiChip :label="t('common.all')" :active="filterProjectId === ''" @click="filterProjectId = ''" />
        <UiChip
          v-for="project in projects.active"
          :key="project.id"
          :label="project.name"
          :dot-color="projectColor(project.id)"
          :active="filterProjectId === project.id"
          @click="filterProjectId = project.id"
        />
      </div>
    </div>

    <div class="report-row">
      <UiTaskPicker
        :groups="groups"
        :master="master"
        :empty-text="t('report.empty')"
        @toggle="setMany"
      >
        <template #meta="{ task }">
          <span class="gen-task-link num" :class="{ missing: !hasDetail(task.minutes, task.link) }">
            <UiIcon :name="mode === 'hours' ? 'clock' : 'link'" :size="12" />
            {{ rowDetail(task.minutes, task.link) }}
          </span>
        </template>
        <template #trailing="{ task }">
          <span
            class="status-badge"
            :style="{
              background: `color-mix(in oklch, ${STATUS_COLOR[task.status]} 15%, transparent)`,
              color: STATUS_COLOR[task.status],
            }"
          >
            {{ t(`status.${task.status}`) }}
          </span>
        </template>
      </UiTaskPicker>
    </div>

    <div v-if="chosen.length" style="margin-top: 16px">
      <span class="field-label">{{ t('report.preview') }}</span>
      <pre class="report-preview">{{ text }}</pre>
    </div>

    <div class="sticky-foot">
      <div class="sel-summary">
        <span class="sel-count">{{ t('common.selected', { count: chosen.length }) }}</span>
        <span v-if="incomplete" class="sel-warn">
          {{ mode === 'hours' ? t('report.missingHours') : t('report.missingLink') }}: {{ incomplete }}
        </span>
      </div>
      <button class="btn-primary" :disabled="!chosen.length" @click="copy">
        <UiIcon name="copy" :size="16" />
        {{ copied ? t('common.copied') : t('report.copy') }}
      </button>
    </div>
  </UiBottomSheet>
</template>
