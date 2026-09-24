import type { ActiveTimer } from '~/types'

/**
 * The running timer. It lives in this device's settings and deliberately takes
 * no part in sync: starting a timer on one device must not stop another's.
 */
export const useTimerStore = defineStore('timer', () => {
  const active = ref<ActiveTimer | null>(null)

  const running = computed(() => !!active.value && !active.value.paused)
  const taskId = computed(() => active.value?.taskId ?? null)

  async function notify(timer: ActiveTimer): Promise<void> {
    const title = useTasksStore().byId.get(timer.taskId)?.title
    if (title) await showTimerNotification(title, timer)
  }

  /** Takes the timer from the data source — on app load. */
  async function apply(timer: ActiveTimer | null): Promise<void> {
    active.value = timer
    if (timer) await notify(timer)
  }

  async function save(timer: ActiveTimer | null): Promise<void> {
    await useAppStore().source.setActiveTimer(timer)
    active.value = timer
    if (timer) await notify(timer)
    else await cancelTimerNotification()
    void broadcastChanged()
  }

  /** Banks the worked time into the task, leaving the timer where it is. */
  async function commit(): Promise<void> {
    const timer = active.value
    if (!timer) return
    await useTasksStore().commitTimer(timer.taskId, Math.floor(timerElapsedMs(timer, Date.now()) / 60000))
  }

  async function start(id: string): Promise<void> {
    await commit()
    await save({ taskId: id, startedAt: new Date().toISOString(), accumulatedMs: 0, paused: false })
  }

  async function pause(): Promise<void> {
    const timer = active.value
    if (!timer || timer.paused) return
    await save({ ...timer, accumulatedMs: timerElapsedMs(timer, Date.now()), paused: true })
  }

  async function resume(): Promise<void> {
    const timer = active.value
    if (!timer || !timer.paused) return
    await save({ ...timer, startedAt: new Date().toISOString(), paused: false })
  }

  async function stop(): Promise<void> {
    if (!active.value) return
    await commit()
    await save(null)
  }

  /** Drops the timer without banking: what it was running on is about to go. */
  async function forget(): Promise<void> {
    if (!active.value) return
    await save(null)
  }

  async function forgetTask(id: string): Promise<void> {
    if (taskId.value === id) await forget()
  }

  /** Closes the timer out if it runs on one of the listed tasks. */
  async function settle(ids: string[]): Promise<void> {
    if (taskId.value && ids.includes(taskId.value)) await stop()
  }

  return { active, running, taskId, apply, start, pause, resume, stop, forget, forgetTask, settle }
})
