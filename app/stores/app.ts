import type { DataSource } from '~/repositories/source'
import type { BackupFile } from '~/types'
import { sqliteSource } from '~/repositories/sources/sqlite'
import { demoSource } from '~/repositories/sources/demo'
import { exportBackup, importBackup } from '~/repositories/modules/backup'

export type AppPhase = 'loading' | 'onboarding' | 'app'

/**
 * What the app is showing and where it takes its data from.
 *
 * The source is swapped whole: in a browser without Tauri, and while the
 * preview is on, it is the in-memory fixture; otherwise SQLite. The stores
 * never see the difference.
 */
export const useAppStore = defineStore('app', () => {
  const ready = ref(false)
  const phase = ref<AppPhase>('loading')
  const demoMode = ref(false)
  const source = shallowRef<DataSource>(isTauri() ? sqliteSource() : demoSource())

  const persistent = computed(() => source.value.persistent)

  function setPhase(next: AppPhase): void {
    phase.value = next
  }

  /** Re-reads everything: on start, after a sync exchange, after the other window wrote. */
  async function hydrate(): Promise<void> {
    const snapshot = await source.value.load()
    useSettingsStore().apply(snapshot.settings)
    useProjectsStore().apply(snapshot.projects)
    useTasksStore().apply({ tasks: snapshot.tasks, todayMinutes: snapshot.todayMinutes })
    useInvoicesStore().apply(snapshot.invoices)
    await useTimerStore().apply(snapshot.activeTimer)
    ready.value = true
  }

  function useSource(demo: boolean): void {
    demoMode.value = demo
    source.value = demo || !isTauri() ? demoSource() : sqliteSource()
  }

  /** Preview on invented data: the real rows stay on disk untouched. */
  async function toggleDemoMode(): Promise<void> {
    await useTimerStore().forget()
    useSource(!demoMode.value)
    await hydrate()
  }

  /** A backup must reflect what is on disk, so a running timer is banked first. */
  async function buildBackup(): Promise<BackupFile> {
    await useTimerStore().stop()
    return exportBackup()
  }

  async function restoreBackup(backup: BackupFile): Promise<void> {
    await useTimerStore().forget()
    await importBackup(backup)
    // Leaving demo mode behind avoids restoring into a preview session.
    useSource(false)
    await hydrate()
  }

  return { ready, phase, demoMode, source, persistent, setPhase, hydrate, toggleDemoMode, buildBackup, restoreBackup }
})
