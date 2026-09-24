import { describe, expect, test } from 'vitest'

const rows = [
  { projectName: 'Acme', title: 'Чекаут' },
  { projectName: 'Fin', title: 'Отчёты' },
  { projectName: 'Acme', title: 'Корзина' },
]

describe('groupByProjectName', () => {
  test('пустой список не даёт групп', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect(groupByProjectName([]).size).toBe(0)
  })

  test('проекты идут в порядке первого появления', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect([...groupByProjectName(rows).keys()]).toEqual(['Acme', 'Fin'])
  })

  test('строки одного проекта собираются вместе', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect(groupByProjectName(rows).get('Acme')).toHaveLength(2)
  })

  test('пустое имя проекта заменяется общей группой', async () => {
    const { groupByProjectName, UNNAMED_PROJECT } = await import('~/utils/grouping')
    expect([...groupByProjectName([{ projectName: '' }]).keys()]).toEqual([UNNAMED_PROJECT])
  })
})
