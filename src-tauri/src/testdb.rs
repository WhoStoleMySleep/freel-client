//! Shared scaffolding for the database tests.

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;

/// A pool over a temp file, not `:memory:` — an in-memory SQLite database
/// is per-connection, so a pool would hand out several empty databases.
pub async fn pool() -> (sqlx::SqlitePool, std::path::PathBuf) {
    pool_upto(usize::MAX).await
}

/// `upto` limits how many migrations run, so a test can build a database in
/// its pre-migration shape and then migrate it for real.
pub async fn pool_upto(upto: usize) -> (sqlx::SqlitePool, std::path::PathBuf) {
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
    for m in crate::migrations::migrations().into_iter().take(upto) {
        sqlx::raw_sql(m.sql).execute(&pool).await.unwrap();
    }
    (pool, path)
}

pub async fn seed(pool: &sqlx::SqlitePool) {
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

pub async fn count(pool: &sqlx::SqlitePool, table: &str) -> i64 {
    sqlx::query(&format!("SELECT COUNT(*) AS c FROM {table}"))
        .fetch_one(pool)
        .await
        .unwrap()
        .get::<i64, _>("c")
}
