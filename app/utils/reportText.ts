import type { ReportMode, ReportRow } from '~/types'

function detailOf(row: ReportRow, mode: ReportMode): string {
  if (mode !== 'hours') return row.link.trim()
  return row.minutes > 0 ? formatHoursRounded(row.minutes) : ''
}

function projectBlock(name: string, rows: ReportRow[], mode: ReportMode): string {
  const lines = rows.map((row, i) => {
    const detail = detailOf(row, mode)
    return `${i + 1}) ${row.title}${detail ? ` - ${detail}` : ''}`
  })
  return [name, ...lines].join('\n')
}

/**
 * Renders tasks handed off for review as plain text for sharing, grouped by
 * project:
 *
 *   Проект
 *   1) задача - https://...
 *   2) задача без ссылки
 *
 *   Другой проект
 *   1) задача - https://...
 *
 *   Всего задач: 3
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
export function reportToText(rows: ReportRow[], mode: ReportMode = 'link'): string {
  const blocks = [...groupByProjectName(rows)].map(([name, items]) => projectBlock(name, items, mode))

  const totals = [`Всего задач: ${rows.length}`]
  if (mode === 'hours') {
    totals.push(`Итог: ${formatHoursRounded(rows.reduce((sum, row) => sum + row.minutes, 0))}`)
  }

  return [...blocks, totals.join('\n')].join('\n\n')
}
