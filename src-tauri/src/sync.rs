//! Talking to the sync server.
//!
//! The whole exchange lives in Rust rather than the webview for three reasons:
//! the reply has to be applied in one transaction, a request from `tauri://`
//! would be blocked by CORS, and the account token never has to exist in
//! JavaScript at all.

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::app_pool;

/// Wire rows, matching the server's shapes field for field.
///
/// Tombstones travel too — unlike a backup, which is a snapshot of what the
/// user has, a sync payload must carry deletions or they would never reach the
/// other device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Project {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    archived: bool,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Task {
    id: String,
    project_id: String,
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    link: String,
    rate_type: String,
    rate: f64,
    status: String,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimeEntry {
    id: String,
    task_id: String,
    day_key: String,
    minutes: f64,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Invoice {
    id: String,
    number: String,
    #[serde(default)]
    project_name: String,
    day_key: String,
    status: String,
    #[serde(default)]
    factual: Option<f64>,
    total: f64,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvoiceItem {
    id: String,
    invoice_id: String,
    title: String,
    #[serde(default)]
    project_name: String,
    minutes: f64,
    amount: f64,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

/// Preferences worth carrying between devices. `invoice_seq`, the device code
/// and the running timer stay put: the first two keep invoice numbers unique
/// per device, and a timer belongs to the machine it was started on.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    theme_mode: String,
    currency: String,
    default_rate: f64,
    #[serde(default)]
    compact_task_form: bool,
    updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Payload {
    settings: Option<Settings>,
    projects: Vec<Project>,
    tasks: Vec<Task>,
    time_entries: Vec<TimeEntry>,
    invoices: Vec<Invoice>,
    invoice_items: Vec<InvoiceItem>,
}

#[derive(Debug, Deserialize)]
struct ServerError {
    error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub url: String,
    pub email: String,
    pub connected: bool,
    pub last_sync_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub sent: usize,
    pub received: usize,
    pub last_sync_at: String,
}

/// Trailing slashes would produce `//sync`, which some proxies reject.
fn endpoint(base: &str, path: &str) -> String {
    format!("{}/{}", base.trim_end_matches('/'), path)
}

async fn read_error(res: reqwest::Response) -> String {
    let status = res.status();
    match res.json::<ServerError>().await {
        Ok(e) => e.error,
        Err(_) => format!("сервер ответил {status}"),
    }
}

/// The process-wide HTTP client.
///
/// A `Client` owns its connection pool, so building one per request meant the
/// auto-sync loop paid for a fresh TCP and TLS handshake — and a new idle pool
/// to drop — on every exchange. Cloning shares the pool instead.
fn client() -> Result<reqwest::Client, String> {
    static CLIENT: std::sync::OnceLock<Result<reqwest::Client, String>> = std::sync::OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| format!("не удалось создать HTTP-клиент: {e}"))
        })
        .clone()
}

#[tauri::command]
pub async fn sync_register(url: String, email: String, password: String) -> Result<(), String> {
    let res = client()?
        .post(endpoint(&url, "auth/register"))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("нет связи с сервером: {e}"))?;

    if res.status().is_success() {
        Ok(())
    } else {
        Err(read_error(res).await)
    }
}

