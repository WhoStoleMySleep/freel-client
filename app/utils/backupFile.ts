import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { BackupError, BackupFile } from '~/types'

export type SaveResult = { status: 'saved', path: string } | { status: 'cancelled' }

/** Asks where to put the backup and writes it there. */
export async function saveBackup(backup: BackupFile, filterName: string): Promise<SaveResult> {
  const path = await save({
    defaultPath: backupFileName(),
    filters: [{ name: filterName, extensions: ['json'] }],
  })
  if (!path) return { status: 'cancelled' }

  await writeTextFile(path, JSON.stringify(backup, null, 2))
  return { status: 'saved', path }
}

export type PickResult =
  | { status: 'cancelled' }
  | { status: 'error', error: BackupError, detail?: string }
  | { status: 'ok', backup: BackupFile }

/** Lets the user pick a backup file and validates its contents. */
export async function pickBackup(filterName: string): Promise<PickResult> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: filterName, extensions: ['json'] }],
  })
  if (!picked) return { status: 'cancelled' }

  const path = typeof picked === 'string' ? picked : (picked as { path: string }).path
  try {
    const raw = await readTextFile(path)
    const parsed = parseBackup(raw)
    if (!parsed.ok) return { status: 'error', error: parsed.error }
    return { status: 'ok', backup: parsed.data }
  }
  catch (e) {
    return { status: 'error', error: 'unreadable', detail: String(e) }
  }
}
