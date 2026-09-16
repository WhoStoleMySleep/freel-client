//! A copy of the database taken before a new version of the app touches it.
//!
//! Everything the user owns lives in one SQLite file outside the app bundle, so
//! replacing the app never deletes it. What *can* destroy it is a migration in
//! the new version going wrong — and a migration runs the first time the new
//! build starts, with no way back. So the first run of every version parks a
//! consistent copy of the database next to it, before `tauri-plugin-sql` opens
//! anything. If an upgrade eats the data, the previous version's state is still
//! sitting on disk.

use std::path::{Path, PathBuf};

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime};

/// How many snapshots to keep. Enough to survive a bad release going unnoticed
/// for an upgrade or two, few enough not to quietly fill the disk.
const KEEP: usize = 5;

const PREFIX: &str = "freel-before-";

/// Registered *before* the SQL plugin so its setup runs first — that is the
/// only window in which the database still holds the old version's data.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("db-snapshot")
        .setup(|app, _api| {
            // A failure here must never stop the app from starting: having no
            // snapshot is bad, not launching at all is worse.
            if let Err(e) = take_if_new_version(app) {
                eprintln!("snapshot: {e}");
            }
            Ok(())
        })
        .build()
}

fn take_if_new_version<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let db = dir.join("freel.db");
    // First ever launch: the SQL plugin is about to create the file, and an
    // empty database is not worth a copy.
    if !db.exists() {
        return Ok(());
    }

    let version = app.package_info().version.to_string();
    let stamp = dir.join("snapshot-version.txt");
    if std::fs::read_to_string(&stamp).ok().as_deref() == Some(version.as_str()) {
        return Ok(());
    }

    let out = dir.join(format!("{PREFIX}{version}.db"));
    tauri::async_runtime::block_on(vacuum_into(&db, &out))?;
    prune(&dir);

    // Written last: if the copy failed, the next launch tries again.
    std::fs::write(&stamp, &version).map_err(|e| e.to_string())
}

/// `VACUUM INTO` rather than a file copy: the database runs in WAL mode, so the
/// `.db` file on its own is missing every change still sitting in `freel.db-wal`.
/// This writes one self-contained, consistent file.
async fn vacuum_into(db: &Path, out: &Path) -> Result<(), String> {
    use sqlx::{sqlite::SqliteConnectOptions, ConnectOptions, Connection};

    // `VACUUM INTO` refuses to overwrite, and a half-written leftover from an
    // interrupted run would otherwise block every later attempt.
    let _ = std::fs::remove_file(out);

    let mut conn = SqliteConnectOptions::new()
        .filename(db)
        .create_if_missing(false)
        .connect()
        .await
        .map_err(|e| e.to_string())?;

    // The path is ours, not user input, but a stray quote would still break the
    // statement — SQLite has no parameter slot in `VACUUM INTO`.
    let target = out.to_string_lossy().replace('\'', "''");
    let result = sqlx::query(&format!("VACUUM INTO '{target}'"))
        .execute(&mut conn)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string());

    let _ = conn.close().await;
    result
}

/// Drops the oldest snapshots once there are more than [`KEEP`].
fn prune(dir: &Path) {
    for path in stale(snapshots(dir)) {
        let _ = std::fs::remove_file(path);
    }
}

/// The snapshot files in `dir`, each with the time it was written.
fn snapshots(dir: &Path) -> Vec<(std::time::SystemTime, PathBuf)> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_str()
                .is_some_and(|n| n.starts_with(PREFIX) && n.ends_with(".db"))
        })
        .filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path())))
        .collect()
}

/// Which snapshots are surplus to [`KEEP`], oldest first.
fn stale(mut found: Vec<(std::time::SystemTime, PathBuf)>) -> Vec<PathBuf> {
    if found.len() <= KEEP {
        return Vec::new();
    }
    found.sort_by_key(|(modified, _)| *modified);
    found.truncate(found.len() - KEEP);
    found.into_iter().map(|(_, path)| path).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::Row;

    /// The point of `VACUUM INTO`: rows written but not yet checkpointed still
    /// have to come across. A plain copy of the `.db` file would lose them.
    #[tokio::test]
    async fn snapshot_carries_rows_still_in_the_wal() {
        let dir = std::env::temp_dir().join(format!("freel-snap-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let db = dir.join("wal.db");
        let out = dir.join("wal-copy.db");

        let pool = SqlitePoolOptions::new()
            .connect(&format!("sqlite:{}?mode=rwc", db.display()))
            .await
            .unwrap();
        sqlx::query("PRAGMA journal_mode = WAL").execute(&pool).await.unwrap();
        sqlx::query("CREATE TABLE t (id INTEGER PRIMARY KEY)").execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO t (id) VALUES (1), (2), (3)").execute(&pool).await.unwrap();

        vacuum_into(&db, &out).await.unwrap();

        let copy = SqlitePoolOptions::new()
            .connect(&format!("sqlite:{}", out.display()))
            .await
            .unwrap();
        let count: i64 = sqlx::query("SELECT COUNT(*) AS n FROM t")
            .fetch_one(&copy)
            .await
            .unwrap()
            .get("n");
        assert_eq!(count, 3);

        pool.close().await;
        copy.close().await;
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Overwriting an interrupted run must work — `VACUUM INTO` alone refuses.
    #[tokio::test]
    async fn snapshot_replaces_a_leftover_file() {
        let dir = std::env::temp_dir().join(format!("freel-snap2-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let db = dir.join("src.db");
        let out = dir.join("out.db");
        std::fs::write(&out, "half-written rubbish").unwrap();

        let pool = SqlitePoolOptions::new()
            .connect(&format!("sqlite:{}?mode=rwc", db.display()))
            .await
            .unwrap();
        sqlx::query("CREATE TABLE t (id INTEGER PRIMARY KEY)").execute(&pool).await.unwrap();

        vacuum_into(&db, &out).await.unwrap();
        assert!(out.metadata().unwrap().len() > 20);

        pool.close().await;
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Only snapshots are candidates — the live database sits in the same folder.
    #[test]
    fn snapshots_ignores_everything_else() {
        let dir = std::env::temp_dir().join(format!("freel-list-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for name in [
            "freel.db".to_string(),
            "freel.db-wal".to_string(),
            "snapshot-version.txt".to_string(),
            format!("{PREFIX}0.1.0.db"),
            format!("{PREFIX}0.2.0.db"),
        ] {
            std::fs::write(dir.join(name), "x").unwrap();
        }

        let mut names: Vec<String> = snapshots(&dir)
            .into_iter()
            .map(|(_, p)| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(names, vec![format!("{PREFIX}0.1.0.db"), format!("{PREFIX}0.2.0.db")]);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn stale_drops_the_oldest_and_keeps_the_rest() {
        let at = |secs: u64| std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(secs);
        // Deliberately out of order, and two more than KEEP.
        let found: Vec<_> = [5u64, 1, 7, 3, 6, 2, 4]
            .iter()
            .map(|s| (at(*s), PathBuf::from(format!("{PREFIX}{s}.db"))))
            .collect();

        let dropped = stale(found);

        assert_eq!(
            dropped,
            vec![
                PathBuf::from(format!("{PREFIX}1.db")),
                PathBuf::from(format!("{PREFIX}2.db"))
            ]
        );
    }

    #[test]
    fn stale_spares_everything_while_under_the_limit() {
        let at = |secs: u64| std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(secs);
        let found: Vec<_> = (0..KEEP as u64)
            .map(|s| (at(s), PathBuf::from(format!("{PREFIX}{s}.db"))))
            .collect();

        assert!(stale(found).is_empty());
    }
}
