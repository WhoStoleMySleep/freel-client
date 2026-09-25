export type TaskStatus =
  | 'paused'
  | 'waiting_payment'
  | 'waiting_upload'
  | 'review_code'
  | 'review_managers'
  | 'in_work'
  | 'next'
  | 'done'

export type InvoiceStatus = 'awaiting' | 'sent' | 'paid'

export type RateType = 'hourly' | 'fixed'

export type Currency = 'RUB' | 'USD' | 'EUR' | 'GBP' | 'CNY'

export type ThemeMode = 'system' | 'dark' | 'light'

/** Locales the interface ships in; 'system' follows the OS. */
export type LanguageMode = 'system' | 'ru' | 'en'

export type Locale = 'ru' | 'en'

/**
 * What a pure text builder needs to speak the user's language: vue-i18n's `t`
 * narrowed to the shape these helpers call it with, plus the locale the
 * formatters take. Passing it in keeps `app/utils` free of app state.
 */
/** Why a backup file was rejected; the interface turns it into a sentence. */
export type BackupError = 'notJson' | 'corrupt' | 'foreign' | 'tooNew' | 'incomplete' | 'unreadable'

export interface TextContext {
  locale: Locale
  t: (key: string, params?: Record<string, unknown>) => string
}

export interface Project {
  id: string
  name: string
  description: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  link: string
  rateType: RateType
  rate: number
  minutes: number
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

/**
 * `createdAt`/`updatedAt` below are optional only because rows read before the
 * sync-metadata migration, and backups written in format v1, do not carry them.
 * Everything the app writes now sets both.
 */
export interface TimeEntry {
  id: string
  taskId: string
  dayKey: string
  minutes: number
  createdAt?: string
  updatedAt?: string
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  title: string
  projectName: string
  minutes: number
  amount: number
  createdAt?: string
  updatedAt?: string
}

export interface Invoice {
  id: string
  number: string
  projectName: string
  dayKey: string
  status: InvoiceStatus
  factual: number | null
  total: number
  items: InvoiceItem[]
  createdAt?: string
  updatedAt?: string
}

export interface Settings {
  themeMode: ThemeMode
  language: LanguageMode
  currency: Currency
  defaultRate: number
  hasOnboarded: boolean
  invoiceSeq: number
  compactTaskForm: boolean
  /** Optional so callers can build a Settings patch without one. */
  updatedAt?: string
  /** Prefix stamped on invoice numbers, keeping them unique per device. */
  deviceCode?: string
}

export interface ActiveTimer {
  taskId: string
  /** When the current (unpaused) stretch began. */
  startedAt: string
  /** Time banked from earlier stretches, before the latest pause/resume. */
  accumulatedMs: number
  paused: boolean
}

/**
 * Everything needed to reconstruct the app's state on another device.
 * The active timer is deliberately excluded — restoring a "running" timer
 * from an old backup would silently invent time that was never worked.
 */
export interface BackupFile {
  app: string
  formatVersion: number
  exportedAt: string
  settings: Settings
  projects: Project[]
  tasks: Task[]
  timeEntries: TimeEntry[]
  invoices: Omit<Invoice, 'items'>[]
  invoiceItems: InvoiceItem[]
}

export interface BackupSummary {
  projects: number
  tasks: number
  invoices: number
  exportedAt: string
}

/** A tri-state tick: nothing, part or all of a group is selected. */
export type MarkState = 'none' | 'some' | 'all'

export interface TaskRow {
  task: Task
  selected: boolean
}

export interface TaskGroup {
  projectId: string
  name: string
  rows: TaskRow[]
  selectedCount: number
  state: MarkState
}

/** The "select all" line above the groups. */
export interface TaskMaster {
  state: MarkState
  selected: number
  total: number
}

export interface DashboardGroup {
  key: TaskStatus
  color: string
  tasks: Task[]
}

export interface DashboardInput {
  tasks: Task[]
  activeTimer: ActiveTimer | null
  /** Current time, so a running timer counts towards the figures. */
  nowMs: number
  todayMinutes: number
}

export interface DashboardStats {
  earnedTotal: number
  hoursTotal: number
  earnedMonth: number
  hoursMonth: number
  earnedToday: number
  createdToday: number
  timeToday: number
  groups: DashboardGroup[]
  listCount: number
  doneCount: number
}

export interface InvoiceGroup {
  name: string
  subtotal: number
  items: InvoiceItem[]
}

export type IconName =
  | 'clock'
  | 'settings'
  | 'moon'
  | 'sun'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'play'
  | 'pause'
  | 'invoice'
  | 'link'
  | 'tab-dash'
  | 'tab-projects'
  | 'tab-billing'
  | 'stop'

export type IconShape =
  | { tag: 'path', d: string }
  | { tag: 'circle', cx: number, cy: number, r: number }
  | { tag: 'rect', x: number, y: number, width: number, height: number, rx: number }

export interface IconDef {
  shapes: IconShape[]
  /** What the design gives this icon when the call site says nothing. */
  size?: number
  strokeWidth?: number
  /** Solid glyphs are painted rather than stroked. */
  filled?: boolean
}

/** What goes after the task title in a report: where to look, or how long it took. */
export type ReportMode = 'link' | 'hours'

export interface ReportRow {
  projectName: string
  title: string
  link: string
  minutes: number
}

/** What the sync server-side account looks like from this device. */
export interface SyncStatus {
  url: string
  email: string
  connected: boolean
  lastSyncAt: string
}

export interface SyncResult {
  sent: number
  received: number
  lastSyncAt: string
}
