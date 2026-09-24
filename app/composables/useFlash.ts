import type { Ref } from 'vue'

export interface Flash<T> {
  value: Ref<T>
  flash: (next: T) => void
}

/**
 * A short-lived value that resets itself after `ms`.
 *
 * The pending timer is cancelled together with the scope: modals here are
 * routinely closed before the notice expires, and a surviving timer would set
 * state on something already unmounted. A second flash replaces the first
 * rather than stacking timers.
 */
export function useFlash<T>(idle: T, ms: number): Flash<T> {
  const value = ref(idle) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  function clear(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function flash(next: T): void {
    clear()
    value.value = next
    // Flashing the idle value is a plain reset — there is nothing to undo.
    if (Object.is(next, idle)) return
    timer = setTimeout(() => {
      value.value = idle
    }, ms)
  }

  onScopeDispose(clear)
  return { value, flash }
}