#[tauri::command]
pub async fn sync_login(
    app: tauri::AppHandle,
    url: String,
    email: String,
    password: String,
) -> Result<(), String> {
    let pool = app_pool(&app).await?;
    let (device_id, device_code) = device(&pool).await?;

    let res = client()?
        .post(endpoint(&url, "auth/login"))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
            "deviceId": device_id,
            "deviceName": device_code,
        }))
        .send()
        .await
        .map_err(|e| format!("нет связи с сервером: {e}"))?;

    if !res.status().is_success() {
        return Err(read_error(res).await);
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LoginResponse {
        token: String,
    }
    let body: LoginResponse = res
        .json()
        .await
        .map_err(|e| format!("непонятный ответ сервера: {e}"))?;

    sqlx::query("UPDATE settings SET sync_url = ?, sync_email = ?, sync_token = ? WHERE id = 1")
        .bind(url.trim_end_matches('/'))
        .bind(&email)
        .bind(&body.token)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_logout(app: tauri::AppHandle) -> Result<(), String> {
    let pool = app_pool(&app).await?;
    sqlx::query("UPDATE settings SET sync_token = '', last_sync_at = '' WHERE id = 1")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_status(app: tauri::AppHandle) -> Result<SyncStatus, String> {
    let pool = app_pool(&app).await?;
    let row = sqlx::query("SELECT sync_url, sync_email, sync_token, last_sync_at FROM settings WHERE id = 1")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let token: String = row.get("sync_token");
    Ok(SyncStatus {
        url: row.get("sync_url"),
        email: row.get("sync_email"),
        connected: !token.is_empty(),
        last_sync_at: row.get("last_sync_at"),
    })
}

async fn device(pool: &SqlitePool) -> Result<(String, String), String> {
    let row = sqlx::query("SELECT device_id, device_code FROM settings WHERE id = 1")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok((row.get("device_id"), row.get("device_code")))
}

#[tauri::command]
pub async fn sync_now(app: tauri::AppHandle) -> Result<SyncResult, String> {
    let res = run_sync(&app).await;
    if res.is_ok() {
        mark_synced();
    }
    res
}

/// Records that this device has local edits the server has not seen.
///
/// Called from every mutating action, so the background loop can push soon
/// after a change instead of waiting out the full interval.
#[tauri::command]
pub fn sync_mark_dirty() {
    DIRTY.store(true, Ordering::Relaxed);
    LAST_CHANGE_MS.store(now_ms(), Ordering::Relaxed);
}

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

static DIRTY: AtomicBool = AtomicBool::new(false);
static LAST_CHANGE_MS: AtomicU64 = AtomicU64::new(0);
static LAST_SYNC_MS: AtomicU64 = AtomicU64::new(0);

/// Long enough that a burst of edits — say stepping a task through three
/// statuses — results in one exchange rather than three.
const QUIET_MS: u64 = 10_000;
/// Safety net for changes made on the other device while this one sat idle.
const IDLE_MS: u64 = 300_000;
const TICK_MS: u64 = 15_000;

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn mark_synced() {
    DIRTY.store(false, Ordering::Relaxed);
    LAST_SYNC_MS.store(now_ms(), Ordering::Relaxed);
}

/// Exchanges with the server on its own, without the user pressing anything.
///
/// Failures are swallowed on purpose: being offline is the normal state of a
/// local-first app, and an unreachable server is not something to interrupt the
/// user about. The next tick simply tries again.
pub fn spawn_auto_sync(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Let the app finish opening its database before the first attempt.
        tokio::time::sleep(std::time::Duration::from_secs(8)).await;
        loop {
            let now = now_ms();
            let due = (DIRTY.load(Ordering::Relaxed)
                && now.saturating_sub(LAST_CHANGE_MS.load(Ordering::Relaxed)) >= QUIET_MS)
                || now.saturating_sub(LAST_SYNC_MS.load(Ordering::Relaxed)) >= IDLE_MS;

            if due && run_sync(&app).await.is_ok() {
                mark_synced();
                // Both windows hold their own copy of the store, so they have
                // to be told to re-read what the merge brought in.
                use tauri::Emitter;
                let _ = app.emit("freel:changed", serde_json::json!({ "from": "sync" }));
            }
            tokio::time::sleep(std::time::Duration::from_millis(TICK_MS)).await;
        }
    });
}

