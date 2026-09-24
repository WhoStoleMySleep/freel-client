/** Shown instead of an empty project name, in every list that groups by one. */
export const UNNAMED_PROJECT = 'Без проекта'

/**
 * Groups anything carrying a project name, keeping first-appearance order —
 * `Map` iterates in insertion order, so callers get the projects in the order
 * their first row appeared.
 */
export function groupByProjectName<T extends { projectName: string }>(items: T[]): Map<string, T[]> {
  const byName = new Map<string, T[]>()
  for (const item of items) {
    const name = item.projectName || UNNAMED_PROJECT
    const list = byName.get(name) ?? []
    list.push(item)
    byName.set(name, list)
  }
  return byName
}
