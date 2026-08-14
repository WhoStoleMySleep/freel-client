import { getDb } from '../client';
import { newId } from '../../utils/id';
import { nowIso, todayKey } from '../../utils/date';

/**
 * Records worked minutes as a new row, always.
 *
 * Append-only on purpose: the previous version kept one row per task and day
 * and did `minutes = minutes + ?`. A counter cannot be merged — two devices
 * logging 30 and 45 minutes for the same task on the same day would end up with
 * whichever value was written last, silently discarding the other's work.
 * Separate rows with their own ids merge as a plain union.
 */
export async function addMinutesForDay(taskId: string, dayKey: string, minutes: number): Promise<void> {
  if (minutes <= 0) return;
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    `INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [newId(), taskId, dayKey, minutes, now, now]
  );
  await recomputeTaskMinutes(taskId);
}

/**
 * Refreshes the task's cached total from its entries.
 *
 * `tasks.minutes` is a local convenience cache, not a source of truth, so it is
 * deliberately recomputed rather than incremented — and `updated_at` is left
 * alone, because a derived value must not make the task look edited to sync.
 */
export async function recomputeTaskMinutes(taskId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET minutes = (
       SELECT COALESCE(SUM(minutes), 0) FROM time_entries
        WHERE task_id = $1 AND deleted_at IS NULL
     ) WHERE id = $2`,
    [taskId, taskId]
  );
}

export async function addMinutesToday(taskId: string, minutes: number): Promise<void> {
  return addMinutesForDay(taskId, todayKey(), minutes);
}

export async function sumMinutesForDay(dayKey: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ total: number | null }[]>(
    'SELECT SUM(minutes) as total FROM time_entries WHERE day_key = $1 AND deleted_at IS NULL',
    [dayKey]
  );
  return rows[0]?.total ?? 0;
}
