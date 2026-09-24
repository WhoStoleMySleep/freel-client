import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import type { Task, TaskStatus } from '~/types'

function task(id: string, projectId: string, status: TaskStatus = 'waiting_payment'): Task {
  return {
    id,
    projectId,
    title: id,
    description: '',
    link: '',
    rateType: 'hourly',
    rate: 6000,
    minutes: 60,
    status,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  }
}

const pool = [task('t1', 'p1'), task('t2', 'p1'), task('t3', 'p2')]

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useTaskSelection', () => {
  test('без выбора мастер-строка пуста', async () => {
    const { useTaskSelection } = await import('~/composables/useTaskSelection')
    const { master, chosen } = useTaskSelection(ref(pool), ref(pool))
    expect(master.value).toEqual({ state: 'none', selected: 0, total: 3 })
    expect(chosen.value).toEqual([])
  })

  test('reset отмечает все переданные задачи', async () => {
    const { useTaskSelection } = await import('~/composables/useTaskSelection')
    const { master, reset } = useTaskSelection(ref(pool), ref(pool))
    reset(pool)
    expect(master.value.state).toBe('all')
  })

  test('часть выбранного даёт промежуточное состояние группы', async () => {
    const { useTaskSelection } = await import('~/composables/useTaskSelection')
    const { groups, setMany } = useTaskSelection(ref(pool), ref(pool))
    setMany(['t1'], true)
    expect(groups.value[0]?.state).toBe('some')
    expect(groups.value[0]?.selectedCount).toBe(1)
  })

  test('группы идут в порядке первого появления проекта', async () => {
    const { useTaskSelection } = await import('~/composables/useTaskSelection')
    const { groups } = useTaskSelection(ref(pool), ref(pool))
    expect(groups.value.map(g => g.projectId)).toEqual(['p1', 'p2'])
  })

  test('фильтр проекта прячет задачу, но не снимает с неё отметку', async () => {
    const { useTaskSelection } = await import('~/composables/useTaskSelection')
    const visible = ref(pool)
    const { chosen, master, setMany } = useTaskSelection(ref(pool), visible)
    setMany(['t3'], true)
    visible.value = pool.filter(t => t.projectId === 'p1')
    expect(master.value.total).toBe(2)
    expect(chosen.value.map(t => t.id)).toEqual(['t3'])
  })
})
