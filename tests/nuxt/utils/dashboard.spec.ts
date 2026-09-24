import { describe, expect, test } from 'vitest'
import type { ActiveTimer, Task, TaskStatus } from '~/types'

const now = new Date()
const iso = now.toISOString()
const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString()

function task(id: string, status: TaskStatus, minutes: number, createdAt = iso): Task {
  return {
    id,
    projectId: 'p1',
    title: id,
    description: '',
    link: '',
    rateType: 'hourly',
    rate: 6000,
    minutes,
    status,
    createdAt,
    updatedAt: createdAt,
  }
}

const base = { activeTimer: null, nowMs: now.getTime(), todayMinutes: 0 }

describe('buildDashboardStats', () => {
  test('без задач всё по нулям', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const stats = buildDashboardStats({ ...base, tasks: [] })
    expect(stats.earnedTotal).toBe(0)
    expect(stats.groups).toEqual([])
    expect(stats.listCount).toBe(0)
  })

  test('готовые задачи уходят из списка, но остаются в часах', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const stats = buildDashboardStats({ ...base, tasks: [task('t1', 'in_work', 60), task('t2', 'done', 30)] })
    expect(stats.listCount).toBe(1)
    expect(stats.doneCount).toBe(1)
    expect(stats.hoursTotal).toBe(90)
  })

  test('выставленная в счёт задача уходит из «к оплате», но остаётся в заработке', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const stats = buildDashboardStats({ ...base, tasks: [task('t1', 'done', 60)] })
    expect(stats.earnedTotal).toBe(0)
    expect(stats.earnedToday).toBe(6000)
  })

  test('задачи прошлого года не попадают в месяц', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const stats = buildDashboardStats({ ...base, tasks: [task('t1', 'in_work', 60, lastYear)] })
    expect(stats.hoursMonth).toBe(0)
    expect(stats.hoursTotal).toBe(60)
  })

  test('идущий таймер добавляет минуты к сегодняшним', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const timer: ActiveTimer = {
      taskId: 't1',
      startedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      accumulatedMs: 0,
      paused: false,
    }
    const stats = buildDashboardStats({ ...base, tasks: [task('t1', 'in_work', 10)], activeTimer: timer, todayMinutes: 10 })
    expect(stats.timeToday).toBe(40)
  })

  test('таймер на паузе сегодняшние минуты не растит', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const timer: ActiveTimer = {
      taskId: 't1',
      startedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      accumulatedMs: 0,
      paused: true,
    }
    const stats = buildDashboardStats({ ...base, tasks: [task('t1', 'in_work', 10)], activeTimer: timer, todayMinutes: 10 })
    expect(stats.timeToday).toBe(10)
  })

  test('группы идут в порядке доски и пустые пропускаются', async () => {
    const { buildDashboardStats } = await import('~/utils/dashboard')
    const stats = buildDashboardStats({ ...base, tasks: [task('t1', 'next', 0), task('t2', 'in_work', 0)] })
    expect(stats.groups.map(g => g.key)).toEqual(['in_work', 'next'])
  })
})

describe('boardGroups', () => {
  test('пустой список не даёт колонок', async () => {
    const { boardGroups } = await import('~/utils/dashboard')
    expect(boardGroups([])).toEqual([])
  })

  test('колонка несёт подпись и цвет статуса', async () => {
    const { boardGroups } = await import('~/utils/dashboard')
    const { STATUS } = await import('~/utils/status')
    const [group] = boardGroups([task('t1', 'in_work', 0)])
    expect(group?.label).toBe(STATUS.in_work.label)
    expect(group?.color).toBe(STATUS.in_work.color)
  })
})
