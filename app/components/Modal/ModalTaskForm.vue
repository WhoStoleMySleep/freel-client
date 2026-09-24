<script setup lang="ts">
import type { RateType, TaskStatus } from '~/types'

const props = defineProps<{ open: boolean, taskId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const RATE_OPTIONS: { key: RateType, label: string }[] = [
  { key: 'hourly', label: 'Почасовая' },
  { key: 'fixed', label: 'Фиксированная' },
]
const STATUS_OPTIONS = (Object.keys(STATUS) as TaskStatus[]).filter(key => key !== 'done')

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

const rateLabel = computed(() =>
  rateType.value === 'hourly' ? `Ставка в час, ${currency.value}` : `Стоимость, ${currency.value}`
)

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
    window.alert('Сначала создайте проект на вкладке «Проекты».')
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
  if (!window.confirm('Удалить задачу? Задача и всё учтённое по ней время будут удалены безвозвратно.')) return
  await tasks.remove(current.id)
  emit('close')
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="task ? 'Редактирование' : 'Новая задача'" @close="emit('close')" />
    <div class="stack">
      <UiField v-model="title" label="Название" placeholder="Название задачи" />
      <UiField v-model="description" label="Описание" placeholder="Что нужно сделать" multiline />
      <UiField v-model="link" label="Ссылка" placeholder="https://" accent />

      <div>
        <span class="field-label">Проект</span>
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
          <span class="field-label">Тип ставки</span>
          <div class="chips">
            <UiChip
              v-for="option in RATE_OPTIONS"
              :key="option.key"
              :label="option.label"
              :active="rateType === option.key"
              grow
              @click="rateType = option.key"
            />
          </div>
        </div>

        <UiField v-model="rateStr" :label="rateLabel" numeric />

        <div class="time-box">
          <div class="time-top">
            <div>
              <div class="card-label">Отработано времени</div>
              <div class="time-value num">{{ formatMinutes(task?.minutes ?? 0) }}</div>
            </div>
            <button class="plus-btn" @click="showAddTime = !showAddTime">+</button>
          </div>
          <div v-if="showAddTime" class="time-add">
            <label>
              <span class="mini-label">Часы</span>
              <UiField v-model="addHours" placeholder="0" numeric />
            </label>
            <label>
              <span class="mini-label">Минуты</span>
              <UiField v-model="addMinutes" placeholder="0" numeric />
            </label>
            <button class="btn-primary" style="margin: 0; width: auto; padding: 13px 14px" @click="commitAddTime">
              Добавить
            </button>
          </div>
        </div>

        <div>
          <span class="field-label">Статус</span>
          <div class="chips">
            <UiChip
              v-for="key in STATUS_OPTIONS"
              :key="key"
              :label="STATUS[key].label"
              :dot-color="STATUS[key].color"
              :active="status === key"
              small
              @click="status = key"
            />
          </div>
        </div>
      </template>

      <div v-if="task" class="created-at">Дата создания: {{ shortDate(task.createdAt.slice(0, 10)) }}</div>

      <button class="btn-primary" @click="save">
        {{ task ? 'Сохранить' : 'Создать задачу' }}
      </button>

      <button v-if="task" class="btn-secondary danger" @click="confirmDelete">
        Удалить задачу
      </button>
    </div>
  </UiBottomSheet>
</template>
