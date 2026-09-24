import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

async function stores() {
  const { useAppStore } = await import('~/stores/app')
  const { useInvoicesStore } = await import('~/stores/invoices')
  const { useProjectsStore } = await import('~/stores/projects')
  const { useTasksStore } = await import('~/stores/tasks')
  const { useTimerStore } = await import('~/stores/timer')
  return {
    app: useAppStore(),
    invoices: useInvoicesStore(),
    projects: useProjectsStore(),
    tasks: useTasksStore(),
    timer: useTimerStore(),
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('загрузка', () => {
  test('до загрузки приложение не готово', async () => {
    const { app } = await stores()
    expect(app.ready).toBe(false)
    expect(app.phase).toBe('loading')
  })

  test('загрузка наполняет все сторы разом', async () => {
    const { app, projects, tasks, invoices } = await stores()

    await app.hydrate()

    expect(app.ready).toBe(true)
    expect(projects.items.length).toBeGreaterThan(0)
    expect(tasks.items.length).toBeGreaterThan(0)
    expect(invoices.items.length).toBeGreaterThan(0)
  })

  test('без Tauri данные заведомо не доходят до диска', async () => {
    const { app } = await stores()
    expect(app.persistent).toBe(false)
  })

  test('экран переключается напрямую', async () => {
    const { app } = await stores()

    app.setPhase('onboarding')

    expect(app.phase).toBe('onboarding')
  })
})

describe('режим превью', () => {
  test('включение подменяет данные на выдуманные', async () => {
    const { app, tasks } = await stores()
    await app.hydrate()
    const before = tasks.items.map(t => t.id)

    await app.toggleDemoMode()

    expect(app.demoMode).toBe(true)
    expect(tasks.items.map(t => t.id)).not.toEqual(before)
  })

  test('правки в превью не переживают выключение', async () => {
    const { app, projects } = await stores()
    await app.hydrate()
    await app.toggleDemoMode()
    await projects.add({ name: 'Только для превью', description: '' })

    await app.toggleDemoMode()

    expect(app.demoMode).toBe(false)
    expect(projects.items.some(p => p.name === 'Только для превью')).toBe(false)
  })

  test('включение превью снимает идущий таймер', async () => {
    const { app, tasks, timer } = await stores()
    await app.hydrate()
    await timer.start(tasks.items[0]!.id)

    await app.toggleDemoMode()

    expect(timer.active).toBeNull()
  })
})
