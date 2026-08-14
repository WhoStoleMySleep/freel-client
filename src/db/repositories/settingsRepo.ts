import { getDb } from '../client';
import { ActiveTimer, Settings, ThemeMode } from '../../domain/types';
import { Currency } from '../../domain/currency';
import { nowIso } from '../../utils/date';
import { newId } from '../../utils/id';

interface SettingsRow {
  updated_at: string;
  device_id: string;
  device_code: string;
  theme_mode: ThemeMode;
  currency: Currency;
  default_rate: number;
  has_onboarded: number;
  invoice_seq: number;
  compact_task_form: number;
  active_timer_task_id: string | null;
  active_timer_started_at: string | null;
  active_timer_accumulated_ms: number;
  active_timer_paused: number;
}

function mapSettings(row: SettingsRow): Settings {
  return {
    themeMode: row.theme_mode,
    currency: row.currency,
    defaultRate: row.default_rate,
    hasOnboarded: !!row.has_onboarded,
    invoiceSeq: row.invoice_seq,
    compactTaskForm: !!row.compact_task_form,
    updatedAt: row.updated_at,
    deviceCode: row.device_code,
  };
}

/**
 * Gives this installation an identity on first run.
 *
 * The code becomes the prefix of every invoice number, which is what keeps two
 * devices working offline from minting the same one — the sequence itself stays
 * per-device. It is a plain letter so it reads sensibly on a document a client
 * will see, and it can be changed in settings.
 */
export async function ensureDevice(): Promise<{ id: string; code: string }> {
  const db = await getDb();
  const rows = await db.select<{ device_id: string; device_code: string }[]>(
    'SELECT device_id, device_code FROM settings WHERE id = 1'
  );
  const existing = rows[0];
  if (existing?.device_id) return { id: existing.device_id, code: existing.device_code };

  const id = newId();
  const code = /android|iphone|ipad/i.test(navigator.userAgent) ? 'M' : 'P';
  await db.execute('UPDATE settings SET device_id = $1, device_code = $2 WHERE id = 1', [id, code]);
  return { id, code };
}

export async function setDeviceCode(code: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE settings SET device_code = $1, updated_at = $2 WHERE id = 1', [code, nowIso()]);
}

function mapActiveTimer(row: SettingsRow): ActiveTimer | null {
  if (!row.active_timer_task_id || !row.active_timer_started_at) return null;
  return {
    taskId: row.active_timer_task_id,
    startedAt: row.active_timer_started_at,
    accumulatedMs: row.active_timer_accumulated_ms ?? 0,
    paused: !!row.active_timer_paused,
  };
}

export async function loadSettings(): Promise<{ settings: Settings; activeTimer: ActiveTimer | null }> {
  const db = await getDb();
  const rows = await db.select<SettingsRow[]>('SELECT * FROM settings WHERE id = 1');
  const row = rows[0];
  if (!row) throw new Error('settings row missing');
  return { settings: mapSettings(row), activeTimer: mapActiveTimer(row) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: (string | number)[] = [];
  const push = (column: string, value: string | number) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.themeMode !== undefined) push('theme_mode', patch.themeMode);
  if (patch.currency !== undefined) push('currency', patch.currency);
  if (patch.defaultRate !== undefined) push('default_rate', patch.defaultRate);
  if (patch.hasOnboarded !== undefined) push('has_onboarded', patch.hasOnboarded ? 1 : 0);
  if (patch.invoiceSeq !== undefined) push('invoice_seq', patch.invoiceSeq);
  if (patch.compactTaskForm !== undefined) push('compact_task_form', patch.compactTaskForm ? 1 : 0);
  if (!sets.length) return;
  push('updated_at', nowIso());

  await db.execute(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`, params);
}

/**
 * Deliberately leaves `updated_at` alone: the running timer is device-local and
 * must never take part in sync, or starting a timer on one device would stop it
 * on another.
 */
export async function setActiveTimer(timer: ActiveTimer | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE settings SET active_timer_task_id = $1, active_timer_started_at = $2,
     active_timer_accumulated_ms = $3, active_timer_paused = $4 WHERE id = 1`,
    [timer?.taskId ?? null, timer?.startedAt ?? null, timer?.accumulatedMs ?? 0, timer?.paused ? 1 : 0]
  );
}

export async function nextInvoiceNumber(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ invoice_seq: number; device_code: string }[]>(
    'SELECT invoice_seq, device_code FROM settings WHERE id = 1'
  );
  const next = (rows[0]?.invoice_seq ?? 0) + 1;
  await db.execute('UPDATE settings SET invoice_seq = $1, updated_at = $2 WHERE id = 1', [next, nowIso()]);
  const code = rows[0]?.device_code || (await ensureDevice()).code;
  return `#${code}-${String(next).padStart(5, '0')}`;
}
