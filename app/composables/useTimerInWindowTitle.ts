/** Mirrors the running timer into the window title, desktop's status bar. */
export function useTimerInWindowTitle(): void {
  if (!isDesktopApp()) return

  const { active, task } = storeToRefs(useTimerStore())
  const { t } = useI18n()
  const name = computed(() => task.value?.title ?? t('app.taskFallback'))
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
    void setWindowTitle(`${clock}${timer.paused ? ` (${t('app.paused')})` : ''} · ${name.value} — ${APP_TITLE}`)
  }

  watch([active, name], () => {
    stop()
    render()
    if (active.value && !active.value.paused) tick = setInterval(render, 1000)
  }, { immediate: true })
  onScopeDispose(stop)
}
