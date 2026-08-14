mod sync;

use serde::Deserialize;
use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};

pub(crate) const DB_KEY: &str = "sqlite:freel.db";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupProject {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    archived: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupTask {
    id: String,
    project_id: String,
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    link: String,
    rate_type: String,
    rate: f64,
    minutes: f64,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupTimeEntry {
    id: String,
    task_id: String,
    day_key: String,
    minutes: f64,
    /// Absent in format v1 backups; filled from `day_key` on the way in, the
    /// same rule the schema migration uses.
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupInvoice {
    id: String,
    number: String,
    #[serde(default)]
    project_name: String,
    day_key: String,
    status: String,
    #[serde(default)]
    factual: Option<f64>,
    total: f64,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupInvoiceItem {
    id: String,
    invoice_id: String,
    title: String,
    #[serde(default)]
    project_name: String,
    minutes: f64,
    amount: f64,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupSettings {
    theme_mode: String,
    currency: String,
    default_rate: f64,
    #[serde(default)]
    invoice_seq: i64,
    #[serde(default)]
    compact_task_form: bool,
    #[serde(default)]
    updated_at: String,
}

/// Format v1 backups carry no timestamps on these tables. Derive one from the
/// row's own date rather than the clock, so importing the same file on two
/// devices yields identical values and the first sync sees no false conflicts.
fn ts_or_day(ts: &str, day_key: &str) -> String {
    if ts.is_empty() {
        format!("{day_key}T00:00:00.000Z")
    } else {
        ts.to_string()
    }
}

/// A day key, not a full timestamp — `ts_or_day` appends the time itself.
const EPOCH_DAY: &str = "1970-01-01";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupPayload {
    settings: BackupSettings,
    projects: Vec<BackupProject>,
    tasks: Vec<BackupTask>,
    time_entries: Vec<BackupTimeEntry>,
    invoices: Vec<BackupInvoice>,
    invoice_items: Vec<BackupInvoiceItem>,
}

/// Replaces every stored row with the backup's contents, atomically.
///
/// This cannot be done from JavaScript: `tauri-plugin-sql` runs each `execute`
/// on an arbitrary connection taken from a pool, so `BEGIN`, the inserts and
/// `COMMIT` land on different connections and never form one transaction. A
/// restore that fails halfway would then wipe the very data it exists to
/// protect. Here the whole thing runs on a single pooled connection.
#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, payload: BackupPayload) -> Result<(), String> {
    let pool = app_pool(&app).await?;
    apply_backup(&pool, &payload).await
}

/// Hands back the pool the SQL plugin opened for our database.
pub(crate) async fn app_pool(app: &tauri::AppHandle) -> Result<sqlx::SqlitePool, String> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;
    match map.get(DB_KEY) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("База данных не загружена".into()),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum DeleteKind {
    Project,
    Task,
    Invoice,
}

/// Marks a row, and everything hanging off it, as deleted.
///
/// Tombstones rather than `DELETE`, because a row that is simply gone cannot be
/// told apart from one another device has not created yet — sync would
/// resurrect it. The cascade is several statements, so it needs a transaction
/// for the same reason `restore_backup` does.
///
/// `now` comes from the caller so every timestamp in the app is produced by the
/// same clock and formatter.
#[tauri::command]
async fn soft_delete(
    app: tauri::AppHandle,
    kind: DeleteKind,
    id: String,
    now: String,
) -> Result<(), String> {
    let pool = app_pool(&app).await?;
    apply_soft_delete(&pool, kind, &id, &now).await
}

/// The database half of [`soft_delete`], testable without a running app.
async fn apply_soft_delete(
    pool: &sqlx::SqlitePool,
    kind: DeleteKind,
    id: &str,
    now: &str,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // Children first, so a row is never left pointing at a deleted parent.
    let statements: Vec<&str> = match kind {
        DeleteKind::Project => vec![
            "UPDATE time_entries SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL
                AND task_id IN (SELECT id FROM tasks WHERE project_id = ?2)",
            "UPDATE tasks SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL AND project_id = ?2",
            "UPDATE projects SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL AND id = ?2",
        ],
        DeleteKind::Task => vec![
            "UPDATE time_entries SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL AND task_id = ?2",
            "UPDATE tasks SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL AND id = ?2",
        ],
        DeleteKind::Invoice => vec![
            "UPDATE invoice_items SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL AND invoice_id = ?2",
            "UPDATE invoices SET deleted_at = ?1, updated_at = ?1
              WHERE deleted_at IS NULL AND id = ?2",
        ],
    };

    for sql in statements {
        sqlx::query(sql)
            .bind(now)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// The database half of [`restore_backup`], split out so it can be tested
/// without a running Tauri app.
async fn apply_backup(pool: &sqlx::SqlitePool, payload: &BackupPayload) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // Children first so foreign keys stay satisfied at every step.
    for table in [
        "invoice_items",
        "invoices",
        "time_entries",
        "tasks",
        "projects",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    for p in &payload.projects {
        sqlx::query(
            "INSERT INTO projects (id, name, description, archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.id)
        .bind(&p.name)
        .bind(&p.description)
        .bind(p.archived)
        .bind(&p.created_at)
        .bind(&p.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("проект «{}»: {e}", p.name))?;
    }

    for t in &payload.tasks {
        sqlx::query(
            "INSERT INTO tasks (id, project_id, title, description, link, rate_type, rate,
                                minutes, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&t.id)
        .bind(&t.project_id)
        .bind(&t.title)
        .bind(&t.description)
        .bind(&t.link)
        .bind(&t.rate_type)
        .bind(t.rate)
        .bind(t.minutes)
        .bind(&t.status)
        .bind(&t.created_at)
        .bind(&t.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("задача «{}»: {e}", t.title))?;
    }

    for e in &payload.time_entries {
        sqlx::query(
            "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&e.id)
        .bind(&e.task_id)
        .bind(&e.day_key)
        .bind(e.minutes)
        .bind(ts_or_day(&e.created_at, &e.day_key))
        .bind(ts_or_day(&e.updated_at, &e.day_key))
        .execute(&mut *tx)
        .await
        .map_err(|err| format!("запись времени: {err}"))?;
    }

    for v in &payload.invoices {
        sqlx::query(
            "INSERT INTO invoices (id, number, project_name, day_key, status, factual, total,
                                   created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&v.id)
        .bind(&v.number)
        .bind(&v.project_name)
        .bind(&v.day_key)
        .bind(&v.status)
        .bind(v.factual)
        .bind(v.total)
        .bind(ts_or_day(&v.created_at, &v.day_key))
        .bind(ts_or_day(&v.updated_at, &v.day_key))
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("счёт {}: {e}", v.number))?;
    }

    // An item with no timestamp of its own inherits its invoice's date, which
    // is what the schema migration does for rows already in the database.
    let invoice_days: std::collections::HashMap<&str, &str> = payload
        .invoices
        .iter()
        .map(|v| (v.id.as_str(), v.day_key.as_str()))
        .collect();

    for i in &payload.invoice_items {
        let day = invoice_days
            .get(i.invoice_id.as_str())
            .copied()
            .unwrap_or(EPOCH_DAY);
        sqlx::query(
            "INSERT INTO invoice_items (id, invoice_id, title, project_name, minutes, amount,
                                        created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&i.id)
        .bind(&i.invoice_id)
        .bind(&i.title)
        .bind(&i.project_name)
        .bind(i.minutes)
        .bind(i.amount)
        .bind(ts_or_day(&i.created_at, day))
        .bind(ts_or_day(&i.updated_at, day))
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("строка счёта «{}»: {e}", i.title))?;
    }

    // Settings belong to the same transaction, and a running timer is never
    // part of a backup — clear any leftover one.
    let s = &payload.settings;
    sqlx::query(
        "UPDATE settings SET theme_mode = ?, currency = ?, default_rate = ?, has_onboarded = 1,
                             invoice_seq = ?, compact_task_form = ?, updated_at = ?,
                             active_timer_task_id = NULL, active_timer_started_at = NULL,
                             active_timer_accumulated_ms = 0, active_timer_paused = 0
         WHERE id = 1",
    )
    .bind(&s.theme_mode)
    .bind(&s.currency)
    .bind(s.default_rate)
    .bind(s.invoice_seq)
    .bind(s.compact_task_form)
    .bind(ts_or_day(&s.updated_at, EPOCH_DAY))
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("настройки: {e}"))?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Schema mirrors the React Native build so data shapes stay identical.
pub(crate) fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: r#"
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    theme_mode TEXT NOT NULL DEFAULT 'system',
                    currency TEXT NOT NULL DEFAULT 'RUB',
                    default_rate REAL NOT NULL DEFAULT 2500,
                    has_onboarded INTEGER NOT NULL DEFAULT 0,
                    invoice_seq INTEGER NOT NULL DEFAULT 0,
                    compact_task_form INTEGER NOT NULL DEFAULT 0,
                    active_timer_task_id TEXT,
                    active_timer_started_at TEXT,
                    active_timer_accumulated_ms INTEGER NOT NULL DEFAULT 0,
                    active_timer_paused INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    archived INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    link TEXT NOT NULL DEFAULT '',
                    rate_type TEXT NOT NULL,
                    rate REAL NOT NULL DEFAULT 0,
                    minutes REAL NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS time_entries (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    day_key TEXT NOT NULL,
                    minutes REAL NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_time_entries_day ON time_entries(day_key);
                CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);

                CREATE TABLE IF NOT EXISTS invoices (
                    id TEXT PRIMARY KEY,
                    number TEXT NOT NULL,
                    project_name TEXT NOT NULL,
                    day_key TEXT NOT NULL,
                    status TEXT NOT NULL,
                    factual REAL,
                    total REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS invoice_items (
                    id TEXT PRIMARY KEY,
                    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    project_name TEXT NOT NULL DEFAULT '',
                    minutes REAL NOT NULL,
                    amount REAL NOT NULL
                );

                INSERT OR IGNORE INTO settings (id) VALUES (1);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "sync metadata: timestamps on every table, soft deletes",
            sql: r#"
                ALTER TABLE projects ADD COLUMN deleted_at TEXT;
                ALTER TABLE tasks ADD COLUMN deleted_at TEXT;

                ALTER TABLE time_entries ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
                ALTER TABLE time_entries ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
                ALTER TABLE time_entries ADD COLUMN deleted_at TEXT;

                ALTER TABLE invoices ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
                ALTER TABLE invoices ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
                ALTER TABLE invoices ADD COLUMN deleted_at TEXT;

                ALTER TABLE invoice_items ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
                ALTER TABLE invoice_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
                ALTER TABLE invoice_items ADD COLUMN deleted_at TEXT;

                ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

                -- Backfill from data already in the row rather than from the
                -- clock: two devices migrating the same dataset must land on
                -- identical timestamps, or the first sync sees every row as a
                -- conflict and picks a winner at random.
                UPDATE time_entries
                   SET created_at = day_key || 'T00:00:00.000Z',
                       updated_at = day_key || 'T00:00:00.000Z'
                 WHERE created_at = '';

                UPDATE invoices
                   SET created_at = day_key || 'T00:00:00.000Z',
                       updated_at = day_key || 'T00:00:00.000Z'
                 WHERE created_at = '';

                UPDATE invoice_items
                   SET created_at = COALESCE(
                           (SELECT i.day_key FROM invoices i WHERE i.id = invoice_id),
                           '1970-01-01') || 'T00:00:00.000Z',
                       updated_at = COALESCE(
                           (SELECT i.day_key FROM invoices i WHERE i.id = invoice_id),
                           '1970-01-01') || 'T00:00:00.000Z'
                 WHERE created_at = '';

                UPDATE settings SET updated_at = '1970-01-01T00:00:00.000Z'
                 WHERE updated_at = '';

                CREATE INDEX IF NOT EXISTS idx_projects_live ON projects(deleted_at);
                CREATE INDEX IF NOT EXISTS idx_tasks_live ON tasks(deleted_at);
                CREATE INDEX IF NOT EXISTS idx_time_entries_live ON time_entries(deleted_at);
                CREATE INDEX IF NOT EXISTS idx_invoices_live ON invoices(deleted_at);
                CREATE INDEX IF NOT EXISTS idx_invoice_items_live ON invoice_items(deleted_at);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "device identity for offline-safe invoice numbers",
            sql: r#"
                -- Identifies this installation. Invoice numbers carry the code
                -- as a prefix so two devices working offline can never mint the
                -- same number; `invoice_seq` stays per-device.
                ALTER TABLE settings ADD COLUMN device_id TEXT NOT NULL DEFAULT '';
                ALTER TABLE settings ADD COLUMN device_code TEXT NOT NULL DEFAULT '';

                -- Time entries become append-only, so a task accumulates many
                -- rows per day instead of one that is edited in place.
                CREATE INDEX IF NOT EXISTS idx_time_entries_task_day
                    ON time_entries(task_id, day_key);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "sync account credentials",
            sql: r#"
                -- Deliberately outside the Settings type the app exports, so a
                -- backup file never carries the account token.
                ALTER TABLE settings ADD COLUMN sync_url TEXT NOT NULL DEFAULT '';
                ALTER TABLE settings ADD COLUMN sync_email TEXT NOT NULL DEFAULT '';
                ALTER TABLE settings ADD COLUMN sync_token TEXT NOT NULL DEFAULT '';
                ALTER TABLE settings ADD COLUMN last_sync_at TEXT NOT NULL DEFAULT '';
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

/// Width of the slide-out panel, in logical pixels.
#[cfg(desktop)]
const PANEL_WIDTH: f64 = 360.0;
/// How close to the screen edge the pointer must be to arm the panel.
#[cfg(desktop)]
const EDGE_ZONE: f64 = 2.0;
/// Polls before the panel opens — keeps a passing cursor from triggering it.
#[cfg(desktop)]
const DWELL_TICKS: u8 = 4;

/// Set while the panel holds text the user is in the middle of typing.
/// Auto-hide is suspended then, or moving the mouse would discard the input.
#[cfg(desktop)]
static PANEL_LOCKED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Brings the panel forward and gives it the keyboard.
///
/// Focus is taken deliberately: without it the first click only activates the
/// window and a second is needed to actually press anything. `app.show()` comes
/// first because hiding the app on the way out leaves its windows unshowable
/// until the app itself is visible again.
#[cfg(desktop)]
fn reveal_panel(app: &tauri::AppHandle, panel: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    let _ = app.show();
    let _ = panel.show();
    let _ = panel.set_focus();
    let _ = app;
}

/// Hides the panel and hands the keyboard back to whatever the user was in.
///
/// On macOS `app.hide()` is what restores the previous application — there is
/// no need to remember which one it was. It is skipped when the main window is
/// on screen, since hiding the app would take that down too.
#[cfg(desktop)]
fn conceal_panel(app: &tauri::AppHandle, panel: &tauri::WebviewWindow) {
    let _ = panel.hide();
    #[cfg(target_os = "macos")]
    {
        let main_visible = app
            .get_webview_window("main")
            .and_then(|w| w.is_visible().ok())
            .unwrap_or(false);
        if !main_visible {
            let _ = app.hide();
        }
    }
    let _ = app;
}

/// Creates the edge panel up front, hidden. Building it lazily on first hover
/// would show a blank window while the webview boots.
#[cfg(desktop)]
fn build_panel(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let (screen_h, _) = screen_metrics(app);
    let height = (screen_h * 0.8).max(420.0);

    WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("index.html".into()))
        .title("freel")
        .inner_size(PANEL_WIDTH, height)
        .position(0.0, (screen_h - height) / 2.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()?;
    Ok(())
}

/// Logical height of the primary screen and its scale factor.
#[cfg(desktop)]
fn screen_metrics(app: &tauri::AppHandle) -> (f64, f64) {
    match app.primary_monitor() {
        Ok(Some(m)) => {
            let scale = m.scale_factor();
            (m.size().height as f64 / scale, scale)
        }
        _ => (900.0, 1.0),
    }
}

/// Watches the pointer and opens the panel when it rests against the left edge.
///
/// Tauri reports the cursor in physical pixels, so everything is converted to
/// logical units before being compared with the panel's own geometry.
#[cfg(desktop)]
fn watch_screen_edge(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        // Every tick asks the windowing system for the cursor, so the loop runs
        // at full rate only where it matters: against the edge, or while the
        // panel is open and might need to close. Further out the pointer has
        // ground to cover before either can happen.
        const NEAR_POLL_MS: u64 = 60;
        const FAR_POLL_MS: u64 = 150;
        const NEAR_ZONE: f64 = 200.0;
        /// Unchanged from the original tick-counted dwell: 4 × 60 ms.
        const DWELL_MS: u64 = NEAR_POLL_MS * DWELL_TICKS as u64;
        /// The scale factor only changes when the panel's monitor does, while
        /// `primary_monitor()` is a call into the window server every tick.
        const SCALE_TTL_MS: u64 = 2000;

        let mut dwell_ms: u64 = 0;
        let mut poll_ms: u64 = NEAR_POLL_MS;
        let mut scale = 1.0;
        let mut scale_age_ms = SCALE_TTL_MS; // forces a read on the first pass
        loop {
            std::thread::sleep(std::time::Duration::from_millis(poll_ms));
            scale_age_ms = scale_age_ms.saturating_add(poll_ms);

            let Some(panel) = app.get_webview_window("panel") else {
                continue;
            };
            let Ok(pos) = app.cursor_position() else {
                continue;
            };
            if scale_age_ms >= SCALE_TTL_MS {
                scale = screen_metrics(&app).1;
                scale_age_ms = 0;
            }
            let x = pos.x / scale;

            let visible = panel.is_visible().unwrap_or(false);
            if visible {
                // Generous margin so the panel does not vanish while the
                // pointer travels towards a control near its right edge.
                let typing = PANEL_LOCKED.load(std::sync::atomic::Ordering::Relaxed);
                if !typing && x > PANEL_WIDTH + 60.0 {
                    conceal_panel(&app, &panel);
                }
                dwell_ms = 0;
            } else if x <= EDGE_ZONE {
                dwell_ms = dwell_ms.saturating_add(poll_ms);
                if dwell_ms >= DWELL_MS {
                    reveal_panel(&app, &panel);
                    dwell_ms = 0;
                }
            } else {
                dwell_ms = 0;
            }

            poll_ms = if visible || x <= NEAR_ZONE { NEAR_POLL_MS } else { FAR_POLL_MS };
        }
    });
}

#[cfg(desktop)]
fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let open = MenuItem::with_id(app, "open", "Открыть freel", true, None::<&str>)?;
    let show_panel = MenuItem::with_id(app, "panel", "Показать панель", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &show_panel, &quit])?;

    let mut builder = TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(true);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
            "panel" => {
                if let Some(w) = app.get_webview_window("panel") {
                    reveal_panel(app, &w);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            restore_backup,
            soft_delete,
            sync::sync_register,
            sync::sync_login,
            sync::sync_logout,
            sync::sync_now,
            sync::sync_status,
            sync::sync_mark_dirty
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_timer::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:freel.db", migrations())
                .build(),
        )
        .setup(|app| {
            sync::spawn_auto_sync(app.handle().clone());
            #[cfg(desktop)]
            {
                use tauri::Listener;
                let handle = app.handle();
                build_panel(handle)?;
                build_tray(handle)?;
                watch_screen_edge(handle.clone());

                // The panel reports when a text field is focused so auto-hide
                // can stand down while the user types.
                handle.listen("panel:lock", |event| {
                    let locked = event.payload().contains("true");
                    PANEL_LOCKED.store(locked, std::sync::atomic::Ordering::Relaxed);
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window must not end the app: the tray icon and
            // the edge panel are the point of it staying alive.
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::Row;

    /// A pool over a temp file, not `:memory:` — an in-memory SQLite database
    /// is per-connection, so a pool would hand out several empty databases.
    async fn test_pool() -> (sqlx::SqlitePool, std::path::PathBuf) {
        test_pool_upto(usize::MAX).await
    }

    /// `upto` limits how many migrations run, so a test can build a database in
    /// its pre-migration shape and then migrate it for real.
    async fn test_pool_upto(upto: usize) -> (sqlx::SqlitePool, std::path::PathBuf) {
        // A counter, not a timestamp: tests run in parallel and the clock is not
        // fine-grained enough to keep two of them off the same file.
        static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let n = N.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("freel-test-{}-{n}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect(&format!("sqlite:{}?mode=rwc", path.display()))
            .await
            .unwrap();
        for m in migrations().into_iter().take(upto) {
            sqlx::raw_sql(m.sql).execute(&pool).await.unwrap();
        }
        (pool, path)
    }

    async fn seed(pool: &sqlx::SqlitePool) {
        sqlx::query(
            "INSERT INTO projects (id, name, description, archived, created_at, updated_at)
             VALUES ('old-p', 'Старый проект', '', 0, '2026-01-01', '2026-01-01')",
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO tasks (id, project_id, title, description, link, rate_type, rate,
                                minutes, status, created_at, updated_at)
             VALUES ('old-t', 'old-p', 'Старая задача', '', '', 'hourly', 100, 60, 'next',
                     '2026-01-01', '2026-01-01')",
        )
        .execute(pool)
        .await
        .unwrap();
    }

    async fn count(pool: &sqlx::SqlitePool, table: &str) -> i64 {
        sqlx::query(&format!("SELECT COUNT(*) AS c FROM {table}"))
            .fetch_one(pool)
            .await
            .unwrap()
            .get::<i64, _>("c")
    }

    /// Field names here are the camelCase the TypeScript side actually writes,
    /// so this doubles as a check that the serde mapping lines up.
    fn payload_json(task_project: &str) -> String {
        format!(
            r#"{{
              "app": "freel", "formatVersion": 1, "exportedAt": "2026-07-30T00:00:00.000Z",
              "settings": {{ "themeMode": "dark", "currency": "USD", "defaultRate": 4200,
                             "hasOnboarded": true, "invoiceSeq": 7, "compactTaskForm": true }},
              "projects": [{{ "id": "p1", "name": "Новый проект", "description": "описание",
                              "archived": false, "createdAt": "2026-07-01",
                              "updatedAt": "2026-07-02" }}],
              "tasks": [{{ "id": "t1", "projectId": "{task_project}", "title": "Новая задача",
                           "description": "", "link": "", "rateType": "hourly", "rate": 500,
                           "minutes": 90, "status": "in_work", "createdAt": "2026-07-01",
                           "updatedAt": "2026-07-02" }}],
              "timeEntries": [{{ "id": "e1", "taskId": "t1", "dayKey": "2026-07-01",
                                 "minutes": 90 }}],
              "invoices": [{{ "id": "i1", "number": "0007", "projectName": "Новый проект",
                              "dayKey": "2026-07-02", "status": "sent", "factual": null,
                              "total": 750 }}],
              "invoiceItems": [{{ "id": "ii1", "invoiceId": "i1", "title": "Новая задача",
                                  "projectName": "Новый проект", "minutes": 90,
                                  "amount": 750 }}]
            }}"#
        )
    }

    #[tokio::test]
    async fn replaces_everything_and_updates_settings() {
        let (pool, path) = test_pool().await;
        seed(&pool).await;

        let payload: BackupPayload = serde_json::from_str(&payload_json("p1")).unwrap();
        apply_backup(&pool, &payload).await.unwrap();

        assert_eq!(count(&pool, "projects").await, 1);
        assert_eq!(count(&pool, "tasks").await, 1);
        assert_eq!(count(&pool, "invoice_items").await, 1);

        let title = sqlx::query("SELECT title FROM tasks")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get::<String, _>("title");
        assert_eq!(title, "Новая задача", "старые данные должны быть вытеснены");

        let row = sqlx::query("SELECT currency, invoice_seq, compact_task_form FROM settings")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.get::<String, _>("currency"), "USD");
        assert_eq!(row.get::<i64, _>("invoice_seq"), 7);
        assert_eq!(row.get::<i64, _>("compact_task_form"), 1);

        let _ = std::fs::remove_file(path);
    }

    /// The migration has to run over a database that already holds data — that
    /// is the only way it will ever run in the wild.
    #[tokio::test]
    async fn migration_backfills_existing_rows() {
        let (pool, path) = test_pool_upto(1).await;
        seed(&pool).await;
        sqlx::query(
            "INSERT INTO time_entries (id, task_id, day_key, minutes)
             VALUES ('e1', 'old-t', '2026-03-05', 45)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO invoices (id, number, project_name, day_key, status, factual, total)
             VALUES ('v1', '00001', 'Старый проект', '2026-04-10', 'awaiting', NULL, 900)",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO invoice_items (id, invoice_id, title, project_name, minutes, amount)
             VALUES ('ii1', 'v1', 'Строка', 'Старый проект', 60, 900)",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::raw_sql(migrations()[1].sql).execute(&pool).await.unwrap();

        let entry: String = sqlx::query("SELECT updated_at FROM time_entries WHERE id = 'e1'")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("updated_at");
        assert_eq!(entry, "2026-03-05T00:00:00.000Z", "запись времени берёт свой day_key");

        // The item has no date of its own, so it inherits the invoice's.
        let item: String = sqlx::query("SELECT created_at FROM invoice_items WHERE id = 'ii1'")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("created_at");
        assert_eq!(item, "2026-04-10T00:00:00.000Z", "строка счёта наследует дату счёта");

        // Nothing may look deleted just because the column appeared.
        for table in ["projects", "tasks", "time_entries", "invoices", "invoice_items"] {
            let live: i64 = sqlx::query(&format!(
                "SELECT COUNT(*) AS c FROM {table} WHERE deleted_at IS NULL"
            ))
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("c");
            assert_eq!(live, 1, "{table}: миграция не должна ничего прятать");
        }

        let _ = std::fs::remove_file(path);
    }

    /// Deleting a project has to tombstone its tasks and their time entries, or
    /// sync would see live children hanging off a deleted parent.
    #[tokio::test]
    async fn deleting_a_project_tombstones_its_children() {
        let (pool, path) = test_pool().await;
        seed(&pool).await;
        sqlx::query(
            "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at)
             VALUES ('old-e', 'old-t', '2026-01-01', 30, '2026-01-01T00:00:00.000Z',
                     '2026-01-01T00:00:00.000Z')",
        )
        .execute(&pool)
        .await
        .unwrap();

        apply_soft_delete(&pool, DeleteKind::Project, "old-p", "2026-07-30T10:00:00.000Z")
            .await
            .unwrap();

        for table in ["projects", "tasks", "time_entries"] {
            let live: i64 = sqlx::query(&format!(
                "SELECT COUNT(*) AS c FROM {table} WHERE deleted_at IS NULL"
            ))
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("c");
            assert_eq!(live, 0, "в {table} осталась живая строка");

            // The row itself must survive — a tombstone that is gone is no
            // tombstone, and the deletion would never reach another device.
            assert_eq!(count(&pool, table).await, 1, "строка {table} исчезла физически");
        }

        let ts: String = sqlx::query("SELECT updated_at FROM tasks")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("updated_at");
        assert_eq!(ts, "2026-07-30T10:00:00.000Z", "удаление должно двигать updated_at");

        let _ = std::fs::remove_file(path);
    }

    /// The bug this guards against: a restore that fails partway used to delete
    /// the existing rows and never put anything back.
    #[tokio::test]
    async fn failed_restore_leaves_existing_data_untouched() {
        let (pool, path) = test_pool().await;
        seed(&pool).await;

        // The task points at a project the backup never defines.
        let payload: BackupPayload = serde_json::from_str(&payload_json("missing")).unwrap();
        let err = apply_backup(&pool, &payload).await.unwrap_err();
        assert!(err.contains("Новая задача"), "ошибка должна называть строку: {err}");

        assert_eq!(count(&pool, "projects").await, 1);
        assert_eq!(count(&pool, "tasks").await, 1);
        let title = sqlx::query("SELECT title FROM tasks")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get::<String, _>("title");
        assert_eq!(title, "Старая задача", "откат должен вернуть исходные данные");

        let _ = std::fs::remove_file(path);
    }
}
