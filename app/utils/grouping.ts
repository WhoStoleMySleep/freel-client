/**
 * Groups anything carrying a project name, keeping first-appearance order —
 * `Map` iterates in insertion order, so callers get the projects in the order
 * their first row appeared.
 *
 * `fallbackName` stands in for a row with no project of its own; it is passed
 * in rather than fixed here because it is user-facing text.
 */
export function groupByProjectName<T extends { projectName: string }>(
  items: T[],
  fallbackName: string
): Map<string, T[]> {
  const byName = new Map<string, T[]>()
  for (const item of items) {
    const name = item.projectName || fallbackName
    const list = byName.get(name) ?? []
    list.push(item)
    byName.set(name, list)
  }
  return byName
}
