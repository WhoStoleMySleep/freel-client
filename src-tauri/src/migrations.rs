//! Schema history. Every version ever shipped stays here: a database is
//! migrated from whatever state it is in, not from the latest one.

use tauri_plugin_sql::{Migration, MigrationKind};

/// Schema mirrors the React Native build so data shapes stay identical.
pub fn migrations() -> Vec<Migration> {
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
        Migration {
            version: 5,
            description: "interface language",
            sql: r#"
                -- 'system' follows the OS, the same way theme_mode does. Existing
                -- installations get it too: before this column the interface was
                -- Russian only, and a Russian system keeps showing Russian.
                ALTER TABLE settings ADD COLUMN language TEXT NOT NULL DEFAULT 'system';
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use sqlx::Row;

    use super::*;
    use crate::testdb;

    /// The migration has to run over a database that already holds data — that
    /// is the only way it will ever run in the wild.
    #[tokio::test]
    async fn migration_backfills_existing_rows() {
        let (pool, path) = testdb::pool_upto(1).await;
        testdb::seed(&pool).await;
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

        sqlx::raw_sql(migrations()[1].sql)
            .execute(&pool)
            .await
            .unwrap();

        let entry: String = sqlx::query("SELECT updated_at FROM time_entries WHERE id = 'e1'")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("updated_at");
        assert_eq!(
            entry, "2026-03-05T00:00:00.000Z",
            "запись времени берёт свой day_key"
        );

        // The item has no date of its own, so it inherits the invoice's.
        let item: String = sqlx::query("SELECT created_at FROM invoice_items WHERE id = 'ii1'")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("created_at");
        assert_eq!(
            item, "2026-04-10T00:00:00.000Z",
            "строка счёта наследует дату счёта"
        );

        // Nothing may look deleted just because the column appeared.
        for table in [
            "projects",
            "tasks",
            "time_entries",
            "invoices",
            "invoice_items",
        ] {
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
}
