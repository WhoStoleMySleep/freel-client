// All dates are handled as local-time ISO day strings ('YYYY-MM-DD') for calendar
// comparisons, and full ISO timestamps for ordering/audit fields.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function dayKeyFromIso(iso: string): string {
  return toDayKey(new Date(iso));
}

export function isTodayIso(iso: string): boolean {
  return dayKeyFromIso(iso) === todayKey();
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function shortDate(dayKey: string): string {
  const [, m, d] = dayKey.split('-').map(Number);
  const names = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${pad(d)} ${names[m - 1]}`;
}

export function isDayKeyInMonth(dayKey: string, year: number, month: number): boolean {
  const [y, m] = dayKey.split('-').map(Number);
  return y === year && m - 1 === month;
}

export function dayOfMonth(dayKey: string): number {
  return Number(dayKey.split('-')[2]);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
