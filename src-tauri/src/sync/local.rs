//! What this device holds, and where the account's own settings live.

use sqlx::{Row, SqlitePool};

use crate::error::{Error, Result};

use super::wire::{Invoice, InvoiceItem, Payload, Project, Settings, SyncStatus, Task, TimeEntry};

/// This device as the server knows it.
#[derive(Debug)]
pub struct Device {
    pub id: String,
    pub code: String,
}

/// An established connection: where to sync and what to sync as.
///
/// Deliberately not `Debug`: the token is a credential, and a type that cannot
/// be formatted cannot end up in a log line by accident.
pub struct Session {
    pub url: String,
    pub token: String,
}

pub async fn device(pool: &SqlitePool) -> Result<Device> {
    let row = sqlx::query("SELECT device_id, device_code FROM settings WHERE id = 1")
        .fetch_one(pool)
        .await?;
    Ok(Device {
        id: row.get("device_id"),
        code: row.get("device_code"),
    })
}

/// The account as the settings screen shows it.
pub async fn status(pool: &SqlitePool) -> Result<SyncStatus> {
    let row = sqlx::query(
        "SELECT sync_url, sync_email, sync_token, last_sync_at FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await?;
    let token: String = row.get("sync_token");
    Ok(SyncStatus {
        url: row.get("sync_url"),
        email: row.get("sync_email"),
        connected: !token.is_empty(),
        last_sync_at: row.get("last_sync_at"),
    })
}

/// Where and as whom to sync, or [`Error::NotConnected`] if no one is signed in.
pub async fn session(pool: &SqlitePool) -> Result<Session> {
    let row = sqlx::query("SELECT sync_url, sync_token FROM settings WHERE id = 1")
        .fetch_one(pool)
        .await?;
    let token: String = row.get("sync_token");
    if token.is_empty() {
        return Err(Error::NotConnected);
    }
    Ok(Session {
        url: row.get("sync_url"),
        token,
    })
}

/// Stores the account and its token, the URL without its trailing slash.
pub async fn save_login(pool: &SqlitePool, url: &str, email: &str, token: &str) -> Result<()> {
    sqlx::query("UPDATE settings SET sync_url = ?, sync_email = ?, sync_token = ? WHERE id = 1")
        .bind(url.trim_end_matches('/'))
        .bind(email)
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}

/// Signing out also drops `last_sync_at`: it describes a connection that no
/// longer exists.
pub async fn clear_session(pool: &SqlitePool) -> Result<()> {
    sqlx::query("UPDATE settings SET sync_token = '', last_sync_at = '' WHERE id = 1")
        .execute(pool)
        .await?;
    Ok(())
}

/// Drops a token the server has stopped accepting, so the UI offers a fresh
/// sign-in instead of retrying forever. A failure here is not worth reporting:
/// the session is already lost.
pub async fn clear_token(pool: &SqlitePool) {
    let _ = sqlx::query("UPDATE settings SET sync_token = '' WHERE id = 1")
        .execute(pool)
        .await;
}

/// Everything this device holds, tombstones included.
pub async fn snapshot(pool: &SqlitePool) -> Result<Payload> {
    Ok(Payload {
        settings: Some(settings(pool).await?),
        projects: projects(pool).await?,
        tasks: tasks(pool).await?,
        time_entries: time_entries(pool).await?,
        invoices: invoices(pool).await?,
        invoice_items: invoice_items(pool).await?,
    })
}

async fn projects(pool: &SqlitePool) -> Result<Vec<Project>> {
    Ok(sqlx::query("SELECT * FROM projects")
        .fetch_all(pool)
        .await?
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
        .collect())
}

async fn tasks(pool: &SqlitePool) -> Result<Vec<Task>> {
    Ok(sqlx::query("SELECT * FROM tasks")
        .fetch_all(pool)
        .await?
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
        .collect())
}

async fn time_entries(pool: &SqlitePool) -> Result<Vec<TimeEntry>> {
    Ok(sqlx::query("SELECT * FROM time_entries")
        .fetch_all(pool)
        .await?
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
        .collect())
}

async fn invoices(pool: &SqlitePool) -> Result<Vec<Invoice>> {
    Ok(sqlx::query("SELECT * FROM invoices")
        .fetch_all(pool)
        .await?
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
        .collect())
}

async fn invoice_items(pool: &SqlitePool) -> Result<Vec<InvoiceItem>> {
    Ok(sqlx::query("SELECT * FROM invoice_items")
        .fetch_all(pool)
        .await?
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
        .collect())
}

async fn settings(pool: &SqlitePool) -> Result<Settings> {
    let r = sqlx::query(
        "SELECT theme_mode, currency, default_rate, compact_task_form, updated_at
           FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await?;
    Ok(Settings {
        theme_mode: r.get("theme_mode"),
        currency: r.get("currency"),
        default_rate: r.get("default_rate"),
        compact_task_form: r.get::<i64, _>("compact_task_form") != 0,
        updated_at: r.get("updated_at"),
    })
}
