import type { ProjectInput } from '~/repositories/source'
import type { Project } from '~/types'

export const useProjectsStore = defineStore('projects', () => {
  const items = ref<Project[]>([])

  const active = computed(() => items.value.filter(p => !p.archived))
  const archived = computed(() => items.value.filter(p => p.archived))
  // A project's name is asked for on every task in the list — Map, not find.
  const byId = computed(() => new Map(items.value.map(p => [p.id, p])))
  const nameOf = computed(() => (id: string) => byId.value.get(id)?.name ?? '—')

  const source = () => useAppStore().source

  function apply(next: Project[]): void {
    items.value = next
  }

  async function add(input: ProjectInput): Promise<void> {
    items.value = await source().createProject(input)
  }

  async function edit(id: string, patch: ProjectInput): Promise<void> {
    items.value = await source().updateProject(id, patch)
  }

  async function setArchived(id: string, value: boolean): Promise<void> {
    items.value = await source().setProjectArchived(id, value)
  }

  /** Deletes the project along with its tasks — those leave the task store too. */
  async function removeForever(id: string): Promise<void> {
    const { projects, tasks } = await source().deleteProject(id)
    items.value = projects
    useTasksStore().applyList(tasks)
  }

  return { items, active, archived, byId, nameOf, apply, add, edit, setArchived, removeForever }
})
