<script setup lang="ts">
import type { ReportMode, TaskStatus } from '~/types'

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
  mode.value
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
  if (mode.value === 'hours') return minutes > 0 ? formatHoursRounded(minutes) : 'часов нет'
  return link.trim() || 'ссылки нет'
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
    <UiModalHead title="Отчёт по задачам" @close="emit('close')" />
    <p class="modal-hint">
      {{ mode === 'hours' ? 'В отчёт идут часы по каждой задаче и общий итог.' : 'Вместо часов в отчёт идёт ссылка на задачу.' }}
      Отметьте статусы, которые нужно включить.
    </p>

    <div class="field-label">Что писать в строке</div>
    <div class="chips" style="gap: 5px; margin-bottom: 14px">
      <UiChip label="Ссылка" :active="mode === 'link'" small @click="mode = 'link'" />
      <UiChip label="Часы" :active="mode === 'hours'" small @click="mode = 'hours'" />
    </div>

    <div class="field-label">Статусы</div>
    <div class="chips" style="gap: 5px; margin-bottom: 14px">
      <UiChip
        v-for="key in DASH_ORDER"
        :key="key"
        :label="STATUS[key].label"
        :dot-color="STATUS[key].color"
        :active="statuses.includes(key)"
        small
        @click="toggleStatus(key)"
      />
    </div>

    <div class="field-label">Проект</div>
    <div class="chips" style="gap: 5px; margin-bottom: 12px">
      <UiChip label="Все" :active="filterProjectId === ''" small @click="filterProjectId = ''" />
      <UiChip
        v-for="project in projects.active"
        :key="project.id"
        :label="project.name"
        :active="filterProjectId === project.id"
        small
        @click="filterProjectId = project.id"
      />
    </div>

    <UiTaskPicker
      :groups="groups"
      :master="master"
      empty-text="Нет задач с выбранными статусами по этому фильтру"
      @toggle="setMany"
    >
      <template #meta="{ task }">
        <span class="gen-task-link" :class="{ missing: !hasDetail(task.minutes, task.link) }">
          <UiIcon :name="mode === 'hours' ? 'clock' : 'link'" :size="10" />
          {{ rowDetail(task.minutes, task.link) }}
        </span>
      </template>
      <template #trailing="{ task }">
        <span
          class="status-badge"
          :style="{ background: STATUS[task.status].color + '22', color: STATUS[task.status].color }"
        >
          {{ STATUS[task.status].label }}
        </span>
      </template>
    </UiTaskPicker>

    <div class="sel-summary">
      <span class="sel-count">Выбрано: {{ chosen.length }}</span>
      <span v-if="incomplete" class="sel-warn">{{ mode === 'hours' ? 'Без часов' : 'Без ссылки' }}: {{ incomplete }}</span>
    </div>

    <pre v-if="chosen.length" class="report-preview">{{ text }}</pre>

    <button class="btn-primary" style="margin-top: 12px" :disabled="!chosen.length" @click="copy">
      {{ copied ? 'Скопировано' : 'Скопировать отчёт' }}
    </button>
  </UiBottomSheet>
</template>
