import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const CHANGED = 'freel:changed';

const isTauri = () => '__TAURI_INTERNALS__' in window;

/** Label of the window this script is running in ('main' or 'panel'). */
export function windowLabel(): string {
  if (!isTauri()) return 'browser';
  try {
    return getCurrentWindow().label;
  } catch {
    return 'browser';
  }
}

/**
 * Tells the other window that the database changed.
 *
 * Each window runs its own JavaScript context with its own copy of the store,
 * so a write in one leaves the other showing stale numbers. They share a single
 * SQLite pool, so re-reading is enough — no state is sent over the wire.
 */
export async function broadcastChanged(): Promise<void> {
  if (!isTauri()) return;
  // Also tells the auto-sync loop there is something to push, so a local edit
  // reaches the other device in seconds rather than at the next idle sweep.
  invoke('sync_mark_dirty').catch(() => {});
  try {
    await emit(CHANGED, { from: windowLabel() });
  } catch {
    // A missing sibling window is not an error worth surfacing.
  }
}

/**
 * Suspends the panel's hover auto-hide, for as long as a text field is focused.
 * Without it, reaching for the mouse mid-sentence closes the panel.
 */
export async function lockPanel(locked: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    await emit('panel:lock', locked);
  } catch {
    // Nothing to do — the worst case is the panel hiding a moment too early.
  }
}

/** Runs `fn` when the *other* window reports a change. */
export async function onChanged(fn: () => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const self = windowLabel();
  try {
    const un = await listen<{ from?: string }>(CHANGED, (e) => {
      // Tauri delivers an emit back to its sender too; ignore our own echo or
      // every write would trigger a redundant reload.
      if (e.payload?.from !== self) fn();
    });
    return un;
  } catch {
    return () => {};
  }
}
