<script setup lang="ts">
import type { Task } from '~/types'

type Modal =
  | { type: 'add' }
  | { type: 'edit', taskId: string }
  | { type: 'done' }
  | { type: 'settings' }
  | null

defineProps<{ isDark: boolean }>()
const emit = defineEmits<{ replayOnboarding: [] }>()

const nowMs = useTimerTick()
const modal = ref<Modal>(null)

const tasksStore = useTasksStore()
const timer = useTimerStore()
const settings = useSettingsStore()
const projects = useProjectsStore()
const { items: tasks, todayMinutes } = storeToRefs(tasksStore)
const { active: activeTimer } = storeToRefs(timer)
const { currency } = storeToRefs(settings)

const stats = computed(() => buildDashboardStats({
  tasks: tasks.value,
  activeTimer: activeTimer.value,
  nowMs: nowMs.value,
  todayMinutes: todayMinutes.value,
}))
const hasProjects = computed(() => projects.active.length > 0)

const liveMinutes = (task: Task) => liveMinutesFor(task, activeTimer.value, nowMs.value)
const isRunning = (task: Task) => activeTimer.value?.taskId === task.id
const toggleTimer = (task: Task) => (isRunning(task) ? timer.stop() : timer.start(task.id))

function replayOnboarding(): void {
  modal.value = null
  emit('replayOnboarding')
}
</script>

<template>
  <div class="screen scr">
    <div class="header">
      <div>
        <div class="eyebrow">{{ greeting() }}</div>
        <h1 class="h1">Дашборд</h1>
      </div>
      <div class="header-btns">
        <button class="icon-btn" @click="settings.setCurrency(nextCurrency(currency))">
          {{ CURRENCY_SYMBOL[currency] }}
        </button>
        <button class="icon-btn" @click="settings.setThemeMode(isDark ? 'light' : 'dark')">
          <UiIcon :name="isDark ? 'moon' : 'sun'" :size="15" />
        </button>
        <button class="icon-btn" @click="modal = { type: 'settings' }">
          <UiIcon name="settings" :size="17" />
        </button>
      </div>
    </div>

    <div class="hero">
      <div class="hero-inner">
        <div class="hero-label">Заработано · к оплате</div>
        <div class="hero-total num">{{ formatMoney(stats.earnedTotal, currency) }}</div>
        <div class="hero-hours">
          <b><UiIcon name="clock" :size="13" color="#43d6a0" /> {{ formatMinutes(stats.hoursTotal) }}</b>
          <span>всего отработано</span>
        </div>
        <div class="hero-divider" />
        <div class="hero-row">
          <div>
            <div class="hero-sub-label">За текущий месяц</div>
            <div class="hero-sub-value num">{{ formatMoney(stats.earnedMonth, currency) }}</div>
          </div>
          <div style="text-align: right">
            <div class="hero-sub-label">Часов за месяц</div>
            <div class="hero-sub-value num">{{ formatMinutes(stats.hoursMonth) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-head">
      <span class="dot" />
      <span class="section-title">Сегодня</span>
      <span class="section-note">00:00 – 23:59</span>
    </div>
    <div class="tiles">
      <div class="tile">
        <div class="tile-value num">{{ formatMoney(stats.earnedToday, currency) }}</div>
        <div class="tile-label">Заработано</div>
      </div>
      <div class="tile">
        <div class="tile-value num">{{ stats.createdToday }}</div>
        <div class="tile-label">Создано задач</div>
      </div>
      <div class="tile">
        <div class="tile-value num">{{ formatMinutes(stats.timeToday) }}</div>
        <div class="tile-label">Отработано</div>
      </div>
    </div>

    <div class="tasks-head">
      <div class="tasks-title-row">
        <span class="tasks-title">Задачи</span>
        <span class="tasks-count">{{ stats.listCount }}</span>
      </div>
      <div class="header-btns">
        <button class="done-btn" @click="modal = { type: 'done' }">
          <UiIcon name="check" :size="11" /> Готово {{ stats.doneCount }}
        </button>
        <button class="add-btn" @click="modal = { type: 'add' }">+</button>
      </div>
    </div>

    <div v-for="group in stats.groups" :key="group.key" class="group">
      <div class="group-head">
        <span class="group-dot" :style="{ background: group.color }" />
        <span class="group-label">{{ group.label }}</span>
        <span class="group-count">{{ group.tasks.length }}</span>
      </div>
      <div class="group-list">
        <div v-for="task in group.tasks" :key="task.id" class="task">
          <span class="task-bar" :style="{ background: STATUS[task.status].color }" />
          <div @click="modal = { type: 'edit', taskId: task.id }">
            <div class="task-top">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-amount num">{{ formatMoney(taskAmount(task, liveMinutes(task)), currency) }}</div>
            </div>
            <div class="task-meta">
              <span>{{ projects.nameOf(task.projectId) }}</span>
              <span class="sep" />
              <span>{{ task.rateType === 'hourly' ? 'Почасовая' : 'Фикс' }}</span>
              <span class="sep" />
              <span class="with-icon"><UiIcon name="clock" :size="11" /> {{ formatMinutes(liveMinutes(task)) }}</span>
            </div>
          </div>
          <div class="task-controls">
            <button class="step-btn" @click="tasksStore.stepStatusOf(task.id, -1)">
              <UiIcon name="chevron-left" :size="14" />
            </button>
            <button :class="isRunning(task) ? 'timer-btn running' : 'timer-btn'" @click="toggleTimer(task)">
              <UiIcon :name="isRunning(task) ? 'pause' : 'play'" :size="11" />
              {{ isRunning(task) ? 'Остановить' : 'Запустить таймер' }}
            </button>
            <button class="step-btn" @click="tasksStore.stepStatusOf(task.id, 1)">
              <UiIcon name="chevron-right" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="stats.listCount === 0" class="empty">
      <div class="empty-title">{{ hasProjects ? 'Пока нет задач' : 'Начните с проекта' }}</div>
      <p class="empty-text">
        {{ hasProjects
          ? 'Нажмите «+» рядом со списком, чтобы добавить первую задачу.'
          : 'Создайте первый проект во вкладке «Проекты», а затем добавьте задачу.' }}
      </p>
    </div>

    <ModalTaskForm
      :open="modal?.type === 'add' || modal?.type === 'edit'"
      :task-id="modal?.type === 'edit' ? modal.taskId : null"
      @close="modal = null"
    />
    <ModalDoneTasks :open="modal?.type === 'done'" @close="modal = null" />
    <ModalSettings
      :open="modal?.type === 'settings'"
      @close="modal = null"
      @replay-onboarding="replayOnboarding"
    />
  </div>
</template>
