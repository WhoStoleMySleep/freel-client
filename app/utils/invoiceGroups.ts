import type { InvoiceGroup, InvoiceItem } from '~/types'

/** Invoice lines grouped by project, in the order they appear on the invoice. */
export function groupInvoiceItems(items: InvoiceItem[]): InvoiceGroup[] {
  const byName = new Map<string, InvoiceGroup>()
  for (const item of items) {
    const name = item.projectName || 'Без проекта'
    const group = byName.get(name) ?? { name, subtotal: 0, items: [] }
    group.items.push(item)
    group.subtotal += item.amount
    byName.set(name, group)
  }
  return [...byName.values()]
}
