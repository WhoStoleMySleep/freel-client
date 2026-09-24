import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

async function stores() {
  const { useAppStore } = await import('~/stores/app')
  const { useTasksStore } = await import('~/stores/tasks')
  const { useTimerStore } = await import('~/stores/timer')
  await useAppStore().hydrate()
  return { tasks: useTasksStore(), timer: useTimerStore() }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-05T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('запуск', () => {
  test('таймер встаёт на выбранную задачу', async () => {
    const { tasks, timer } = await stores()
    const id = tasks.items[0]!.id

    await timer.start(id)

    expect(timer.taskId).toBe(id)
    expect(timer.running).toBe(true)
  })

  test('запуск на другой задаче записывает время предыдущей', async () => {
    const { tasks, timer } = await stores()
    const first = tasks.items[0]!
    await timer.start(first.id)
    vi.setSystemTime(new Date('2026-01-05T10:20:00.000Z'))

    await timer.start(tasks.items[1]!.id)

    expect(tasks.byId.get(first.id)?.minutes).toBe(first.minutes + 20)
  })
})

describe('пауза и продолжение', () => {
  test('пауза копит наработанное и останавливает счёт', async () => {
    const { tasks, timer } = await stores()
    await timer.start(tasks.items[0]!.id)
    vi.setSystemTime(new Date('2026-01-05T10:10:00.000Z'))

    await timer.pause()

    expect(timer.running).toBe(false)
    expect(timer.active?.accumulatedMs).toBe(10 * 60000)
  })

  test('повторная пауза ничего не меняет', async () => {
    const { tasks, timer } = await stores()
    await timer.start(tasks.items[0]!.id)
    await timer.pause()
    const paused = timer.active

    await timer.pause()

    expect(timer.active).toEqual(paused)
  })

  test('продолжение отсчитывает новую сессию от текущего момента', async () => {
    const { tasks, timer } = await stores()
    await timer.start(tasks.items[0]!.id)
    vi.setSystemTime(new Date('2026-01-05T10:10:00.000Z'))
    await timer.pause()
    vi.setSystemTime(new Date('2026-01-05T11:00:00.000Z'))

    await timer.resume()

    expect(timer.active?.startedAt).toBe('2026-01-05T11:00:00.000Z')
    expect(timer.active?.accumulatedMs).toBe(10 * 60000)
  })

  test('продолжение неидущего таймера ничего не делает', async () => {
    const { timer } = await stores()
    await timer.resume()
    expect(timer.active).toBeNull()
  })
})

describe('остановка', () => {
  test('остановка записывает время в задачу и снимает таймер', async () => {
    const { tasks, timer } = await stores()
    const task = tasks.items[0]!
    await timer.start(task.id)
    vi.setSystemTime(new Date('2026-01-05T10:45:00.000Z'))

    await timer.stop()

    expect(timer.active).toBeNull()
    expect(tasks.byId.get(task.id)?.minutes).toBe(task.minutes + 45)
  })

  test('пауза не мешает записать накопленное', async () => {
    const { tasks, timer } = await stores()
    const task = tasks.items[0]!
    await timer.start(task.id)
    vi.setSystemTime(new Date('2026-01-05T10:30:00.000Z'))
    await timer.pause()
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'))

    await timer.stop()

    expect(tasks.byId.get(task.id)?.minutes).toBe(task.minutes + 30)
  })

  test('снятие без записи оставляет минуты задачи нетронутыми', async () => {
    const { tasks, timer } = await stores()
    const task = tasks.items[0]!
    await timer.start(task.id)
    vi.setSystemTime(new Date('2026-01-05T10:30:00.000Z'))

    await timer.forget()

    expect(timer.active).toBeNull()
    expect(tasks.byId.get(task.id)?.minutes).toBe(task.minutes)
  })

  test('закрытие счёта останавливает таймер только на своих задачах', async () => {
    const { tasks, timer } = await stores()
    const task = tasks.items[0]!
    await timer.start(task.id)

    await timer.settle([tasks.items[1]!.id])
    expect(timer.active).not.toBeNull()

    await timer.settle([task.id])
    expect(timer.active).toBeNull()
  })
})
