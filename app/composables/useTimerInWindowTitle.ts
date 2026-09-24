/** Mirrors the running timer into the window title, desktop's status bar. */
export function useTimerInWindowTitle(): void {
  if (!isDesktopApp()) return

  const { active, task } = storeToRefs(useTimerStore())
  const name = computed(() => task.value?.title ?? 'Задача')
  let tick: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (tick === null) return
    clearInterval(tick)
    tick = null
  }

  function render(): void {
    const timer = active.value
    if (!timer) {
      void setWindowTitle(APP_TITLE)
      return
    }
    const clock = formatClock(Math.floor(timerElapsedMs(timer, Date.now()) / 1000))
    void setWindowTitle(`${clock}${timer.paused ? ' (пауза)' : ''} · ${name.value} — ${APP_TITLE}`)
  }

  watch([active, name], () => {
    stop()
    render()
    if (active.value && !active.value.paused) tick = setInterval(render, 1000)
  }, { immediate: true })
  onScopeDispose(stop)
}
