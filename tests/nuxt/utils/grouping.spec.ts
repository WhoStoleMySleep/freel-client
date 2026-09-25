import { describe, expect, test } from 'vitest'

const rows = [
  { projectName: 'Acme', title: 'Чекаут' },
  { projectName: 'Fin', title: 'Отчёты' },
  { projectName: 'Acme', title: 'Корзина' },
]

describe('groupByProjectName', () => {
  test('пустой список не даёт групп', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect(groupByProjectName([], 'Без проекта').size).toBe(0)
  })

  test('проекты идут в порядке первого появления', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect([...groupByProjectName(rows, 'Без проекта').keys()]).toEqual(['Acme', 'Fin'])
  })

  test('строки одного проекта собираются вместе', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect(groupByProjectName(rows, 'Без проекта').get('Acme')).toHaveLength(2)
  })

  test('пустое имя проекта заменяется переданной подписью', async () => {
    const { groupByProjectName } = await import('~/utils/grouping')
    expect([...groupByProjectName([{ projectName: '' }], 'Без проекта').keys()]).toEqual(['Без проекта'])
  })
})
