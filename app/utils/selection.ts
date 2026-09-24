import type { MarkState } from '~/types'

/** State of a group tick from how many of its rows are selected. */
export function markStateOf(selected: number, total: number): MarkState {
  if (selected === 0 || total === 0) return 'none'
  return selected === total ? 'all' : 'some'
}
