import type { ActiveTimer, Invoice, InvoiceStatus, Project, Settings, Task, TaskStatus } from '~/types'
import type { NewInvoiceInput } from '~/repositories/modules/invoices'
import type { NewTaskInput, TaskEditInput } from '~/repositories/modules/tasks'

export interface ProjectInput {
  name: string
  description: string
}

/** Everything the stores put on screen, in one snapshot. */
export interface AppSnapshot {
  settings: Settings
  activeTimer: ActiveTimer | null
  projects: Project[]
  tasks: Task[]
  invoices: Invoice[]
  todayMinutes: number
}

/** Tasks together with today's total: the minutes move with the list. */
export interface TasksSnapshot {
  tasks: Task[]
  todayMinutes: number
}

/**
 * The single way into the app's data.
 *
 * There are two implementations — SQLite and an in-memory fixture — and the
 * stores never learn which one they got: demo mode and running in a browser
 * without Tauri both come down to swapping the source, rather than to an
 * `if (demoMode)` branch inside every single action.
 *
 * Every write returns the freshly read list it touched: SQLite re-reads the
 * table, the demo source hands back its own copy, and either way the store
 * simply assigns the result.
 */
export interface DataSource {
  /** Whether writes reach the disk — while they do not, the UI says so. */
  readonly persistent: boolean

  load: () => Promise<AppSnapshot>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  setActiveTimer: (timer: ActiveTimer | null) => Promise<void>

  createProject: (input: ProjectInput) => Promise<Project[]>
  updateProject: (id: string, patch: ProjectInput) => Promise<Project[]>
  setProjectArchived: (id: string, archived: boolean) => Promise<Project[]>
  deleteProject: (id: string) => Promise<{ projects: Project[], tasks: Task[] }>

  createTask: (input: NewTaskInput) => Promise<TasksSnapshot>
  updateTask: (id: string, patch: TaskEditInput) => Promise<Task[]>
  setTaskStatus: (id: string, status: TaskStatus) => Promise<Task[]>
  setTasksStatus: (ids: string[], status: TaskStatus) => Promise<Task[]>
  addMinutes: (taskId: string, minutes: number) => Promise<TasksSnapshot>
  /** Marks a task touched when there is nothing to bank: the timer ran under a minute. */
  touchTask: (taskId: string) => Promise<TasksSnapshot>
  deleteTask: (id: string) => Promise<TasksSnapshot>

  createInvoice: (input: NewInvoiceInput) => Promise<Invoice[]>
  setInvoiceStatus: (id: string, status: InvoiceStatus, factual: number | null) => Promise<Invoice[]>
  deleteInvoice: (id: string) => Promise<Invoice[]>
}
