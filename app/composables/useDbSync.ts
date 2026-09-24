/**
 * The panel and the auto-sync loop both write to the database behind this
 * window's back; re-read whenever either reports a change.
 */
export function useDbSync(): void {
  const { hydrate } = useAppStore()
  useAsyncListener(() => onChanged(() => {
    hydrate().catch(() => {})
  }))
}
