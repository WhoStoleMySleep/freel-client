import { invoke } from '@tauri-apps/api/core'
import { getDb } from '~/repositories/db'
import { loadSettings } from '~/repositories/modules/settings'
import { mapProject, type ProjectRow } from '~/repositories/modules/projects'
import { mapTask, type TaskRow } from '~/repositories/modules/tasks'
import { mapTimeEntry, type TimeEntryRow } from '~/repositories/modules/timeEntries'
import {
  mapInvoice,
  mapInvoiceItem,
  type InvoiceItemRow,
  type InvoiceRow,
} from '~/repositories/modules/invoices'
import type { BackupFile } from '~/types'

// Tombstones stay out of the file: a backup is a snapshot of what the user has,
// not a sync log. Restoring wipes the table anyway, so a deleted row being
// absent is exactly right.
const LIVE = {
  projects: 'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC',
  tasks: 'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at ASC',
  timeEntries: 'SELECT * FROM time_entries WHERE deleted_at IS NULL',
  invoices: 'SELECT * FROM invoices WHERE deleted_at IS NULL ORDER BY rowid ASC',
  invoiceItems: 'SELECT * FROM invoice_items WHERE deleted_at IS NULL',
} as const

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDb()
  const { settings } = await loadSettings()

  const projects = await db.select<ProjectRow[]>(LIVE.projects)
  const tasks = await db.select<TaskRow[]>(LIVE.tasks)
  const timeEntries = await db.select<TimeEntryRow[]>(LIVE.timeEntries)
  const invoices = await db.select<InvoiceRow[]>(LIVE.invoices)
  const invoiceItems = await db.select<InvoiceItemRow[]>(LIVE.invoiceItems)

  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    projects: projects.map(mapProject),
    tasks: tasks.map(mapTask),
    timeEntries: timeEntries.map(mapTimeEntry),
    invoices: invoices.map(mapInvoice),
    invoiceItems: invoiceItems.map(mapInvoiceItem),
  }
}

/**
 * Replaces all stored data with the backup's contents.
 *
 * The work runs in Rust (`restore_backup`) rather than here: `tauri-plugin-sql`
 * gives every `execute` an arbitrary connection from a pool, so `BEGIN` and
 * `COMMIT` issued from JavaScript land on different connections and never form
 * a transaction. A restore that failed halfway would wipe the data it exists to
 * protect, so it has to be one all-or-nothing command.
 */
export async function importBackup(backup: BackupFile): Promise<void> {
  await invoke('restore_backup', { payload: backup })
}
