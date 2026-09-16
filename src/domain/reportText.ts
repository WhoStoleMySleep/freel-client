export interface ReportRow {
  projectName: string;
  title: string;
  link: string;
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
 * pays for. A review report is read, not paid: the useful detail is where to
 * look, so the link takes that slot. A task with no link is listed bare rather
 * than padded with a placeholder — the modal warns about those before sending.
 */
export function reportToText(rows: ReportRow[]): string {
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
      const link = row.link.trim();
      return `${i + 1}) ${row.title}${link ? ` - ${link}` : ''}`;
    });
    return [name, ...lines].join('\n');
  });

  return [...blocks, `Всего задач: ${rows.length}`].join('\n\n');
}
