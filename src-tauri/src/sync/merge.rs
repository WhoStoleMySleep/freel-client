//! Writing the server's answer into the local database.

use sqlx::SqlitePool;

use crate::error::Result;

use super::clock;
use super::wire::{Invoice, InvoiceItem, Payload, Project, Settings, Task, TimeEntry};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Sqlite>;

/// Every table merges the same way, only the columns differ.
macro_rules! upsert {
    ($tx:expr, $rows:expr, $sql:literal, $r:ident => [$($bind:expr),* $(,)?]) => {
        for $r in $rows {
            sqlx::query($sql)
                $(.bind($bind))*
                .execute(&mut **$tx)
                .await?;
        }
    };
}

/// Writes the server's answer into the local database, and reports the moment
/// it was written.
///
/// The same last-writer-wins guard as the server: a reply that took a while to
/// arrive must not undo an edit made locally in the meantime.
pub async fn apply(pool: &SqlitePool, p: &Payload) -> Result<String> {
    let mut tx = pool.begin().await?;

    projects(&mut tx, &p.projects).await?;
    tasks(&mut tx, &p.tasks).await?;
    time_entries(&mut tx, &p.time_entries).await?;
    invoices(&mut tx, &p.invoices).await?;
    invoice_items(&mut tx, &p.invoice_items).await?;
    if let Some(st) = &p.settings {
        settings(&mut tx, st).await?;
    }
    recount_minutes(&mut tx).await?;

    let now = clock::time_now();
    sqlx::query("UPDATE settings SET last_sync_at = ? WHERE id = 1")
        .bind(&now)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(now)
}

async fn projects(tx: &mut Tx<'_>, rows: &[Project]) -> Result<()> {
    upsert!(tx, rows,
        "INSERT INTO projects (id, name, description, archived, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, description = excluded.description,
           archived = excluded.archived, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > projects.updated_at",
        r => [&r.id, &r.name, &r.description, r.archived, &r.created_at, &r.updated_at, &r.deleted_at]);
    Ok(())
}

/// `minutes` is missing from the wire shape on purpose: it is a local cache
/// recomputed from the entries below, not something to merge.
async fn tasks(tx: &mut Tx<'_>, rows: &[Task]) -> Result<()> {
    upsert!(tx, rows,
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
    Ok(())
}

async fn time_entries(tx: &mut Tx<'_>, rows: &[TimeEntry]) -> Result<()> {
    upsert!(tx, rows,
        "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (id) DO UPDATE SET
           minutes = excluded.minutes, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at > time_entries.updated_at",
        r => [&r.id, &r.task_id, &r.day_key, r.minutes, &r.created_at, &r.updated_at, &r.deleted_at]);
    Ok(())
}

async fn invoices(tx: &mut Tx<'_>, rows: &[Invoice]) -> Result<()> {
    upsert!(tx, rows,
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
    Ok(())
}

async fn invoice_items(tx: &mut Tx<'_>, rows: &[InvoiceItem]) -> Result<()> {
    upsert!(tx, rows,
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
    Ok(())
}

/// Guarded the same way as every row: a reply that took a while to come back
/// must not undo a preference changed here in the meantime.
async fn settings(tx: &mut Tx<'_>, st: &Settings) -> Result<()> {
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
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Entries arriving from another device change these totals, so the cache is
/// rebuilt for every task in the same transaction.
async fn recount_minutes(tx: &mut Tx<'_>) -> Result<()> {
    sqlx::query(
        "UPDATE tasks SET minutes = (
           SELECT COALESCE(SUM(minutes), 0) FROM time_entries
            WHERE task_id = tasks.id AND deleted_at IS NULL)",
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
