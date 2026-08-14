import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { BackupFile, backupFileName, parseBackup } from '../domain/backup';

export type SaveResult = { status: 'saved'; path: string } | { status: 'cancelled' };

/** Asks where to put the backup and writes it there. */
export async function saveBackup(backup: BackupFile): Promise<SaveResult> {
  const path = await save({
    defaultPath: backupFileName(),
    filters: [{ name: 'Резервная копия freel', extensions: ['json'] }],
  });
  if (!path) return { status: 'cancelled' };

  await writeTextFile(path, JSON.stringify(backup, null, 2));
  return { status: 'saved', path };
}

export type PickResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'ok'; backup: BackupFile };

/** Lets the user pick a backup file and validates its contents. */
export async function pickBackup(): Promise<PickResult> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Резервная копия freel', extensions: ['json'] }],
  });
  if (!picked) return { status: 'cancelled' };

  const path = typeof picked === 'string' ? picked : (picked as { path: string }).path;
  try {
    const raw = await readTextFile(path);
    const parsed = parseBackup(raw);
    if (!parsed.ok) return { status: 'error', message: parsed.error };
    return { status: 'ok', backup: parsed.data };
  } catch (e) {
    return { status: 'error', message: 'Не удалось прочитать файл: ' + String(e) };
  }
}
