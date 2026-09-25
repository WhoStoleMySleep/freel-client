import { describe, expect, test } from 'vitest'
import type { InvoiceItem } from '~/types'

const items: InvoiceItem[] = [
  { id: 'i1', invoiceId: 'v1', title: 'Чекаут', projectName: 'Acme', minutes: 60, amount: 3000 },
  { id: 'i2', invoiceId: 'v1', title: 'Отчёты', projectName: 'Fin', minutes: 30, amount: 1500 },
  { id: 'i3', invoiceId: 'v1', title: 'Корзина', projectName: 'Acme', minutes: 15, amount: 750 },
]

describe('groupInvoiceItems', () => {
  test('пустой счёт не даёт групп', async () => {
    const { groupInvoiceItems } = await import('~/utils/invoiceGroups')
    expect(groupInvoiceItems([], 'Без проекта')).toEqual([])
  })

  test('группы идут в порядке первого появления проекта', async () => {
    const { groupInvoiceItems } = await import('~/utils/invoiceGroups')
    expect(groupInvoiceItems(items, 'Без проекта').map(g => g.name)).toEqual(['Acme', 'Fin'])
  })

  test('подытог складывает все строки проекта', async () => {
    const { groupInvoiceItems } = await import('~/utils/invoiceGroups')
    const [acme] = groupInvoiceItems(items, 'Без проекта')
    expect(acme?.subtotal).toBe(3750)
    expect(acme?.items).toHaveLength(2)
  })

  test('строка без проекта попадает в общую группу', async () => {
    const { groupInvoiceItems } = await import('~/utils/invoiceGroups')
    const groups = groupInvoiceItems([{ ...items[0]!, projectName: '' }], 'Без проекта')
    expect(groups[0]?.name).toBe('Без проекта')
  })
})
