import type { Ref } from 'vue'

/**
 * Current time for live elapsed/amount rendering, advancing once a second
 * while a timer actually runs.
 *
 * A hidden window — the concealed edge panel, or a minimised app — is
 * re-rendered every second for nobody, and the clock catches up on return.
 * A paused timer contributes no live time, so it is left frozen as well.
 */
export function useTimerTick(): Ref<number> {
  const { running } = storeToRefs(useTimerStore())
  const now = ref(Date.now())
  let tick: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (tick === null) return
    clearInterval(tick)
    tick = null
  }

  function start(): void {
    if (tick !== null) return
    // Resuming — after a pause or after the window comes back — must not
    // leave the stale clock on screen for up to a second.
    now.value = Date.now()
    tick = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  const sync = () => (running.value && !document.hidden ? start() : stop())
  watch(running, sync, { immediate: true })
  document.addEventListener('visibilitychange', sync)
  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', sync)
    stop()
  })

  return now
}
