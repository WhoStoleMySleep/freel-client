//! Access to the database the SQL plugin opened.

use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::error::{Error, Result};

pub const DB_KEY: &str = "sqlite:freel.db";

/// Hands back the pool the SQL plugin opened for our database.
pub async fn pool(app: &tauri::AppHandle) -> Result<sqlx::SqlitePool> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;
    match map.get(DB_KEY) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err(Error::DbUnavailable),
    }
}
