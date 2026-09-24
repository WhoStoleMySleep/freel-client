import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { NewTaskInput } from '~/repositories/modules/tasks'

const input: NewTaskInput = {
  projectId: 'p1',
  title: 'Новая задача',
  description: '',
  link: '',
  rateType: 'hourly',
  rate: 3000,
  status: 'next',
  initialMinutes: 30,
}

async function stores() {
  const { useTasksStore } = await import('~/stores/tasks')
  const { useAppStore } = await import('~/stores/app')
  await useAppStore().hydrate()
  return { tasks: useTasksStore(), app: useAppStore() }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('создание и правка', () => {
  test('новая задача попадает в список вместе с начальными минутами', async () => {
    const { tasks } = await stores()
    const before = tasks.todayMinutes

    await tasks.add(input)

    expect(tasks.items.at(-1)?.title).toBe('Новая задача')
    expect(tasks.todayMinutes).toBe(before + 30)
  })

  test('правка меняет поля задачи', async () => {
    const { tasks } = await stores()
    const task = tasks.items[0]!

    await tasks.edit(task.id, { ...task, title: 'Переименована' })

    expect(tasks.byId.get(task.id)?.title).toBe('Переименована')
  })
})

describe('статусы', () => {
  test('шаг вперёд двигает задачу по конвейеру', async () => {
    const { tasks } = await stores()
    const task = tasks.items.find(t => t.status === 'next')!

    await tasks.stepStatusOf(task.id, 1)

    expect(tasks.byId.get(task.id)?.status).toBe('in_work')
  })

  test('шаг у несуществующей задачи ничего не ломает', async () => {
    const { tasks } = await stores()
    await expect(tasks.stepStatusOf('нет такой', 1)).resolves.toBeUndefined()
  })

  test('закрытие счёта переводит все его задачи в «готово»', async () => {
    const { tasks } = await stores()
    const ids = tasks.items.slice(0, 2).map(t => t.id)

    await tasks.markDone(ids)

    expect(ids.every(id => tasks.byId.get(id)?.status === 'done')).toBe(true)
  })

  test('группировка по статусу собирает задачи в один список', async () => {
    const { tasks } = await stores()
    const group = tasks.byStatus.get('waiting_payment') ?? []
    expect(group.every(t => t.status === 'waiting_payment')).toBe(true)
  })
})

describe('время', () => {
  test('ручное время прибавляется к задаче и к сегодняшнему итогу', async () => {
    const { tasks } = await stores()
    const task = tasks.items[0]!
    const before = tasks.todayMinutes

    await tasks.addManualTime(task.id, 15)

    expect(tasks.byId.get(task.id)?.minutes).toBe(task.minutes + 15)
    expect(tasks.todayMinutes).toBe(before + 15)
  })

  test('ноль минут не добавляется', async () => {
    const { tasks } = await stores()
    const before = tasks.todayMinutes

    await tasks.addManualTime(tasks.items[0]!.id, 0)

    expect(tasks.todayMinutes).toBe(before)
  })

  test('таймер короче минуты времени не записывает', async () => {
    const { tasks } = await stores()
    const task = tasks.items[0]!
    const before = tasks.todayMinutes

    await tasks.commitTimer(task.id, 0)

    expect(tasks.byId.get(task.id)?.minutes).toBe(task.minutes)
    expect(tasks.todayMinutes).toBe(before)
  })
})

describe('удаление', () => {
  test('удалённая задача уходит из списка', async () => {
    const { tasks } = await stores()
    const id = tasks.items[0]!.id

    await tasks.remove(id)

    expect(tasks.byId.has(id)).toBe(false)
  })

  test('вместе с задачей снимается идущий на ней таймер', async () => {
    const { tasks } = await stores()
    const { useTimerStore } = await import('~/stores/timer')
    const timer = useTimerStore()
    const id = tasks.items[0]!.id
    await timer.start(id)

    await tasks.remove(id)

    expect(timer.active).toBeNull()
  })
})
