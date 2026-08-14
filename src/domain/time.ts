export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (!h && !m) return '0м';
  return (h ? h + 'ч' : '') + (m ? (h ? ' ' : '') + m + 'м' : '');
}

/** Hours rounded to the nearest half hour: 1, 1.5, 2 … */
export function formatHoursRounded(totalMinutes: number): string {
  const hours = Math.round((totalMinutes / 60) * 2) / 2;
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
  return `${text} ч`;
}

export function formatClock(seconds: number): string {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = Math.floor(seconds % 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return (hh ? p(hh) + ':' : '') + p(mm) + ':' + p(ss);
}
