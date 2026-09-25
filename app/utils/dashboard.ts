import type { ActiveTimer, DashboardGroup, DashboardInput, DashboardStats, Task } from '~/types'

function inCurrentMonth(iso: string, now: Date): boolean {
  const date = new Date(iso)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function sumAmount(tasks: Task[], timer: ActiveTimer | null, nowMs: number): number {
  return tasks.reduce((total, task) => total + taskAmount(task, liveMinutesFor(task, timer, nowMs)), 0)
}

function sumMinutes(tasks: Task[], timer: ActiveTimer | null, nowMs: number): number {
  return tasks.reduce((total, task) => total + liveMinutesFor(task, timer, nowMs), 0)
}

/** Minutes the running timer has added on top of what is already banked. */
function runningMinutes(timer: ActiveTimer | null, nowMs: number): number {
  if (!timer || timer.paused) return 0
  return Math.max(0, Math.floor((nowMs - new Date(timer.startedAt).getTime()) / 60000))
}

/**
 * Open tasks laid out in board order, empty columns dropped.
 *
 * Shared with the edge panel so the two views never disagree about what is in
 * work and in what order.
 */
export function boardGroups(tasks: Task[]): DashboardGroup[] {
  return DASH_ORDER
    .map(key => ({ key, color: STATUS_COLOR[key], tasks: tasks.filter(t => t.status === key) }))
    .filter(group => group.tasks.length > 0)
}

/**
 * Everything the dashboard shows, in one pass over the tasks.
 *
 * Outstanding money and earned money are counted over different sets on
 * purpose: invoicing a task takes it out of the first but must leave the
 * second alone.
 */
export function buildDashboardStats(input: DashboardInput): DashboardStats {
  const { tasks, activeTimer, nowMs, todayMinutes } = input
  const now = new Date()
  const today = todayKey()
  const open = tasks.filter(t => t.status !== 'done')
  const outstanding = tasks.filter(t => COUNTED_STATUSES.includes(t.status))
  const earned = tasks.filter(t => EARNED_STATUSES.includes(t.status))

  return {
    earnedTotal: sumAmount(outstanding, activeTimer, nowMs),
    hoursTotal: sumMinutes(tasks, activeTimer, nowMs),
    earnedMonth: sumAmount(earned.filter(t => inCurrentMonth(t.createdAt, now)), activeTimer, nowMs),
    hoursMonth: sumMinutes(tasks.filter(t => inCurrentMonth(t.createdAt, now)), activeTimer, nowMs),
    earnedToday: sumAmount(earned.filter(t => dayKeyFromIso(t.updatedAt) === today), activeTimer, nowMs),
    createdToday: tasks.filter(t => dayKeyFromIso(t.createdAt) === today).length,
    timeToday: todayMinutes + runningMinutes(activeTimer, nowMs),
    groups: boardGroups(open),
    listCount: open.length,
    doneCount: tasks.length - open.length,
  }
}
