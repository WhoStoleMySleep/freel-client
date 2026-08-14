import { invoke } from '@tauri-apps/api/core';
import { nowIso } from '../utils/date';

export type DeleteKind = 'project' | 'task' | 'invoice';

/**
 * Marks a row and everything below it as deleted.
 *
 * Rows are never removed outright: a row that is simply gone cannot be told
 * apart from one another device has not created yet, so a future sync would
 * resurrect it. The cascade runs in a Rust transaction (`soft_delete`) because
 * `tauri-plugin-sql` spreads separate `execute` calls across pooled
 * connections, which would leave the cascade half-applied on failure.
 */
export async function softDelete(kind: DeleteKind, id: string): Promise<void> {
  await invoke('soft_delete', { kind, id, now: nowIso() });
}
