import type { ComputedRef, Ref } from 'vue'
import type { Task, TaskGroup, TaskMaster, TaskRow } from '~/types'

export interface TaskSelection {
  /** Visible tasks grouped by project, each row carrying its tick. */
  groups: ComputedRef<TaskGroup[]>
  master: ComputedRef<TaskMaster>
  /** What the generator will act on — from the pool, not from the view. */
  chosen: ComputedRef<Task[]>
  setMany: (ids: string[], value: boolean) => void
  reset: (tasks: Task[]) => void
}

function buildGroup(projectId: string, rows: TaskRow[]): TaskGroup {
  const selectedCount = rows.filter(row => row.selected).length
  return {
    projectId,
    name: useProjectsStore().nameOf(projectId),
    rows,
    selectedCount,
    state: markStateOf(selectedCount, rows.length),
  }
}

/**
 * Tick-selection over a task list, shared by the invoice and the report
 * generator.
 *
 * `pool` is everything the generator may act on, `visible` is what the project
 * filter currently leaves on screen. They are kept apart on purpose: narrowing
 * the view must not quietly drop tasks from what is being generated.
 */
export function useTaskSelection(pool: Ref<Task[]>, visible: Ref<Task[]>): TaskSelection {
  const selected = ref(new Set<string>())

  function setMany(ids: string[], value: boolean): void {
    const next = new Set(selected.value)
    for (const id of ids) {
      if (value) next.add(id)
      else next.delete(id)
    }
    selected.value = next
  }

  function reset(tasks: Task[]): void {
    selected.value = new Set(tasks.map(task => task.id))
  }

  const groups = computed(() => {
    const byProject = new Map<string, TaskRow[]>()
    for (const task of visible.value) {
      const row = { task, selected: selected.value.has(task.id) }
      const rows = byProject.get(task.projectId)
      if (rows) rows.push(row)
      else byProject.set(task.projectId, [row])
    }
    return [...byProject].map(([projectId, rows]) => buildGroup(projectId, rows))
  })

  const master = computed<TaskMaster>(() => {
    const total = visible.value.length
    const count = visible.value.filter(task => selected.value.has(task.id)).length
    return { state: markStateOf(count, total), selected: count, total }
  })

  const chosen = computed(() => pool.value.filter(task => selected.value.has(task.id)))

  return { groups, master, chosen, setMany, reset }
}
