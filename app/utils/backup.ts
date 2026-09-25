import type { BackupError, BackupFile, BackupSummary } from '~/types'

export const BACKUP_APP_ID = 'freel'
/**
 * v2 adds `createdAt`/`updatedAt` to time entries, invoices and invoice items.
 * v1 files still import — the missing timestamps are derived from each row's
 * own date, the same rule the schema migration applies.
 */
export const BACKUP_FORMAT_VERSION = 2

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

/**
 * Validates a parsed JSON blob, returning the backup or why it was rejected.
 *
 * The reason is a code rather than a sentence: this runs far from the
 * interface, which is where the message has to be put into words.
 */
export function parseBackup(raw: string): { ok: true; data: BackupFile } | { ok: false; error: BackupError } {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'notJson' }
  }

  if (typeof json !== 'object' || json === null) {
    return { ok: false, error: 'corrupt' }
  }
  const backup = json as Partial<BackupFile>

  if (backup.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'foreign' }
  }
  if (typeof backup.formatVersion !== 'number' || backup.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'tooNew' }
  }
  if (!backup.settings || !isArray(backup.projects) || !isArray(backup.tasks) || !isArray(backup.invoices) || !isArray(backup.invoiceItems) || !isArray(backup.timeEntries)) {
    return { ok: false, error: 'incomplete' }
  }

  return { ok: true, data: json as BackupFile }
}

export function summarize(backup: BackupFile): BackupSummary {
  return {
    projects: backup.projects.length,
    tasks: backup.tasks.length,
    invoices: backup.invoices.length,
    exportedAt: backup.exportedAt,
  }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `freel-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
}
