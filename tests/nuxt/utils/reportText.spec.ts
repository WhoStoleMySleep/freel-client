import { describe, expect, test } from 'vitest'
import type { ReportRow } from '~/types'

const rows: ReportRow[] = [
  { projectName: 'Acme', title: 'Чекаут', link: 'https://tracker/1', minutes: 95 },
  { projectName: 'Acme', title: 'Корзина', link: '', minutes: 0 },
  { projectName: 'Fin', title: 'Отчёты', link: 'https://tracker/2', minutes: 120 },
]

describe('reportToText', () => {
  test('по умолчанию ставит после задачи ссылку', async () => {
    const { reportToText } = await import('~/utils/reportText')
    expect(reportToText(rows)).toContain('1) Чекаут - https://tracker/1')
  })

  test('группирует по проектам в порядке появления', async () => {
    const { reportToText } = await import('~/utils/reportText')
    const text = reportToText(rows)
    expect(text.indexOf('Acme')).toBeLessThan(text.indexOf('Fin'))
    expect(text).toContain('1) Отчёты - https://tracker/2')
  })

  test('строку без ссылки оставляет голой', async () => {
    const { reportToText } = await import('~/utils/reportText')
    expect(reportToText(rows)).toContain('2) Корзина\n')
  })

  test('в режиме часов подставляет время и добавляет итог', async () => {
    const { reportToText } = await import('~/utils/reportText')
    const text = reportToText(rows, 'hours')
    expect(text).toContain('1) Чекаут - 1,5 ч')
    expect(text).toContain('Итог: 3,5 ч')
  })

  test('в режиме часов задача без времени идёт без хвоста', async () => {
    const { reportToText } = await import('~/utils/reportText')
    expect(reportToText(rows, 'hours')).toContain('2) Корзина\n')
  })

  test('всегда считает количество задач', async () => {
    const { reportToText } = await import('~/utils/reportText')
    expect(reportToText(rows)).toContain('Всего задач: 3')
  })

  test('пустой список не ломает вывод', async () => {
    const { reportToText } = await import('~/utils/reportText')
    expect(reportToText([])).toContain('Всего задач: 0')
  })
})
