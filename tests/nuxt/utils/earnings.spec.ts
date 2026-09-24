import { describe, expect, test } from 'vitest'
import type { ActiveTimer, Task } from '~/types'

const startedAt = '2026-01-01T10:00:00.000Z'
const nowMs = new Date('2026-01-01T10:30:00.000Z').getTime()

const task: Task = {
  id: 't1',
  projectId: 'p1',
  title: 'Задача',
  description: '',
  link: '',
  rateType: 'hourly',
  rate: 3000,
  minutes: 30,
  status: 'in_work',
  createdAt: startedAt,
  updatedAt: startedAt,
}

const running: ActiveTimer = { taskId: 't1', startedAt, accumulatedMs: 0, paused: false }

describe('timerElapsedMs', () => {
  test('идущий таймер считает время от старта', async () => {
    const { timerElapsedMs } = await import('~/utils/earnings')
    expect(timerElapsedMs(running, nowMs)).toBe(30 * 60000)
  })

  test('на паузе растёт только накопленное', async () => {
    const { timerElapsedMs } = await import('~/utils/earnings')
    expect(timerElapsedMs({ ...running, paused: true, accumulatedMs: 60000 }, nowMs)).toBe(60000)
  })

  test('сдвинутые назад часы не дают отрицательного времени', async () => {
    const { timerElapsedMs } = await import('~/utils/earnings')
    expect(timerElapsedMs(running, new Date(startedAt).getTime() - 5000)).toBe(0)
  })
})

describe('liveMinutesFor', () => {
  test('добавляет к задаче незаписанное время таймера', async () => {
    const { liveMinutesFor } = await import('~/utils/earnings')
    expect(liveMinutesFor(task, running, nowMs)).toBe(60)
  })

  test('чужой таймер задачу не трогает', async () => {
    const { liveMinutesFor } = await import('~/utils/earnings')
    expect(liveMinutesFor(task, { ...running, taskId: 'other' }, nowMs)).toBe(30)
  })
})

describe('taskAmount', () => {
  test('почасовая задача считается по минутам', async () => {
    const { taskAmount } = await import('~/utils/earnings')
    expect(taskAmount(task, 90)).toBe(4500)
  })

  test('фиксированная цена от времени не зависит', async () => {
    const { taskAmount } = await import('~/utils/earnings')
    expect(taskAmount({ ...task, rateType: 'fixed', rate: 25000 }, 600)).toBe(25000)
  })
})
