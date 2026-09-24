import type { InvoiceGroup, InvoiceItem } from '~/types'

/** Invoice lines grouped by project, in the order they appear on the invoice. */
export function groupInvoiceItems(items: InvoiceItem[]): InvoiceGroup[] {
  return [...groupByProjectName(items)].map(([name, group]) => ({
    name,
    subtotal: group.reduce((sum, item) => sum + item.amount, 0),
    items: group,
  }))
}
