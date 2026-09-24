import type { DataSource, ProjectInput, TasksSnapshot } from '~/repositories/source'
import type { NewInvoiceInput } from '~/repositories/modules/invoices'
import type { NewTaskInput, TaskEditInput } from '~/repositories/modules/tasks'
import type { ActiveTimer, InvoiceStatus, Settings, TaskStatus } from '~/types'
import * as projectsRepo from '~/repositories/modules/projects'
import * as tasksRepo from '~/repositories/modules/tasks'
import * as invoicesRepo from '~/repositories/modules/invoices'
import * as timeEntriesRepo from '~/repositories/modules/timeEntries'
import * as settingsRepo from '~/repositories/modules/settings'

async function tasksSnapshot(): Promise<TasksSnapshot> {
  const [tasks, todayMinutes] = await Promise.all([
    tasksRepo.listTasks(),
    timeEntriesRepo.sumMinutesForDay(todayKey()),
  ])
  return { tasks, todayMinutes }
}

/** The app's data as it lives on disk. */
export function sqliteSource(): DataSource {
  return {
    persistent: true,

    async load() {
      await settingsRepo.ensureDevice()
      const { settings, activeTimer } = await settingsRepo.loadSettings()
      const [projects, invoices, tasks] = await Promise.all([
        projectsRepo.listProjects(),
        invoicesRepo.listInvoices(),
        tasksSnapshot(),
      ])
      return { settings, activeTimer, projects, invoices, ...tasks }
    },

    updateSettings: (patch: Partial<Settings>) => settingsRepo.updateSettings(patch),
    setActiveTimer: (timer: ActiveTimer | null) => settingsRepo.setActiveTimer(timer),

    async createProject(input: ProjectInput) {
      await projectsRepo.createProject(input)
      return projectsRepo.listProjects()
    },
    async updateProject(id: string, patch: ProjectInput) {
      await projectsRepo.updateProject(id, patch)
      return projectsRepo.listProjects()
    },
    async setProjectArchived(id: string, archived: boolean) {
      await projectsRepo.setProjectArchived(id, archived)
      return projectsRepo.listProjects()
    },
    async deleteProject(id: string) {
      await projectsRepo.deleteProjectForever(id)
      const [projects, tasks] = await Promise.all([projectsRepo.listProjects(), tasksRepo.listTasks()])
      return { projects, tasks }
    },

    async createTask(input: NewTaskInput) {
      const created = await tasksRepo.createTask(input)
      if (input.initialMinutes > 0) await timeEntriesRepo.addMinutesToday(created.id, input.initialMinutes)
      return tasksSnapshot()
    },
    async updateTask(id: string, patch: TaskEditInput) {
      await tasksRepo.updateTask(id, patch)
      return tasksRepo.listTasks()
    },
    async setTaskStatus(id: string, status: TaskStatus) {
      await tasksRepo.setTaskStatus(id, status)
      return tasksRepo.listTasks()
    },
    async setTasksStatus(ids: string[], status: TaskStatus) {
      await tasksRepo.setTasksStatusBulk(ids, status)
      return tasksRepo.listTasks()
    },
    async addMinutes(taskId: string, minutes: number) {
      await timeEntriesRepo.addMinutesToday(taskId, minutes)
      return tasksSnapshot()
    },
    async touchTask(taskId: string) {
      await tasksRepo.touchTask(taskId)
      return tasksSnapshot()
    },
    async deleteTask(id: string) {
      await tasksRepo.deleteTask(id)
      return tasksSnapshot()
    },

    async createInvoice(input: NewInvoiceInput) {
      await invoicesRepo.createInvoice(input)
      return invoicesRepo.listInvoices()
    },
    async setInvoiceStatus(id: string, status: InvoiceStatus, factual: number | null) {
      await invoicesRepo.updateInvoiceStatus(id, status, factual)
      return invoicesRepo.listInvoices()
    },
    async deleteInvoice(id: string) {
      await invoicesRepo.deleteInvoice(id)
      return invoicesRepo.listInvoices()
    },
  }
}
