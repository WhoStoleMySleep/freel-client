import type { InvoiceGroup, InvoiceItem } from '~/types'

/** Invoice lines grouped by project, in the order they appear on the invoice. */
export function groupInvoiceItems(items: InvoiceItem[], fallbackName: string): InvoiceGroup[] {
  return [...groupByProjectName(items, fallbackName)].map(([name, group]) => ({
    name,
    subtotal: group.reduce((sum, item) => sum + item.amount, 0),
    items: group,
  }))
}
