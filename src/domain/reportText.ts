import { formatHoursRounded } from './time';

/** What goes after the task title: where to look, or how long it took. */
export type ReportMode = 'link' | 'hours';

export interface ReportRow {
  projectName: string;
  title: string;
  link: string;
  minutes: number;
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
  const order: string[] = [];
  const byProject = new Map<string, ReportRow[]>();

  for (const row of rows) {
    const name = row.projectName || 'Без проекта';
    if (!byProject.has(name)) {
      byProject.set(name, []);
      order.push(name);
    }
    byProject.get(name)!.push(row);
  }

  const blocks = order.map((name) => {
    const items = byProject.get(name)!;
    const lines = items.map((row, i) => {
      const detail = mode === 'hours' ? (row.minutes > 0 ? formatHoursRounded(row.minutes) : '') : row.link.trim();
      return `${i + 1}) ${row.title}${detail ? ` - ${detail}` : ''}`;
    });
    return [name, ...lines].join('\n');
  });

  const totals = [`Всего задач: ${rows.length}`];
  if (mode === 'hours') {
    totals.push(`Итог: ${formatHoursRounded(rows.reduce((a, r) => a + r.minutes, 0))}`);
  }

  return [...blocks, totals.join('\n')].join('\n\n');
}
