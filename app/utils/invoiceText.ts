import type { Invoice, InvoiceItem } from '~/types'

function projectBlock(name: string, items: InvoiceItem[]): string {
  const lines = items.map((item, i) => `${i + 1}) ${item.title} - ${formatHoursRounded(item.minutes)}`)
  return [name, ...lines].join('\n')
}

/**
 * Renders an invoice as plain text for sharing, grouped by project:
 *
 *   Проект
 *   1) задача - 2 ч
 *   2) задача - 1,5 ч
 *
 *   Другой проект
 *   1) задача - 3 ч
 *
 *   Итог: 6,5 ч
 */
export function invoiceToText(invoice: Invoice): string {
  const blocks = [...groupByProjectName(invoice.items)].map(([name, items]) => projectBlock(name, items))
  const totalMinutes = invoice.items.reduce((sum, item) => sum + item.minutes, 0)
  return [...blocks, `Итог: ${formatHoursRounded(totalMinutes)}`].join('\n\n')
}
