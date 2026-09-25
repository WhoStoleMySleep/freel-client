import type { InvoiceStatus, TaskStatus } from '~/types'

/** Names live in the locale files, keyed by status; only the colour is fixed. */
export const STATUS_COLOR: Record<TaskStatus, string> = {
  paused:          '#8a94a6',
  waiting_payment: '#f5c451',
  waiting_upload:  '#4ec9e0',
  review_code:     '#b98cff',
  review_managers: '#6c8cff',
  in_work:         '#43d6a0',
  next:            '#7a8296',
  done:            '#5f6675',
}

/**
 * Work that is still owed to you — the headline "outstanding" figure.
 * `done` is out on purpose: once a task is invoiced it is no longer outstanding.
 */
export const COUNTED_STATUSES: TaskStatus[] = [
  'in_work',
  'waiting_upload',
  'review_code',
  'review_managers',
  'waiting_payment',
]

/**
 * Work actually performed, whether or not it has been invoiced — the basis for
 * every "earned" figure.
 *
 * These must not shrink when an invoice is created. Using the outstanding set
 * for them made a month's earnings drop by the invoice amount the moment the
 * invoice was issued, while the hours worked stayed put.
 */
export const EARNED_STATUSES: TaskStatus[] = [...COUNTED_STATUSES, 'done']

/**
 * Pre-ticked when building a review report: work that has left your hands and
 * now waits on someone else. The report modal lets any other status be added,
 * so this is a starting point rather than a restriction.
 */
export const REVIEW_STATUSES: TaskStatus[] = ['review_code', 'review_managers']

/** Fixed top-to-bottom grouping order for the dashboard task list. */
export const DASH_ORDER: TaskStatus[] = [
  'paused',
  'waiting_payment',
  'waiting_upload',
  'review_code',
  'review_managers',
  'in_work',
  'next',
]

/** Workflow progression used by the per-card back/forward step buttons. */
export const STEP_ORDER: TaskStatus[] = [
  'next',
  'in_work',
  'review_managers',
  'review_code',
  'waiting_upload',
  'waiting_payment',
  'paused',
]

/** Order of restore options offered in the done-tasks modal. */
export const RESTORE_ORDER: TaskStatus[] = [
  'in_work',
  'waiting_payment',
  'review_code',
  'review_managers',
  'waiting_upload',
  'paused',
  'next',
]

/** The neighbour of `current` in the workflow, clamped at both ends. */
export function stepStatus(current: TaskStatus, dir: 1 | -1): TaskStatus {
  let i = STEP_ORDER.indexOf(current)
  if (i < 0) i = 0
  i = Math.min(STEP_ORDER.length - 1, Math.max(0, i + dir))
  return STEP_ORDER[i]!
}

export const INVOICE_STATUS_COLOR: Record<InvoiceStatus, string> = {
  awaiting: '#8a94a6',
  sent:     '#6c8cff',
  paid:     '#43d6a0',
}
