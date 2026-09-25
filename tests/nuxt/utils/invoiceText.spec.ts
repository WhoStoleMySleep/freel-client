import { describe, expect, test } from 'vitest'
import { textContext } from '../../helpers/textContext'
import type { Invoice } from '~/types'

const invoice: Invoice = {
  id: 'i1',
  number: '#00001',
  projectName: 'Разные проекты',
  dayKey: '2026-01-05',
  status: 'awaiting',
  factual: null,
  total: 0,
  items: [
    { id: 'a', invoiceId: 'i1', title: 'Чекаут', projectName: 'Acme', minutes: 120 },
    { id: 'b', invoiceId: 'i1', title: 'Корзина', projectName: 'Acme', minutes: 95 },
    { id: 'c', invoiceId: 'i1', title: 'Отчёты', projectName: '', minutes: 60 },
  ].map(i => ({ ...i, amount: 0 })),
}

describe('invoiceToText', () => {
  test('нумерует задачи внутри проекта заново', async () => {
    const { invoiceToText } = await import('~/utils/invoiceText')
    const text = invoiceToText(invoice, textContext())
    expect(text).toContain('1) Чекаут - 2 ч')
    expect(text).toContain('2) Корзина - 1,5 ч')
  })

  test('задачу без проекта кладёт в отдельную группу', async () => {
    const { invoiceToText } = await import('~/utils/invoiceText')
    expect(invoiceToText(invoice, textContext())).toContain('Без проекта')
  })

  test('в итоге суммирует всё время счёта', async () => {
    const { invoiceToText } = await import('~/utils/invoiceText')
    expect(invoiceToText(invoice, textContext())).toContain('Итог: 4,5 ч')
  })

  test('счёт без позиций сводится к нулевому итогу', async () => {
    const { invoiceToText } = await import('~/utils/invoiceText')
    expect(invoiceToText({ ...invoice, items: [] }, textContext())).toBe('Итог: 0 ч')
  })

  test('в английской локали текст собирается из английского словаря', async () => {
    const { invoiceToText } = await import('~/utils/invoiceText')
    const text = invoiceToText(invoice, textContext('en'))
    expect(text).toContain('No project')
    expect(text).toContain('Total: 4.5 h')
  })
})
