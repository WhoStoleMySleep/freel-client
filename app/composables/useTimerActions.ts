/** The ongoing notification's buttons act on the timer store directly. */
export function useTimerActions(): void {
  const timer = useTimerStore()
  useAsyncListener(() => listenTimerActions({
    onPause: timer.pause,
    onResume: timer.resume,
    onStop: timer.stop,
  }))
}
