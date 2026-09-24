/**
 * A subscription that only exists once a promise resolves.
 *
 * The unsubscriber arrives later than the scope can close, so it has to be
 * applied retroactively — otherwise a scope that beats the promise leaks a
 * listener that fires for the rest of the session.
 */
export function useAsyncListener(subscribe: () => Promise<() => void>): void {
  let unsubscribe: (() => void) | null = null
  let closed = false

  subscribe()
    .then((fn) => {
      if (closed) fn()
      else unsubscribe = fn
    })
    .catch(() => {})

  onScopeDispose(() => {
    closed = true
    unsubscribe?.()
  })
}
