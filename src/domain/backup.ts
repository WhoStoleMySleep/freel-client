import { Invoice, InvoiceItem, Project, Settings, Task, TimeEntry } from './types';

export const BACKUP_APP_ID = 'freel';
/**
 * v2 adds `createdAt`/`updatedAt` to time entries, invoices and invoice items.
 * v1 files still import — the missing timestamps are derived from each row's
 * own date, the same rule the schema migration applies.
 */
export const BACKUP_FORMAT_VERSION = 2;

/**
 * Everything needed to reconstruct the app's state on another device.
 * The active timer is deliberately excluded — restoring a "running" timer
 * from an old backup would silently invent time that was never worked.
 */
export interface BackupFile {
  app: string;
  formatVersion: number;
  exportedAt: string;
  settings: Settings;
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  invoices: Omit<Invoice, 'items'>[];
  invoiceItems: InvoiceItem[];
}

export interface BackupSummary {
  projects: number;
  tasks: number;
  invoices: number;
  exportedAt: string;
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** Validates a parsed JSON blob, returning the backup or an error message. */
export function parseBackup(raw: string): { ok: true; data: BackupFile } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Файл не является корректным JSON.' };
  }

  if (typeof json !== 'object' || json === null) {
    return { ok: false, error: 'Файл повреждён.' };
  }
  const b = json as Partial<BackupFile>;

  if (b.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Это не резервная копия freel.' };
  }
  if (typeof b.formatVersion !== 'number' || b.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'Копия создана более новой версией приложения.' };
  }
  if (!b.settings || !isArray(b.projects) || !isArray(b.tasks) || !isArray(b.invoices) || !isArray(b.invoiceItems) || !isArray(b.timeEntries)) {
    return { ok: false, error: 'В копии не хватает данных.' };
  }

  return { ok: true, data: json as BackupFile };
}

export function summarize(b: BackupFile): BackupSummary {
  return {
    projects: b.projects.length,
    tasks: b.tasks.length,
    invoices: b.invoices.length,
    exportedAt: b.exportedAt,
  };
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `freel-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}
