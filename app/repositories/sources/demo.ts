import type { AppSnapshot, DataSource, ProjectInput, TasksSnapshot } from '~/repositories/source'
import type { NewInvoiceInput } from '~/repositories/modules/invoices'
import type { NewTaskInput, TaskEditInput } from '~/repositories/modules/tasks'
import type { ActiveTimer, Invoice, InvoiceItem, InvoiceStatus, Project, Settings, Task, TaskStatus } from '~/types'

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * The in-memory fixture dataset.
 *
 * It speaks the same interface as SQLite, which is what turns the Settings
 * preview toggle — and running in a browser without Tauri — into a plain swap
 * of the source. Writes go nowhere: leaving the mode simply drops this copy,
 * while the real data sat on disk untouched the whole time.
 */
export function demoSource(): DataSource {
  const data = buildDemoData()
  let projects: Project[] = data.projects
  let tasks: Task[] = data.tasks
  let invoices: Invoice[] = data.invoices
  let settings: Settings = { ...DEFAULT_SETTINGS, hasOnboarded: true }
  let activeTimer: ActiveTimer | null = null
  let todayMinutes = demoTodayMinutes(tasks)

  const withTasks = (next: Task[]): Task[] => (tasks = next)
  const snapshot = (): TasksSnapshot => ({ tasks, todayMinutes })

  function patchTask(id: string, patch: Partial<Task>): Task[] {
    return withTasks(tasks.map(t => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t)))
  }

  function addMinutes(taskId: string, minutes: number): TasksSnapshot {
    const task = tasks.find(t => t.id === taskId)
    if (task) patchTask(taskId, { minutes: task.minutes + minutes })
    todayMinutes += minutes
    return snapshot()
  }

  return {
    persistent: false,

    load: async (): Promise<AppSnapshot> => ({ settings, activeTimer, projects, tasks, invoices, todayMinutes }),
    updateSettings: async (patch: Partial<Settings>) => {
      settings = { ...settings, ...patch }
    },
    setActiveTimer: async (timer: ActiveTimer | null) => {
      activeTimer = timer
    },

    createProject: async (input: ProjectInput) => {
      const at = nowIso()
      projects = [...projects, { id: newId(), ...input, archived: false, createdAt: at, updatedAt: at }]
      return projects
    },
    updateProject: async (id: string, patch: ProjectInput) => {
      projects = projects.map(p => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p))
      return projects
    },
    setProjectArchived: async (id: string, archived: boolean) => {
      projects = projects.map(p => (p.id === id ? { ...p, archived, updatedAt: nowIso() } : p))
      return projects
    },
    deleteProject: async (id: string) => {
      projects = projects.filter(p => p.id !== id)
      return { projects, tasks: withTasks(tasks.filter(t => t.projectId !== id)) }
    },

    createTask: async (input: NewTaskInput) => {
      const at = nowIso()
      const { initialMinutes, ...rest } = input
      withTasks([...tasks, { id: newId(), ...rest, minutes: initialMinutes, createdAt: at, updatedAt: at }])
      todayMinutes += initialMinutes
      return snapshot()
    },
    updateTask: async (id: string, patch: TaskEditInput) => patchTask(id, patch),
    setTaskStatus: async (id: string, status: TaskStatus) => patchTask(id, { status }),
    setTasksStatus: async (ids: string[], status: TaskStatus) => {
      const chosen = new Set(ids)
      return withTasks(tasks.map(t => (chosen.has(t.id) ? { ...t, status, updatedAt: nowIso() } : t)))
    },
    addMinutes: async (taskId: string, minutes: number) => addMinutes(taskId, minutes),
    touchTask: async (taskId: string) => {
      patchTask(taskId, {})
      return snapshot()
    },
    deleteTask: async (id: string) => {
      withTasks(tasks.filter(t => t.id !== id))
      return snapshot()
    },

    createInvoice: async (input: NewInvoiceInput) => {
      const id = newId()
      const items: InvoiceItem[] = input.items.map(item => ({ id: newId(), invoiceId: id, ...item }))
      const total = items.reduce((a, i) => a + i.amount, 0)
      const number = '#' + String(invoices.length + 1).padStart(5, '0')
      invoices = [{ id, number, projectName: input.projectName, dayKey: input.dayKey, status: 'awaiting', factual: null, total, items }, ...invoices]
      return invoices
    },
    setInvoiceStatus: async (id: string, status: InvoiceStatus, factual: number | null) => {
      invoices = invoices.map(v => (v.id === id ? { ...v, status, factual } : v))
      return invoices
    },
    deleteInvoice: async (id: string) => {
      invoices = invoices.filter(v => v.id !== id)
      return invoices
    },
  }
}
