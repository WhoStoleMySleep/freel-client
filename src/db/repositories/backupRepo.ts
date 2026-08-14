import { invoke } from '@tauri-apps/api/core';
import { getDb } from '../client';
import { BackupFile, BACKUP_APP_ID, BACKUP_FORMAT_VERSION } from '../../domain/backup';
import { Task } from '../../domain/types';
import { loadSettings } from './settingsRepo';

interface RawProject { id: string; name: string; description: string; archived: number; created_at: string; updated_at: string }
interface RawTask {
  id: string; project_id: string; title: string; description: string; link: string;
  rate_type: string; rate: number; minutes: number; status: string; created_at: string; updated_at: string;
}
interface RawTimeEntry { id: string; task_id: string; day_key: string; minutes: number; created_at: string; updated_at: string }
interface RawInvoice { id: string; number: string; project_name: string; day_key: string; status: string; factual: number | null; total: number; created_at: string; updated_at: string }
interface RawInvoiceItem { id: string; invoice_id: string; title: string; project_name: string; minutes: number; amount: number; created_at: string; updated_at: string }

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDb();
  const { settings } = await loadSettings();

  // Tombstones stay out of the file: a backup is a snapshot of what the user
  // has, not a sync log. Restoring wipes the table anyway, so a deleted row
  // being absent is exactly right.
  const projects = await db.select<RawProject[]>(
    'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC'
  );
  const tasks = await db.select<RawTask[]>(
    'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at ASC'
  );
  const timeEntries = await db.select<RawTimeEntry[]>(
    'SELECT * FROM time_entries WHERE deleted_at IS NULL'
  );
  const invoices = await db.select<RawInvoice[]>(
    'SELECT * FROM invoices WHERE deleted_at IS NULL ORDER BY rowid ASC'
  );
  const invoiceItems = await db.select<RawInvoiceItem[]>(
    'SELECT * FROM invoice_items WHERE deleted_at IS NULL'
  );

  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      archived: !!p.archived,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      projectId: t.project_id,
      title: t.title,
      description: t.description,
      link: t.link,
      rateType: t.rate_type,
      rate: t.rate,
      minutes: t.minutes,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })) as Task[],
    timeEntries: timeEntries.map((e) => ({
      id: e.id,
      taskId: e.task_id,
      dayKey: e.day_key,
      minutes: e.minutes,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
    invoices: invoices.map((v) => ({
      id: v.id,
      number: v.number,
      projectName: v.project_name,
      dayKey: v.day_key,
      status: v.status,
      factual: v.factual,
      total: v.total,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    })) as BackupFile['invoices'],
    invoiceItems: invoiceItems.map((i) => ({
      id: i.id,
      invoiceId: i.invoice_id,
      title: i.title,
      projectName: i.project_name,
      minutes: i.minutes,
      amount: i.amount,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    })),
  };
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
  await invoke('restore_backup', { payload: backup });
}
