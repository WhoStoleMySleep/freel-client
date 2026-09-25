//! Restoring a backup file over everything the app holds.

use std::collections::HashMap;

use serde::Deserialize;

use crate::db;
use crate::error::{Error, Result};

/// A transaction on the app's database. Every insert below runs inside one, so
/// a restore that fails partway leaves the old data exactly as it was.
type Tx<'a> = sqlx::Transaction<'a, sqlx::Sqlite>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupProject {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    archived: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupTask {
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupTimeEntry {
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInvoice {
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInvoiceItem {
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSettings {
    theme_mode: String,
    #[serde(default = "default_language")]
    language: String,
    currency: String,
    default_rate: f64,
    #[serde(default)]
    invoice_seq: i64,
    #[serde(default)]
    compact_task_form: bool,
    #[serde(default)]
    updated_at: String,
}

/// Backups written before the interface had a language setting carry none.
fn default_language() -> String {
    "system".to_string()
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPayload {
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
pub async fn restore_backup(app: tauri::AppHandle, payload: BackupPayload) -> Result<()> {
    let pool = db::pool(&app).await?;
    apply(&pool, &payload).await
}

/// The database half of [`restore_backup`], split out so it can be tested
/// without a running Tauri app.
pub async fn apply(pool: &sqlx::SqlitePool, payload: &BackupPayload) -> Result<()> {
    let mut tx = pool.begin().await?;

    clear(&mut tx).await?;
    insert_projects(&mut tx, &payload.projects).await?;
    insert_tasks(&mut tx, &payload.tasks).await?;
    insert_time_entries(&mut tx, &payload.time_entries).await?;
    insert_invoices(&mut tx, &payload.invoices).await?;
    insert_invoice_items(&mut tx, &payload.invoice_items, &payload.invoices).await?;
    write_settings(&mut tx, &payload.settings).await?;

    tx.commit().await?;
    Ok(())
}

/// Children first so foreign keys stay satisfied at every step.
async fn clear(tx: &mut Tx<'_>) -> Result<()> {
    for table in [
        "invoice_items",
        "invoices",
        "time_entries",
        "tasks",
        "projects",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

async fn insert_projects(tx: &mut Tx<'_>, rows: &[BackupProject]) -> Result<()> {
    for p in rows {
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
        .execute(&mut **tx)
        .await
        .map_err(Error::row(format!("проект «{}»", p.name)))?;
    }
    Ok(())
}

async fn insert_tasks(tx: &mut Tx<'_>, rows: &[BackupTask]) -> Result<()> {
    for t in rows {
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
        .execute(&mut **tx)
        .await
        .map_err(Error::row(format!("задача «{}»", t.title)))?;
    }
    Ok(())
}

async fn insert_time_entries(tx: &mut Tx<'_>, rows: &[BackupTimeEntry]) -> Result<()> {
    for e in rows {
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
        .execute(&mut **tx)
        .await
        .map_err(Error::row("запись времени"))?;
    }
    Ok(())
}

async fn insert_invoices(tx: &mut Tx<'_>, rows: &[BackupInvoice]) -> Result<()> {
    for v in rows {
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
        .execute(&mut **tx)
        .await
        .map_err(Error::row(format!("счёт {}", v.number)))?;
    }
    Ok(())
}

/// The date each invoice carries, for items that have none of their own.
fn invoice_days(invoices: &[BackupInvoice]) -> HashMap<&str, &str> {
    invoices
        .iter()
        .map(|v| (v.id.as_str(), v.day_key.as_str()))
        .collect()
}

/// An item with no timestamp of its own inherits its invoice's date, which is
/// what the schema migration does for rows already in the database.
async fn insert_invoice_items(
    tx: &mut Tx<'_>,
    rows: &[BackupInvoiceItem],
    invoices: &[BackupInvoice],
) -> Result<()> {
    let days = invoice_days(invoices);

    for i in rows {
        let day = days
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
        .execute(&mut **tx)
        .await
        .map_err(Error::row(format!("строка счёта «{}»", i.title)))?;
    }
    Ok(())
}

/// Settings belong to the same transaction, and a running timer is never part
/// of a backup — clear any leftover one.
async fn write_settings(tx: &mut Tx<'_>, s: &BackupSettings) -> Result<()> {
    sqlx::query(
        "UPDATE settings SET theme_mode = ?, language = ?, currency = ?, default_rate = ?, has_onboarded = 1,
                             invoice_seq = ?, compact_task_form = ?, updated_at = ?,
                             active_timer_task_id = NULL, active_timer_started_at = NULL,
                             active_timer_accumulated_ms = 0, active_timer_paused = 0
         WHERE id = 1",
    )
    .bind(&s.theme_mode)
    .bind(&s.language)
    .bind(&s.currency)
    .bind(s.default_rate)
    .bind(s.invoice_seq)
    .bind(s.compact_task_form)
    .bind(ts_or_day(&s.updated_at, EPOCH_DAY))
    .execute(&mut **tx)
    .await
    .map_err(Error::row("настройки"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use sqlx::Row;

    use super::*;
    use crate::testdb;

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
        let (pool, path) = testdb::pool().await;
        testdb::seed(&pool).await;

        let payload: BackupPayload = serde_json::from_str(&payload_json("p1")).unwrap();
        apply(&pool, &payload).await.unwrap();

        assert_eq!(testdb::count(&pool, "projects").await, 1);
        assert_eq!(testdb::count(&pool, "tasks").await, 1);
        assert_eq!(testdb::count(&pool, "invoice_items").await, 1);

        let title = sqlx::query("SELECT title FROM tasks")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get::<String, _>("title");
        assert_eq!(title, "Новая задача", "старые данные должны быть вытеснены");

        let row =
            sqlx::query("SELECT currency, invoice_seq, compact_task_form, language FROM settings")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(row.get::<String, _>("currency"), "USD");
        assert_eq!(row.get::<i64, _>("invoice_seq"), 7);
        assert_eq!(row.get::<i64, _>("compact_task_form"), 1);
        assert_eq!(
            row.get::<String, _>("language"),
            "system",
            "копия без языка не должна оставлять пустое значение"
        );

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn restores_the_interface_language() {
        let (pool, path) = testdb::pool().await;
        testdb::seed(&pool).await;

        let json = payload_json("p1").replace(
            r#""themeMode": "dark""#,
            r#""themeMode": "dark", "language": "en""#,
        );
        let payload: BackupPayload = serde_json::from_str(&json).unwrap();
        apply(&pool, &payload).await.unwrap();

        let language = sqlx::query("SELECT language FROM settings")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get::<String, _>("language");
        assert_eq!(language, "en");

        let _ = std::fs::remove_file(path);
    }

    /// The bug this guards against: a restore that fails partway used to delete
    /// the existing rows and never put anything back.
    #[tokio::test]
    async fn failed_restore_leaves_existing_data_untouched() {
        let (pool, path) = testdb::pool().await;
        testdb::seed(&pool).await;

        // The task points at a project the backup never defines.
        let payload: BackupPayload = serde_json::from_str(&payload_json("missing")).unwrap();
        let err = apply(&pool, &payload).await.unwrap_err().to_string();
        assert!(
            err.contains("Новая задача"),
            "ошибка должна называть строку: {err}"
        );

        assert_eq!(testdb::count(&pool, "projects").await, 1);
        assert_eq!(testdb::count(&pool, "tasks").await, 1);
        let title = sqlx::query("SELECT title FROM tasks")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get::<String, _>("title");
        assert_eq!(
            title, "Старая задача",
            "откат должен вернуть исходные данные"
        );

        let _ = std::fs::remove_file(path);
    }
}
