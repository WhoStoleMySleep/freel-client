import type { Invoice, InvoiceItem, TextContext } from '~/types'

function projectBlock(name: string, items: InvoiceItem[], ctx: TextContext): string {
  const lines = items.map((item, i) => `${i + 1}) ${item.title} - ${formatHoursRounded(item.minutes, ctx.locale)}`)
  return [name, ...lines].join('\n')
}

/**
 * Renders an invoice as plain text for sharing, grouped by project:
 *
 *   Project
 *   1) task - 2 h
 *   2) task - 1.5 h
 *
 *   Another project
 *   1) task - 3 h
 *
 *   Total: 6.5 h
 */
export function invoiceToText(invoice: Invoice, ctx: TextContext): string {
  const groups = groupByProjectName(invoice.items, ctx.t('invoice.unnamedProject'))
  const blocks = [...groups].map(([name, items]) => projectBlock(name, items, ctx))
  const totalMinutes = invoice.items.reduce((sum, item) => sum + item.minutes, 0)
  const total = ctx.t('report.total', { hours: formatHoursRounded(totalMinutes, ctx.locale) })
  return [...blocks, total].join('\n\n')
}
