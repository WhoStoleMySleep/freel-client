export type TaskStatus =
  | 'paused'
  | 'waiting_payment'
  | 'waiting_upload'
  | 'review_code'
  | 'review_managers'
  | 'in_work'
  | 'next'
  | 'done';

export const STATUS: Record<TaskStatus, { label: string; color: string }> = {
  paused: { label: 'На паузе', color: '#8a94a6' },
  waiting_payment: { label: 'Ожидает оплаты', color: '#f5c451' },
  waiting_upload: { label: 'Ожидает заливания', color: '#4ec9e0' },
  review_code: { label: 'На проверке кода', color: '#b98cff' },
  review_managers: { label: 'На проверке менеджерами', color: '#6c8cff' },
  in_work: { label: 'В работе', color: '#43d6a0' },
  next: { label: 'Далее', color: '#7a8296' },
  done: { label: 'Готово', color: '#5f6675' },
};

// Statuses whose task amounts count toward "Заработано" on the dashboard.
/**
 * Work that is still owed to you — the headline "к оплате" figure.
 * `done` is out on purpose: once a task is invoiced it is no longer outstanding.
 */
export const COUNTED_STATUSES: TaskStatus[] = [
  'in_work',
  'waiting_upload',
  'review_code',
  'review_managers',
  'waiting_payment',
];

/**
 * Work actually performed, whether or not it has been invoiced — the basis for
 * every "заработано" figure.
 *
 * These must not shrink when an invoice is created. Using the outstanding set
 * for them made a month's earnings drop by the invoice amount the moment the
 * invoice was issued, while the hours worked stayed put.
 */
export const EARNED_STATUSES: TaskStatus[] = [...COUNTED_STATUSES, 'done'];

// Fixed top-to-bottom grouping order for the dashboard task list.
export const DASH_ORDER: TaskStatus[] = [
  'paused',
  'waiting_payment',
  'waiting_upload',
  'review_code',
  'review_managers',
  'in_work',
  'next',
];

// Workflow progression used by the per-card "Назад"/"Далее" step buttons.
export const STEP_ORDER: TaskStatus[] = [
  'next',
  'in_work',
  'review_managers',
  'review_code',
  'waiting_upload',
  'waiting_payment',
  'paused',
];

// Order of restore options offered in the "Готово" modal.
export const RESTORE_ORDER: TaskStatus[] = [
  'in_work',
  'waiting_payment',
  'review_code',
  'review_managers',
  'waiting_upload',
  'paused',
  'next',
];

export function stepStatus(current: TaskStatus, dir: 1 | -1): TaskStatus {
  let i = STEP_ORDER.indexOf(current);
  if (i < 0) i = 0;
  i = Math.min(STEP_ORDER.length - 1, Math.max(0, i + dir));
  return STEP_ORDER[i];
}

export type InvoiceStatus = 'awaiting' | 'sent' | 'paid';

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; color: string }> = {
  awaiting: { label: 'Ожидает отправки', color: '#8a94a6' },
  sent: { label: 'Отправлено', color: '#6c8cff' },
  paid: { label: 'Оплачено', color: '#43d6a0' },
};

export type RateType = 'hourly' | 'fixed';
