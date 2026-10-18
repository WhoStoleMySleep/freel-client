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

const { t } = useI18n()
const fmt = useFormat()

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

/** The running stretch as HH:MM:SS, shown on the accent card's timer button. */
const elapsed = computed(() => (activeTimer.value
  ? formatClock(Math.floor(timerElapsedMs(activeTimer.value, nowMs.value) / 1000))
  : ''))

const liveMinutes = (task: Task) => liveMinutesFor(task, activeTimer.value, nowMs.value)
const isRunning = (task: Task) => activeTimer.value?.taskId === task.id
const toggleTimer = (task: Task) => (isRunning(task) ? timer.stop() : timer.start(task.id))
const stepLabel = (task: Task, dir: 1 | -1) => t(`status.${stepStatus(task.status, dir)}`)

function replayOnboarding(): void {
  modal.value = null
  emit('replayOnboarding')
}
</script>

<template>
  <div class="screen scr">
    <div class="header">
      <div>
        <div class="eyebrow">{{ t(`greeting.${greetingKey()}`) }}</div>
        <h1 class="h1 display">{{ t('dashboard.title') }}</h1>
      </div>
      <div class="header-btns">
        <button class="icon-btn" @click="settings.setCurrency(nextCurrency(currency))">
          {{ CURRENCY_SYMBOL[currency] }}
        </button>
        <button class="icon-btn" @click="settings.setThemeMode(isDark ? 'light' : 'dark')">
          <UiIcon :name="isDark ? 'moon' : 'sun'" :size="17" />
        </button>
        <button class="icon-btn" @click="modal = { type: 'settings' }">
          <UiIcon name="settings" :size="17" />
        </button>
      </div>
    </div>

    <div class="hero">
      <div class="hero-main">
        <div class="hero-label">{{ t('dashboard.heroLabel') }}</div>
        <div class="hero-total display">
          {{ fmt.amount(stats.earnedTotal) }}<span class="sym">{{ CURRENCY_SYMBOL[currency] }}</span>
        </div>
        <div class="hero-hours">
          <span class="hero-pill num">
            <UiIcon name="clock" :size="13" /> {{ fmt.minutes(stats.hoursTotal) }}
          </span>
          {{ t('dashboard.totalWorked') }}
        </div>
      </div>
      <div class="hero-side">
        <div class="hero-cell">
          <div class="hero-cell-label">{{ t('dashboard.monthEarned') }}</div>
          <div class="hero-cell-value num">{{ fmt.money(stats.earnedMonth, currency) }}</div>
        </div>
        <div class="hero-cell">
          <div class="hero-cell-label">{{ t('dashboard.monthHours') }}</div>
          <div class="hero-cell-value num">{{ fmt.minutes(stats.hoursMonth) }}</div>
        </div>
      </div>
    </div>

    <div class="today">
      <div class="today-label">
        <div class="today-label-title">
          <span class="dot" />{{ t('dashboard.today') }}
        </div>
        <div class="today-label-range num">00:00 – 23:59</div>
      </div>
      <div class="today-stat">
        <span class="today-value num">{{ fmt.money(stats.earnedToday, currency) }}</span>
        <span class="today-name">{{ t('dashboard.earnedToday') }}</span>
      </div>
      <div class="today-stat">
        <span class="today-value num">{{ stats.createdToday }}</span>
        <span class="today-name">{{ t('dashboard.createdToday') }}</span>
      </div>
      <div class="today-stat">
        <span class="today-value num">{{ fmt.minutes(stats.timeToday) }}</span>
        <span class="today-name">{{ t('dashboard.workedToday') }}</span>
      </div>
    </div>

    <div class="tasks-head">
      <div class="tasks-title-row">
        <h2 class="tasks-title display">{{ t('dashboard.tasks') }}</h2>
        <span class="tasks-count num">{{ stats.listCount }}</span>
      </div>
      <div class="header-btns">
        <button class="done-btn" @click="modal = { type: 'done' }">
          <UiIcon name="check" :size="14" /> {{ t('dashboard.done', { count: stats.doneCount }) }}
        </button>
        <button class="add-btn" @click="modal = { type: 'add' }">
          <UiIcon name="plus" :size="18" />
        </button>
      </div>
    </div>

    <div v-for="group in stats.groups" :key="group.key" class="group">
      <div class="group-head">
        <span class="group-dot" :style="{ background: group.color }" />
        <span class="group-label">{{ t(`status.${group.key}`) }}</span>
        <span class="group-count num">{{ group.tasks.length }}</span>
        <span class="group-rule" />
      </div>
      <div class="group-list">
        <div v-for="task in group.tasks" :key="task.id" :class="isRunning(task) ? 'task running' : 'task'">
          <div class="task-top">
            <div class="task-main">
              <div class="task-title" @click="modal = { type: 'edit', taskId: task.id }">{{ task.title }}</div>
              <div class="task-meta">
                <span class="task-project">
                  <span
                    v-if="!isRunning(task)"
                    class="task-project-dot"
                    :style="{ background: projectColor(task.projectId) }"
                  />
                  {{ projects.nameOf(task.projectId) }}
                </span>
                <span class="task-rate-type">
                  {{ task.rateType === 'hourly' ? t('rateType.hourly') : t('rateType.fixedShort') }}
                </span>
                <span class="task-time num">
                  <UiIcon v-if="!isRunning(task)" name="clock" :size="12" /> {{ fmt.minutes(liveMinutes(task)) }}
                </span>
              </div>
            </div>
            <div
              :class="task.status === 'waiting_payment' && !isRunning(task) ? 'task-amount due num' : 'task-amount num'"
            >
              {{ fmt.money(taskAmount(task, liveMinutes(task)), currency) }}
            </div>
          </div>
          <div class="task-controls">
            <button class="step-btn" :title="stepLabel(task, -1)" @click="tasksStore.stepStatusOf(task.id, -1)">
              <UiIcon name="chevron-left" :size="14" />
            </button>
            <button class="timer-btn" @click="toggleTimer(task)">
              <template v-if="isRunning(task)">
                <UiIcon name="stop" :size="11" />
                <span class="elapsed num">{{ elapsed }}</span>
                <span class="stop-word">{{ t('dashboard.stopTimer') }}</span>
              </template>
              <template v-else>
                <UiIcon name="play" :size="10" /> {{ t('dashboard.startTimer') }}
              </template>
            </button>
            <button class="step-btn" :title="stepLabel(task, 1)" @click="tasksStore.stepStatusOf(task.id, 1)">
              <UiIcon name="chevron-right" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="stats.listCount === 0" class="empty">
      <div class="empty-title">{{ hasProjects ? t('dashboard.emptyTasks') : t('dashboard.emptyProjects') }}</div>
      <p class="empty-text">
        {{ hasProjects ? t('dashboard.emptyTasksHint') : t('dashboard.emptyProjectsHint') }}
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
