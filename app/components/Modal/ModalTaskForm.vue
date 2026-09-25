<script setup lang="ts">
import type { RateType, TaskStatus } from '~/types'

const props = defineProps<{ open: boolean, taskId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const RATE_OPTIONS: RateType[] = ['hourly', 'fixed']
const STATUS_OPTIONS = (Object.keys(STATUS_COLOR) as TaskStatus[]).filter(key => key !== 'done')

const { t } = useI18n()
const fmt = useFormat()
const tasks = useTasksStore()
const projects = useProjectsStore()
const { currency, defaultRate, compactTaskForm } = storeToRefs(useSettingsStore())

const task = computed(() => (props.taskId ? tasks.byId.get(props.taskId) ?? null : null))
/** The compact form hides the rate, its type and the worked time on new tasks. */
const compact = computed(() => compactTaskForm.value && !props.taskId)

// An archived project keeps its place in the list while a task still sits in it.
const projectOptions = computed(() => {
  const current = task.value?.projectId
  if (!current || projects.active.some(p => p.id === current)) return projects.active
  return [...projects.active, ...projects.items.filter(p => p.id === current)]
})

const title = ref('')
const description = ref('')
const link = ref('')
const projectId = ref('')
const rateType = ref<RateType>('hourly')
const rateStr = ref('')
const status = ref<TaskStatus>('in_work')
const showAddTime = ref(false)
const addHours = ref('')
const addMinutes = ref('')

const rateLabel = computed(() => t(
  rateType.value === 'hourly' ? 'taskForm.rateLabelHourly' : 'taskForm.rateLabelFixed',
  { currency: currency.value },
))

function fill(): void {
  showAddTime.value = false
  addHours.value = ''
  addMinutes.value = ''
  const current = task.value
  title.value = current?.title ?? ''
  description.value = current?.description ?? ''
  link.value = current?.link ?? ''
  projectId.value = current?.projectId ?? projects.active[0]?.id ?? ''
  rateType.value = current?.rateType ?? 'hourly'
  rateStr.value = String(current?.rate ?? defaultRate.value)
  status.value = current?.status ?? (compactTaskForm.value ? 'next' : 'in_work')
}

watch(() => props.open, (open) => {
  if (open) fill()
})

function extraMinutes(): number {
  return (parseInt(addHours.value, 10) || 0) * 60 + (parseInt(addMinutes.value, 10) || 0)
}

async function save(): Promise<void> {
  const trimmed = title.value.trim()
  if (!trimmed) return
  const patch = {
    projectId: projectId.value,
    title: trimmed,
    description: description.value,
    link: link.value,
    rateType: rateType.value,
    rate: parseFloat(rateStr.value) || 0,
    status: status.value,
  }
  const current = task.value
  if (!current && !projectId.value) {
    window.alert(t('taskForm.needProject'))
    return
  }
  if (current) await tasks.edit(current.id, patch)
  else await tasks.add({ ...patch, initialMinutes: extraMinutes() })
  emit('close')
}

async function commitAddTime(): Promise<void> {
  const current = task.value
  const extra = extraMinutes()
  if (current && extra > 0) {
    await tasks.addManualTime(current.id, extra)
    addHours.value = ''
    addMinutes.value = ''
  }
  showAddTime.value = false
}

async function confirmDelete(): Promise<void> {
  const current = task.value
  if (!current) return
  if (!window.confirm(t('taskForm.confirmDelete'))) return
  await tasks.remove(current.id)
  emit('close')
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="task ? t('taskForm.edit') : t('taskForm.create')" @close="emit('close')" />
    <div class="stack">
      <UiField v-model="title" :label="t('taskForm.name')" :placeholder="t('taskForm.namePlaceholder')" />
      <UiField
        v-model="description"
        :label="t('taskForm.description')"
        :placeholder="t('taskForm.descriptionPlaceholder')"
        multiline
      />
      <UiField v-model="link" :label="t('taskForm.link')" placeholder="https://" accent />

      <div>
        <span class="field-label">{{ t('taskForm.project') }}</span>
        <div class="chips">
          <UiChip
            v-for="project in projectOptions"
            :key="project.id"
            :label="project.name"
            :active="projectId === project.id"
            @click="projectId = project.id"
          />
        </div>
      </div>

      <template v-if="!compact">
        <div>
          <span class="field-label">{{ t('taskForm.rateTypeLabel') }}</span>
          <div class="chips">
            <UiChip
              v-for="option in RATE_OPTIONS"
              :key="option"
              :label="t(`rateType.${option}`)"
              :active="rateType === option"
              grow
              @click="rateType = option"
            />
          </div>
        </div>

        <UiField v-model="rateStr" :label="rateLabel" numeric />

        <div class="time-box">
          <div class="time-top">
            <div>
              <div class="card-label">{{ t('taskForm.worked') }}</div>
              <div class="time-value num">{{ fmt.minutes(task?.minutes ?? 0) }}</div>
            </div>
            <button class="plus-btn" @click="showAddTime = !showAddTime">+</button>
          </div>
          <div v-if="showAddTime" class="time-add">
            <label>
              <span class="mini-label">{{ t('taskForm.hours') }}</span>
              <UiField v-model="addHours" placeholder="0" numeric />
            </label>
            <label>
              <span class="mini-label">{{ t('taskForm.minutes') }}</span>
              <UiField v-model="addMinutes" placeholder="0" numeric />
            </label>
            <button class="btn-primary" style="margin: 0; width: auto; padding: 13px 14px" @click="commitAddTime">
              {{ t('taskForm.add') }}
            </button>
          </div>
        </div>

        <div>
          <span class="field-label">{{ t('taskForm.statusLabel') }}</span>
          <div class="chips">
            <UiChip
              v-for="key in STATUS_OPTIONS"
              :key="key"
              :label="t(`status.${key}`)"
              :dot-color="STATUS_COLOR[key]"
              :active="status === key"
              small
              @click="status = key"
            />
          </div>
        </div>
      </template>

      <div v-if="task" class="created-at">
        {{ t('taskForm.createdAt', { date: fmt.shortDate(task.createdAt.slice(0, 10)) }) }}
      </div>

      <button class="btn-primary" @click="save">
        {{ task ? t('common.save') : t('taskForm.submit') }}
      </button>

      <button v-if="task" class="btn-secondary danger" @click="confirmDelete">
        {{ t('taskForm.remove') }}
      </button>
    </div>
  </UiBottomSheet>
</template>
