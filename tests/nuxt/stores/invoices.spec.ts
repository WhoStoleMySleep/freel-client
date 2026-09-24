import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

async function stores() {
  const { useAppStore } = await import('~/stores/app')
  const { useInvoicesStore } = await import('~/stores/invoices')
  const { useProjectsStore } = await import('~/stores/projects')
  const { useTasksStore } = await import('~/stores/tasks')
  const { useTimerStore } = await import('~/stores/timer')
  await useAppStore().hydrate()
  return {
    invoices: useInvoicesStore(),
    projects: useProjectsStore(),
    tasks: useTasksStore(),
    timer: useTimerStore(),
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('выставление счёта', () => {
  test('счёт собирается из выбранных задач и закрывает их', async () => {
    const { invoices, tasks } = await stores()
    const chosen = tasks.items.filter(t => t.projectId === tasks.items[0]!.projectId).slice(0, 2)
    const ids = chosen.map(t => t.id)

    await invoices.createFromTasks(ids)

    const created = invoices.items[0]!
    expect(created.items).toHaveLength(2)
    expect(ids.every(id => tasks.byId.get(id)?.status === 'done')).toBe(true)
  })

  test('задачи из разных проектов дают счёт «Разные проекты»', async () => {
    const { invoices, tasks, projects } = await stores()
    const first = tasks.items[0]!
    const other = tasks.items.find(t => t.projectId !== first.projectId)!

    await invoices.createFromTasks([first.id, other.id])

    expect(invoices.items[0]!.projectName).toBe('Разные проекты')
    expect(projects.nameOf(first.projectId)).not.toBe('Разные проекты')
  })

  test('задачи одного проекта дают счёт с его именем', async () => {
    const { invoices, tasks, projects } = await stores()
    const first = tasks.items[0]!

    await invoices.createFromTasks([first.id])

    expect(invoices.items[0]!.projectName).toBe(projects.nameOf(first.projectId))
  })

  test('пустой список счёт не создаёт', async () => {
    const { invoices } = await stores()
    const before = invoices.items.length

    await invoices.createFromTasks([])

    expect(invoices.items).toHaveLength(before)
  })

  test('несуществующие задачи счёт не создают', async () => {
    const { invoices } = await stores()
    const before = invoices.items.length

    await invoices.createFromTasks(['нет такой'])

    expect(invoices.items).toHaveLength(before)
  })

  test('идущий на задаче таймер записывается до выставления счёта', async () => {
    const { invoices, tasks, timer } = await stores()
    const task = tasks.items[0]!
    await timer.start(task.id)

    await invoices.createFromTasks([task.id])

    expect(timer.active).toBeNull()
    expect(invoices.items[0]!.items[0]!.minutes).toBe(tasks.byId.get(task.id)!.minutes)
  })
})

describe('статус счёта', () => {
  test('фактическая сумма остаётся только у оплаченного', async () => {
    const { invoices } = await stores()
    const id = invoices.items[0]!.id

    await invoices.setStatus(id, 'paid', 1000)
    expect(invoices.items.find(v => v.id === id)?.factual).toBe(1000)

    await invoices.setStatus(id, 'sent', 1000)
    expect(invoices.items.find(v => v.id === id)?.factual).toBeNull()
  })

  test('неоплаченные счета отделены от остальных', async () => {
    const { invoices } = await stores()
    expect(invoices.unpaid.every(v => v.status !== 'paid')).toBe(true)
  })

  test('удалённый счёт уходит из списка', async () => {
    const { invoices } = await stores()
    const id = invoices.items[0]!.id

    await invoices.remove(id)

    expect(invoices.items.some(v => v.id === id)).toBe(false)
  })
})
