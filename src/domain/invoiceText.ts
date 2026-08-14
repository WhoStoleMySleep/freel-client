import { Invoice } from './types';
import { formatHoursRounded } from './time';

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
  const order: string[] = [];
  const byProject = new Map<string, typeof invoice.items>();

  for (const item of invoice.items) {
    const name = item.projectName || 'Без проекта';
    if (!byProject.has(name)) {
      byProject.set(name, []);
      order.push(name);
    }
    byProject.get(name)!.push(item);
  }

  const blocks = order.map((name) => {
    const items = byProject.get(name)!;
    const lines = items.map((item, i) => `${i + 1}) ${item.title} - ${formatHoursRounded(item.minutes)}`);
    return [name, ...lines].join('\n');
  });

  const totalMinutes = invoice.items.reduce((a, i) => a + i.minutes, 0);
  return [...blocks, `Итог: ${formatHoursRounded(totalMinutes)}`].join('\n\n');
}
