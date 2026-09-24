<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Task } from '~/types'

/**
 * The edge panel: a second window that slides in from the left so time can be
 * started and stopped without bringing the main window forward.
 *
 * It shares the database with the main window but not the store — each window
 * runs its own JavaScript context — so it reloads whenever the other one
 * reports a change.
 */
const nowMs = useTimerTick()
useResolvedTheme()
useDbSync()

const app = useAppStore()
const tasksStore = useTasksStore()
const timer = useTimerStore()
const projects = useProjectsStore()
const { ready } = storeToRefs(app)
const { items: tasks } = storeToRefs(tasksStore)
const { active: activeTimer, task: running } = storeToRefs(timer)
const { currency, defaultRate } = storeToRefs(useSettingsStore())

const title = ref('')
const projectId = ref('')

const open = computed(() => tasks.value.filter(task => task.status !== 'done'))
const groups = computed(() => boardGroups(open.value))
const clock = computed(() => (activeTimer.value ? formatClock(Math.floor(timerElapsedMs(activeTimer.value, nowMs.value) / 1000)) : ''))
const canAdd = computed(() => !!title.value.trim() && !!projectId.value)

const liveMinutes = (task: Task) => liveMinutesFor(task, activeTimer.value, nowMs.value)
const isRunning = (task: Task) => activeTimer.value?.taskId === task.id

watch(() => projects.active, (list) => {
  if (!projectId.value && list[0]) projectId.value = list[0].id
}, { immediate: true })

onMounted(() => {
  app.hydrate().catch(() => {})
})

async function submit(): Promise<void> {
  const name = title.value.trim()
  if (!name || !projectId.value) return
  title.value = ''
  await tasksStore.add({
    projectId: projectId.value,
    title: name,
    description: '',
    link: '',
    rateType: 'hourly',
    rate: defaultRate.value,
    status: 'next',
    initialMinutes: 0,
  })
}
</script>

<template>
  <div v-if="!ready" class="panel">
    <div class="panel-empty">Загрузка…</div>
  </div>

  <div v-else class="panel">
    <div class="panel-head">
      <span class="panel-brand">freel</span>
      <button class="panel-close" aria-label="Скрыть" @click="getCurrentWindow().hide()">✕</button>
    </div>

    <div v-if="activeTimer && running" class="panel-timer">
      <div class="panel-timer-title">{{ running.title }}</div>
      <div class="panel-timer-clock num">{{ clock }}</div>
      <div class="panel-timer-btns">
        <button class="panel-btn" @click="activeTimer.paused ? timer.resume() : timer.pause()">
          <UiIcon :name="activeTimer.paused ? 'play' : 'pause'" />
          {{ activeTimer.paused ? 'Продолжить' : 'Пауза' }}
        </button>
        <button class="panel-btn danger" @click="timer.stop()">
          <UiIcon name="stop" />
          Стоп
        </button>
      </div>
    </div>

    <div class="panel-add">
      <input
        v-model="title"
        class="panel-input"
        placeholder="Новая задача"
        @focus="lockPanel(true)"
        @blur="lockPanel(false)"
        @keydown.enter="submit"
      >
      <button class="panel-add-btn" :disabled="!canAdd" @click="submit">+</button>
    </div>
    <select v-if="projects.active.length > 1" v-model="projectId" class="panel-select">
      <option v-for="project in projects.active" :key="project.id" :value="project.id">
        {{ project.name }}
      </option>
    </select>

    <div class="panel-list scr">
      <div v-if="open.length === 0" class="panel-empty">Активных задач нет</div>
      <div v-for="group in groups" :key="group.key" class="panel-group">
        <div class="panel-group-head">
          <span class="panel-dot" :style="{ background: group.color }" />
          <span class="panel-group-label">{{ group.label }}</span>
          <span class="panel-group-count">{{ group.tasks.length }}</span>
        </div>
        <div
          v-for="task in group.tasks"
          :key="task.id"
          :class="isRunning(task) ? 'panel-task running' : 'panel-task'"
        >
          <div class="panel-task-top">
            <div class="panel-task-title">{{ task.title }}</div>
            <div class="panel-task-amount num">
              {{ formatMoney(taskAmount(task, liveMinutes(task)), currency) }}
            </div>
          </div>
          <div class="panel-task-meta">
            {{ projects.nameOf(task.projectId) }} · {{ formatMinutes(liveMinutes(task)) }}
          </div>
          <div class="panel-task-controls">
            <button class="panel-step" aria-label="Предыдущий статус" @click="tasksStore.stepStatusOf(task.id, -1)">
              <UiIcon name="chevron-left" />
            </button>
            <button
              :class="isRunning(task) ? 'panel-timer-btn running' : 'panel-timer-btn'"
              @click="isRunning(task) ? timer.stop() : timer.start(task.id)"
            >
              <UiIcon :name="isRunning(task) ? 'stop' : 'play'" />
              {{ isRunning(task) ? 'Остановить' : 'Запустить' }}
            </button>
            <button class="panel-step" aria-label="Следующий статус" @click="tasksStore.stepStatusOf(task.id, 1)">
              <UiIcon name="chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
