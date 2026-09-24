//! Deleting a row and everything hanging off it.

use serde::Deserialize;

use crate::db;
use crate::error::Result;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeleteKind {
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
pub async fn soft_delete(
    app: tauri::AppHandle,
    kind: DeleteKind,
    id: String,
    now: String,
) -> Result<()> {
    let pool = db::pool(&app).await?;
    apply(&pool, kind, &id, &now).await
}

/// The database half of [`soft_delete`], testable without a running app.
pub async fn apply(pool: &sqlx::SqlitePool, kind: DeleteKind, id: &str, now: &str) -> Result<()> {
    let mut tx = pool.begin().await?;

    for sql in statements(kind) {
        sqlx::query(sql)
            .bind(now)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Children first, so a row is never left pointing at a deleted parent.
fn statements(kind: DeleteKind) -> Vec<&'static str> {
    match kind {
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
    }
}

#[cfg(test)]
mod tests {
    use sqlx::Row;

    use super::*;
    use crate::testdb;

    /// Deleting a project has to tombstone its tasks and their time entries, or
    /// sync would see live children hanging off a deleted parent.
    #[tokio::test]
    async fn deleting_a_project_tombstones_its_children() {
        let (pool, path) = testdb::pool().await;
        testdb::seed(&pool).await;
        sqlx::query(
            "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at)
             VALUES ('old-e', 'old-t', '2026-01-01', 30, '2026-01-01T00:00:00.000Z',
                     '2026-01-01T00:00:00.000Z')",
        )
        .execute(&pool)
        .await
        .unwrap();

        apply(
            &pool,
            DeleteKind::Project,
            "old-p",
            "2026-07-30T10:00:00.000Z",
        )
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
            assert_eq!(
                testdb::count(&pool, table).await,
                1,
                "строка {table} исчезла физически"
            );
        }

        let ts: String = sqlx::query("SELECT updated_at FROM tasks")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("updated_at");
        assert_eq!(
            ts, "2026-07-30T10:00:00.000Z",
            "удаление должно двигать updated_at"
        );

        let _ = std::fs::remove_file(path);
    }
}
