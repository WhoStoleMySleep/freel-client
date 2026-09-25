import type { Invoice, InvoiceStatus, Task } from '~/types'

export const useInvoicesStore = defineStore('invoices', () => {
  const items = ref<Invoice[]>([])

  const total = computed(() => items.value.reduce((a, v) => a + (v.factual ?? v.total), 0))
  const unpaid = computed(() => items.value.filter(v => v.status !== 'paid'))

  const source = () => useAppStore().source

  function apply(next: Invoice[]): void {
    items.value = next
  }

  function lineFor(task: Task): { title: string, projectName: string, minutes: number, amount: number } {
    return {
      title: task.title,
      projectName: useProjectsStore().nameOf(task.projectId),
      minutes: task.minutes,
      amount: taskAmount(task, task.minutes),
    }
  }

  /**
   * Builds an invoice out of the chosen tasks and closes them.
   *
   * A timer running on one of them is stopped first: otherwise the invoice
   * would be short the stretch that has not been banked into the task yet.
   */
  async function createFromTasks(taskIds: string[]): Promise<void> {
    if (!taskIds.length) return
    await useTimerStore().settle(taskIds)

    const tasks = useTasksStore()
    const chosen = taskIds.map(id => tasks.byId.get(id)).filter((t): t is Task => !!t)
    if (!chosen.length) return

    const lines = chosen.map(lineFor)
    const projectNames = new Set(lines.map(l => l.projectName))
    items.value = await source().createInvoice({
      projectName: projectNames.size > 1 ? translate('invoice.mixedProjects') : [...projectNames][0]!,
      dayKey: todayKey(),
      items: lines,
    })
    await tasks.markDone(taskIds)
  }

  /** The factual amount only means anything on a paid invoice. */
  async function setStatus(id: string, status: InvoiceStatus, factual: number | null): Promise<void> {
    items.value = await source().setInvoiceStatus(id, status, status === 'paid' ? factual : null)
  }

  async function remove(id: string): Promise<void> {
    items.value = await source().deleteInvoice(id)
  }

  return { items, total, unpaid, apply, createFromTasks, setStatus, remove }
})
