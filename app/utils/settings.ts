import type { Settings } from '~/types'

/** What the app runs on until the first load from the database. */
export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  currency: 'RUB',
  defaultRate: 2500,
  hasOnboarded: false,
  invoiceSeq: 0,
  compactTaskForm: false,
}
