import type { ReportMode, ReportRow, TextContext } from '~/types'

function detailOf(row: ReportRow, mode: ReportMode, ctx: TextContext): string {
  if (mode !== 'hours') return row.link.trim()
  return row.minutes > 0 ? formatHoursRounded(row.minutes, ctx.locale) : ''
}

function projectBlock(name: string, rows: ReportRow[], mode: ReportMode, ctx: TextContext): string {
  const lines = rows.map((row, i) => {
    const detail = detailOf(row, mode, ctx)
    return `${i + 1}) ${row.title}${detail ? ` - ${detail}` : ''}`
  })
  return [name, ...lines].join('\n')
}

/**
 * Renders tasks handed off for review as plain text for sharing, grouped by
 * project:
 *
 *   Project
 *   1) task - https://...
 *   2) task with no link
 *
 *   Another project
 *   1) task - https://...
 *
 *   Tasks in total: 3
 *
 * The invoice text puts hours after each task because that is what the client
 * pays for. A review report is read, not paid: the useful detail is usually
 * where to look, so by default the link takes that slot. Some recipients want
 * the time instead — `hours` mode swaps in the same figure the invoice uses and
 * adds the total, so the message stays comparable to a bill without being one.
 *
 * A row missing the detail of the current mode is listed bare rather than
 * padded with a placeholder — the modal warns about those before sending.
 */
export function reportToText(rows: ReportRow[], mode: ReportMode, ctx: TextContext): string {
  const groups = groupByProjectName(rows, ctx.t('invoice.unnamedProject'))
  const blocks = [...groups].map(([name, items]) => projectBlock(name, items, mode, ctx))

  const totals = [ctx.t('report.totalTasks', { count: rows.length })]
  if (mode === 'hours') {
    const worked = rows.reduce((sum, row) => sum + row.minutes, 0)
    totals.push(ctx.t('report.total', { hours: formatHoursRounded(worked, ctx.locale) }))
  }

  return [...blocks, totals.join('\n')].join('\n\n')
}
