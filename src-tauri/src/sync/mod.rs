//! Talking to the sync server.
//!
//! The whole exchange lives in Rust rather than the webview for three reasons:
//! the reply has to be applied in one transaction, a request from `tauri://`
//! would be blocked by CORS, and the account token never has to exist in
//! JavaScript at all.

mod auto;
mod clock;
mod http;
mod local;
mod merge;
mod wire;

use crate::db;
use crate::error::{Error, Result};

pub use auto::spawn as spawn_auto_sync;
use http::Credentials;
pub use wire::{SyncResult, SyncStatus};

#[tauri::command]
pub async fn sync_register(url: String, email: String, password: String) -> Result<()> {
    http::register(&url, &Credentials { email, password }).await
}

#[tauri::command]
pub async fn sync_login(
    app: tauri::AppHandle,
    url: String,
    email: String,
    password: String,
) -> Result<()> {
    let pool = db::pool(&app).await?;
    let device = local::device(&pool).await?;
    let creds = Credentials { email, password };

    let token = http::login(&url, &creds, &device).await?;
    local::save_login(&pool, &url, &creds.email, &token).await
}

#[tauri::command]
pub async fn sync_logout(app: tauri::AppHandle) -> Result<()> {
    local::clear_session(&db::pool(&app).await?).await
}

#[tauri::command]
pub async fn sync_status(app: tauri::AppHandle) -> Result<SyncStatus> {
    local::status(&db::pool(&app).await?).await
}

#[tauri::command]
pub async fn sync_now(app: tauri::AppHandle) -> Result<SyncResult> {
    let res = run_sync(&app).await;
    if res.is_ok() {
        auto::mark_synced();
    }
    res
}

/// Records that this device has local edits the server has not seen.
///
/// Called from every mutating action, so the background loop can push soon
/// after a change instead of waiting out the full interval.
#[tauri::command]
pub fn sync_mark_dirty() {
    auto::mark_dirty();
}

/// One exchange: everything local goes up, everything the server has comes back
/// down and is merged in.
async fn run_sync(app: &tauri::AppHandle) -> Result<SyncResult> {
    let pool = db::pool(app).await?;
    let session = local::session(&pool).await?;
    let snapshot = local::snapshot(&pool).await?;

    let remote = match http::exchange(&session, &snapshot).await {
        // The token was revoked or the account is gone.
        Err(Error::SessionExpired) => {
            local::clear_token(&pool).await;
            return Err(Error::SessionExpired);
        }
        other => other?,
    };

    let last_sync_at = merge::apply(&pool, &remote).await?;
    Ok(SyncResult {
        sent: snapshot.rows(),
        received: remote.rows(),
        last_sync_at,
    })
}

#[cfg(test)]
mod tests {
    use sqlx::Row;

    use super::http::{client, endpoint};
    use super::wire::Payload;
    use super::{local, merge};

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
        for m in crate::migrations::migrations() {
            sqlx::raw_sql(m.sql).execute(&pool).await.unwrap();
        }

        sqlx::query(
            "INSERT INTO projects (id, name, description, archived, created_at, updated_at)
             VALUES ('p1','Клиент','',0,'2026-07-01T00:00:00.000Z','2026-07-01T00:00:00.000Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO tasks (id, project_id, title, description, link, rate_type, rate, minutes,
                                status, created_at, updated_at)
             VALUES ('t1','p1','Вёрстка','','','hourly',1500,0,'in_work',
                     '2026-07-01T00:00:00.000Z','2026-07-01T00:00:00.000Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO time_entries (id, task_id, day_key, minutes, created_at, updated_at)
             VALUES ('e1','t1','2026-08-01',90,'2026-08-01T10:00:00.000Z','2026-08-01T10:00:00.000Z')",
        ).execute(&pool).await.unwrap();

        let email = format!("t{}@freel.app", std::process::id());
        let c = client().unwrap();
        c.post(endpoint(&base, "auth/register"))
            .json(&serde_json::json!({ "email": email, "password": "correct-horse" }))
            .send()
            .await
            .unwrap();
        let token: String = c
            .post(endpoint(&base, "auth/login"))
            .json(&serde_json::json!({
                "email": email, "password": "correct-horse", "deviceId": "test-dev" }))
            .send()
            .await
            .unwrap()
            .json::<serde_json::Value>()
            .await
            .unwrap()["token"]
            .as_str()
            .unwrap()
            .to_string();

        let payload = local::snapshot(&pool).await.unwrap();
        assert_eq!(
            payload.time_entries.len(),
            1,
            "снимок должен содержать запись времени"
        );

        let res = c
            .post(endpoint(&base, "sync"))
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await
            .unwrap();
        assert!(
            res.status().is_success(),
            "сервер отверг снимок: {}",
            res.status()
        );

        let remote: Payload = res.json().await.unwrap();
        assert_eq!(remote.projects.len(), 1, "проект вернулся");
        assert_eq!(remote.tasks.len(), 1, "задача вернулась");
        assert_eq!(
            remote.time_entries[0].minutes, 90.0,
            "минуты доехали без потерь"
        );

        merge::apply(&pool, &remote).await.unwrap();

        // The cache must be rebuilt from the entries the merge brought in.
        let minutes: f64 = sqlx::query("SELECT minutes FROM tasks WHERE id = 't1'")
            .fetch_one(&pool)
            .await
            .unwrap()
            .get("minutes");
        assert_eq!(minutes, 90.0, "tasks.minutes пересчитан после слияния");

        let _ = std::fs::remove_file(path);
    }
}