async fn run_sync(app: &tauri::AppHandle) -> Result<SyncResult, String> {
    let pool = app_pool(app).await?;
    let row = sqlx::query("SELECT sync_url, sync_token FROM settings WHERE id = 1")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let url: String = row.get("sync_url");
    let token: String = row.get("sync_token");
    if token.is_empty() {
        return Err("нет подключения к серверу".into());
    }

    let local = snapshot(&pool).await?;
    let sent = local.projects.len()
        + local.tasks.len()
        + local.time_entries.len()
        + local.invoices.len()
        + local.invoice_items.len();

    let res = client()?
        .post(endpoint(&url, "sync"))
        .bearer_auth(&token)
        .json(&local)
        .send()
        .await
        .map_err(|e| format!("нет связи с сервером: {e}"))?;

    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        // The token was revoked or the account is gone; drop it so the UI
        // offers a fresh sign-in instead of retrying forever.
        sqlx::query("UPDATE settings SET sync_token = '' WHERE id = 1")
            .execute(&pool)
            .await
            .ok();
        return Err("сессия недействительна, войдите заново".into());
    }
    if !res.status().is_success() {
        return Err(read_error(res).await);
    }

    let remote: Payload = res
        .json()
        .await
        .map_err(|e| format!("непонятный ответ сервера: {e}"))?;
    let received = remote.projects.len()
        + remote.tasks.len()
        + remote.time_entries.len()
        + remote.invoices.len()
        + remote.invoice_items.len();

    let now = apply(&pool, &remote).await?;
    Ok(SyncResult { sent, received, last_sync_at: now })
}

