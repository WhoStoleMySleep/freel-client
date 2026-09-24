import { addPluginListener, invoke } from '@tauri-apps/api/core'
import type { ActiveTimer } from '~/types'

/**
 * What the currently posted notification was built from. `hydrate` runs after
 * every sync exchange and every edit in the other window, and each run used to
 * re-post an identical notification; the notification is ongoing, so there is
 * nothing to restore and the repost was pure IPC.
 */
let posted: string | null = null

/** Everything the Android notification shows besides the task and the clock. */
const LABELS = {
  pausedLabel: 'На паузе',
  runningLabel: 'Идёт запись времени',
  pauseActionLabel: 'Пауза',
  resumeActionLabel: 'Продолжить',
  stopActionLabel: 'Остановить',
  channelName: 'Таймер задачи',
} as const

/**
 * Posts the ongoing notification. The elapsed time is rendered by Android's
 * own chronometer, seeded with the session start — so it keeps counting while
 * the app is backgrounded or even killed, with no JavaScript running.
 */
export async function showTimerNotification(taskTitle: string, timer: ActiveTimer): Promise<void> {
  if (!isTauri()) return
  const signature = `${taskTitle} ${timer.paused} ${timer.startedAt} ${timer.accumulatedMs}`
  if (signature === posted) return
  // Fold banked time into the base so the chronometer shows total session time.
  const runningMs = timer.paused ? 0 : Date.now() - new Date(timer.startedAt).getTime()
  const baseMs = Date.now() - (timer.accumulatedMs + runningMs)
  try {
    await invoke('plugin:timer|show', {
      args: { title: taskTitle, baseMs: Math.round(baseMs), paused: timer.paused, ...LABELS },
    })
    posted = signature
  }
  catch (e) {
    console.warn('timer notification failed', e)
  }
}

export async function cancelTimerNotification(): Promise<void> {
  if (!isTauri()) return
  posted = null
  try {
    await invoke('plugin:timer|cancel')
  }
  catch (e) {
    console.warn('timer notification cancel failed', e)
  }
}

export interface TimerActionHandlers {
  onPause: () => void | Promise<void>
  onResume: () => void | Promise<void>
  onStop: () => void | Promise<void>
}

/** Subscribes to the notification's action buttons. */
export async function listenTimerActions(handlers: TimerActionHandlers): Promise<() => void> {
  if (!isTauri()) return () => {}
  const listener = await addPluginListener<{ action: string }>('timer', 'timer-action', (payload) => {
    if (payload?.action === 'pause') handlers.onPause()
    if (payload?.action === 'resume') handlers.onResume()
    if (payload?.action === 'stop') handlers.onStop()
  })
  return () => listener.unregister()
}
