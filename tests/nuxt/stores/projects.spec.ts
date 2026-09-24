import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

async function stores() {
  const { useAppStore } = await import('~/stores/app')
  const { useProjectsStore } = await import('~/stores/projects')
  const { useTasksStore } = await import('~/stores/tasks')
  await useAppStore().hydrate()
  return { projects: useProjectsStore(), tasks: useTasksStore() }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('список', () => {
  test('архивные проекты отделены от активных', async () => {
    const { projects } = await stores()
    expect(projects.active.every(p => !p.archived)).toBe(true)
    expect(projects.archived.every(p => p.archived)).toBe(true)
  })

  test('имя неизвестного проекта заменяется прочерком', async () => {
    const { projects } = await stores()
    expect(projects.nameOf('нет такого')).toBe('—')
  })
})

describe('изменения', () => {
  test('новый проект появляется незаархивированным', async () => {
    const { projects } = await stores()

    await projects.add({ name: 'Новый', description: 'описание' })

    expect(projects.items.at(-1)).toMatchObject({ name: 'Новый', archived: false })
  })

  test('правка меняет имя и описание', async () => {
    const { projects } = await stores()
    const id = projects.items[0]!.id

    await projects.edit(id, { name: 'Другое имя', description: 'иначе' })

    expect(projects.nameOf(id)).toBe('Другое имя')
  })

  test('архивация убирает проект из активных', async () => {
    const { projects } = await stores()
    const id = projects.active[0]!.id

    await projects.setArchived(id, true)

    expect(projects.active.some(p => p.id === id)).toBe(false)
  })

  test('удаление проекта уносит его задачи', async () => {
    const { projects, tasks } = await stores()
    const id = projects.items[0]!.id

    await projects.removeForever(id)

    expect(projects.items.some(p => p.id === id)).toBe(false)
    expect(tasks.items.some(t => t.projectId === id)).toBe(false)
  })
})