/// Everything this device holds, tombstones included.
async fn snapshot(pool: &SqlitePool) -> Result<Payload, String> {
    let e = |x: sqlx::Error| x.to_string();

    let projects = sqlx::query("SELECT * FROM projects")
        .fetch_all(pool)
        .await
        .map_err(e)?
        .into_iter()
        .map(|r| Project {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            archived: r.get::<i64, _>("archived") != 0,
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();

    let tasks = sqlx::query("SELECT * FROM tasks")
        .fetch_all(pool)
        .await
        .map_err(e)?
        .into_iter()
        .map(|r| Task {
            id: r.get("id"),
            project_id: r.get("project_id"),
            title: r.get("title"),
            description: r.get("description"),
            link: r.get("link"),
            rate_type: r.get("rate_type"),
            rate: r.get("rate"),
            status: r.get("status"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();

    let time_entries = sqlx::query("SELECT * FROM time_entries")
        .fetch_all(pool)
        .await
        .map_err(e)?
        .into_iter()
        .map(|r| TimeEntry {
            id: r.get("id"),
            task_id: r.get("task_id"),
            day_key: r.get("day_key"),
            minutes: r.get("minutes"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();

    let invoices = sqlx::query("SELECT * FROM invoices")
        .fetch_all(pool)
        .await
        .map_err(e)?
        .into_iter()
        .map(|r| Invoice {
            id: r.get("id"),
            number: r.get("number"),
            project_name: r.get("project_name"),
            day_key: r.get("day_key"),
            status: r.get("status"),
            factual: r.get("factual"),
            total: r.get("total"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();

    let invoice_items = sqlx::query("SELECT * FROM invoice_items")
        .fetch_all(pool)
        .await
        .map_err(e)?
        .into_iter()
        .map(|r| InvoiceItem {
            id: r.get("id"),
            invoice_id: r.get("invoice_id"),
            title: r.get("title"),
            project_name: r.get("project_name"),
            minutes: r.get("minutes"),
            amount: r.get("amount"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            deleted_at: r.get("deleted_at"),
        })
        .collect();

    let r = sqlx::query(
        "SELECT theme_mode, currency, default_rate, compact_task_form, updated_at
           FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(e)?;
    let settings = Some(Settings {
        theme_mode: r.get("theme_mode"),
        currency: r.get("currency"),
        default_rate: r.get("default_rate"),
        compact_task_form: r.get::<i64, _>("compact_task_form") != 0,
        updated_at: r.get("updated_at"),
    });

    Ok(Payload { settings, projects, tasks, time_entries, invoices, invoice_items })
}

macro_rules! upsert {
    ($tx:expr, $rows:expr, $sql:literal, $r:ident => [$($bind:expr),* $(,)?]) => {
        for $r in $rows {
            sqlx::query($sql)
                $(.bind($bind))*
                .execute(&mut **$tx)
                .await
                .map_err(|e| e.to_string())?;
        }
    };
}

/// Writes the server's answer into the local database.
///
/// The same last-writer-wins guard as the server: a reply that took a while to
/// arrive must not undo an edit made locally in the meantime.
async fn apply(pool: &SqlitePool, p: &Payload) -> Result<String, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    upsert!(&mut tx, &p.projects,
        "INSERT INTO projects (id, name, description, archived, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, description = excluded.description,
           archived = excluded.archived, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > projects.updated_at",
        r => [&r.id, &r.name, &r.description, r.archived, &r.created_at, &r.updated_at, &r.deleted_at]);

    // `minutes` is missing from the wire shape on purpose: it is a local cache
    // recomputed from the entries below, not something to merge.
    upsert!(&mut tx, &p.tasks,
        "INSERT INTO tasks (id, project_id, title, description, link, rate_type, rate, minutes,
                            status, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10, ?11)
         ON CONFLICT (id) DO UPDATE SET
           project_id = excluded.project_id, title = excluded.title,
           description = excluded.description, link = excluded.link,
           rate_type = excluded.rate_type, rate = excluded.rate,
           status = excluded.status, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > tasks.updated_at",
        r => [&r.id, &r.project_id, &r.title, &r.description, &r.link, &r.rate_type,
              r.rate, &r.status, &r.created_at, &r.updated_at, &r.deleted_at]);

    upsert!(&mut tx, &p.time_entries,
        "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
           minutes = excluded.minutes, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > time_entries.updated_at",
        r => [&r.id, &r.task_id, &r.day_key, r.minutes, &r.created_at, &r.updated_at, &r.deleted_at]);

    upsert!(&mut tx, &p.invoices,
        "INSERT INTO invoices (id, number, project_name, day_key, status, factual, total,
                               created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT (id) DO UPDATE SET
           number = excluded.number, project_name = excluded.project_name,
           day_key = excluded.day_key, status = excluded.status,
           factual = excluded.factual, total = excluded.total,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > invoices.updated_at",
        r => [&r.id, &r.number, &r.project_name, &r.day_key, &r.status, r.factual, r.total,
              &r.created_at, &r.updated_at, &r.deleted_at]);

    upsert!(&mut tx, &p.invoice_items,
        "INSERT INTO invoice_items (id, invoice_id, title, project_name, minutes, amount,
                                    created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title, project_name = excluded.project_name,
           minutes = excluded.minutes, amount = excluded.amount,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > invoice_items.updated_at",
        r => [&r.id, &r.invoice_id, &r.title, &r.project_name, r.minutes, r.amount,
              &r.created_at, &r.updated_at, &r.deleted_at]);

    if let Some(st) = &p.settings {
        // Guarded the same way as every row: a reply that took a while to come
        // back must not undo a preference changed here in the meantime.
        sqlx::query(
            "UPDATE settings SET theme_mode = ?1, currency = ?2, default_rate = ?3,
                                 compact_task_form = ?4, updated_at = ?5
              WHERE id = 1 AND ?5 > updated_at",
        )
        .bind(&st.theme_mode)
        .bind(&st.currency)
        .bind(st.default_rate)
        .bind(st.compact_task_form)
        .bind(&st.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Entries arriving from another device change these totals, so the cache is
    // rebuilt for every task in the same transaction.
    sqlx::query(
        "UPDATE tasks SET minutes = (
           SELECT COALESCE(SUM(minutes), 0) FROM time_entries
            WHERE task_id = tasks.id AND deleted_at IS NULL)",
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let now = time_now();
    sqlx::query("UPDATE settings SET last_sync_at = ? WHERE id = 1")
        .bind(&now)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(now)
}

fn time_now() -> String {
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // Milliseconds since the epoch, formatted the same way `Date.toISOString`
    // would — the client compares these strings lexicographically.
    let secs = d.as_secs() as i64;
    let ms = d.subsec_millis();
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (y, mo, da) = civil_from_days(days);
    format!(
        "{y:04}-{mo:02}-{da:02}T{:02}:{:02}:{:02}.{ms:03}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// Howard Hinnant's civil-from-days algorithm; avoids pulling in a date crate
/// for the one timestamp this module needs.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Full round trip against a real server, so a mismatch between the two
    /// crates' field names cannot slip through. Skipped unless
    /// `FREEL_TEST_SERVER` points at a running instance with open registration.
    #[tokio::test]
    async fn round_trip_against_live_server() {
        let Ok(base) = std::env::var("FREEL_TEST_SERVER") else {
            eprintln!("FREEL_TEST_SERVER не задан — тест пропущен");
            return;
        };

        let path = std::env::temp_dir().join(format!("freel-sync-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(2)
            .connect(&format!("sqlite:{}?mode=rwc", path.display()))
            .await
            .unwrap();
        for m in crate::migrations() {
            sqlx::raw_sql(m.sql).execute(&pool).await.unwrap();
        }

        sqlx::query(
            "INSERT INTO projects (id, name, description, archived, created_at, updated_at)
             VALUES ('p1','Клиент','',0,'2026-07-01T00:00:00.000Z','2026-07-01T00:00:00.000Z')",
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO tasks (id, project_id, title, description, link, rate_type, rate, minutes,
                                status, created_at, updated_at)
             VALUES ('t1','p1','Вёрстка','','','hourly',1500,0,'in_work',
                     '2026-07-01T00:00:00.000Z','2026-07-01T00:00:00.000Z')",
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at)
             VALUES ('e1','t1','2026-08-01',90,'2026-08-01T10:00:00.000Z','2026-08-01T10:00:00.000Z')",
        ).execute(&pool).await.unwrap();

        let email = format!("t{}@freel.app", std::process::id());
        let c = client().unwrap();
        c.post(endpoint(&base, "auth/register"))
            .json(&serde_json::json!({ "email": email, "password": "correct-horse" }))
            .send().await.unwrap();
        let token: String = c
            .post(endpoint(&base, "auth/login"))
            .json(&serde_json::json!({
                "email": email, "password": "correct-horse", "deviceId": "test-dev" }))
            .send().await.unwrap()
            .json::<serde_json::Value>().await.unwrap()["token"]
            .as_str().unwrap().to_string();

        let local = snapshot(&pool).await.unwrap();
        assert_eq!(local.time_entries.len(), 1, "снимок должен содержать запись времени");

        let res = c
            .post(endpoint(&base, "sync"))
            .bearer_auth(&token)
            .json(&local)
            .send().await.unwrap();
        assert!(res.status().is_success(), "сервер отверг снимок: {}", res.status());

        let remote: Payload = res.json().await.unwrap();
        assert_eq!(remote.projects.len(), 1, "проект вернулся");
        assert_eq!(remote.tasks.len(), 1, "задача вернулась");
        assert_eq!(remote.time_entries[0].minutes, 90.0, "минуты доехали без потерь");

        apply(&pool, &remote).await.unwrap();

        // The cache must be rebuilt from the entries the merge brought in.
        let minutes: f64 = sqlx::query("SELECT minutes FROM tasks WHERE id = 't1'")
            .fetch_one(&pool).await.unwrap().get("minutes");
        assert_eq!(minutes, 90.0, "tasks.minutes пересчитан после слияния");

        let _ = std::fs::remove_file(path);
    }
}
