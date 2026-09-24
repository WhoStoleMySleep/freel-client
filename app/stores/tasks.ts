import type { TasksSnapshot } from '~/repositories/source'
import type { NewTaskInput, TaskEditInput } from '~/repositories/modules/tasks'
import type { Task, TaskStatus } from '~/types'

export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const todayMinutes = ref(0)

  const byId = computed(() => new Map(items.value.map(t => [t.id, t])))
  const byStatus = computed(() => {
    const groups = new Map<TaskStatus, Task[]>()
    for (const task of items.value) {
      const group = groups.get(task.status)
      if (group) group.push(task)
      else groups.set(task.status, [task])
    }
    return groups
  })
  const counted = computed(() => items.value.filter(t => COUNTED_STATUSES.includes(t.status)))

  const source = () => useAppStore().source

  function apply(snapshot: TasksSnapshot): void {
    items.value = snapshot.tasks
    todayMinutes.value = snapshot.todayMinutes
  }

  /** Takes the list alone, for edits that cannot have moved today's total. */
  function applyList(next: Task[]): void {
    items.value = next
  }

  async function add(input: NewTaskInput): Promise<void> {
    apply(await source().createTask(input))
    void broadcastChanged()
  }

  async function edit(id: string, patch: TaskEditInput): Promise<void> {
    applyList(await source().updateTask(id, patch))
    void broadcastChanged()
  }

  async function setStatus(id: string, status: TaskStatus): Promise<void> {
    applyList(await source().setTaskStatus(id, status))
    void broadcastChanged()
  }

  /** Moves a task one step along the status workflow. */
  async function stepStatusOf(id: string, dir: 1 | -1): Promise<void> {
    const task = byId.value.get(id)
    if (!task) return
    await setStatus(id, stepStatus(task.status, dir))
  }

  async function markDone(ids: string[]): Promise<void> {
    applyList(await source().setTasksStatus(ids, 'done'))
    void broadcastChanged()
  }

  async function addManualTime(id: string, minutes: number): Promise<void> {
    if (minutes <= 0) return
    apply(await source().addMinutes(id, minutes))
    void broadcastChanged()
  }

  /**
   * Banks what the timer worked into the task. Anything under a minute is not
   * recorded, but the task is still marked touched — otherwise sync would never
   * learn it was worked on at all.
   */
  async function commitTimer(taskId: string, minutes: number): Promise<void> {
    apply(minutes > 0 ? await source().addMinutes(taskId, minutes) : await source().touchTask(taskId))
  }

  async function remove(id: string): Promise<void> {
    await useTimerStore().forgetTask(id)
    apply(await source().deleteTask(id))
    void broadcastChanged()
  }

  return {
    items,
    todayMinutes,
    byId,
    byStatus,
    counted,
    apply,
    applyList,
    add,
    edit,
    setStatus,
    stepStatusOf,
    markDone,
    addManualTime,
    commitTimer,
    remove,
  }
})
