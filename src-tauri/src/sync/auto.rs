//! Syncing without the user pressing anything.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use super::clock::now_ms;

static DIRTY: AtomicBool = AtomicBool::new(false);
static LAST_CHANGE_MS: AtomicU64 = AtomicU64::new(0);
static LAST_SYNC_MS: AtomicU64 = AtomicU64::new(0);

/// Long enough that a burst of edits — say stepping a task through three
/// statuses — results in one exchange rather than three.
const QUIET_MS: u64 = 10_000;
/// Safety net for changes made on the other device while this one sat idle.
const IDLE_MS: u64 = 300_000;
const TICK_MS: u64 = 15_000;
/// Lets the app finish opening its database before the first attempt.
const WARMUP_MS: u64 = 8_000;

/// Records that this device has local edits the server has not seen.
pub fn mark_dirty() {
    DIRTY.store(true, Ordering::Relaxed);
    LAST_CHANGE_MS.store(now_ms(), Ordering::Relaxed);
}

pub fn mark_synced() {
    DIRTY.store(false, Ordering::Relaxed);
    LAST_SYNC_MS.store(now_ms(), Ordering::Relaxed);
}

/// Either the edits have had time to settle, or nothing has been heard from the
/// other device for long enough to go and ask.
fn due() -> bool {
    let now = now_ms();
    let settled = DIRTY.load(Ordering::Relaxed)
        && now.saturating_sub(LAST_CHANGE_MS.load(Ordering::Relaxed)) >= QUIET_MS;
    settled || now.saturating_sub(LAST_SYNC_MS.load(Ordering::Relaxed)) >= IDLE_MS
}

/// Exchanges with the server on its own schedule.
///
/// Failures are swallowed on purpose: being offline is the normal state of a
/// local-first app, and an unreachable server is not something to interrupt the
/// user about. The next tick simply tries again.
pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(WARMUP_MS)).await;
        loop {
            if due() && super::run_sync(&app).await.is_ok() {
                mark_synced();
                // Both windows hold their own copy of the store, so they have
                // to be told to re-read what the merge brought in.
                let _ = app.emit("freel:changed", serde_json::json!({ "from": "sync" }));
            }
            tokio::time::sleep(Duration::from_millis(TICK_MS)).await;
        }
    });
}
