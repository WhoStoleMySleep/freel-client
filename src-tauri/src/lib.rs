mod backup;
mod db;
mod error;
mod migrations;
mod snapshot;
mod soft_delete;
mod sync;

#[cfg(desktop)]
mod desktop;

#[cfg(test)]
mod testdb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            backup::restore_backup,
            soft_delete::soft_delete,
            sync::sync_register,
            sync::sync_login,
            sync::sync_logout,
            sync::sync_now,
            sync::sync_status,
            sync::sync_mark_dirty
        ])
        // Before the SQL plugin: it opens (and migrates) the database as soon
        // as it is set up, and the snapshot has to predate that.
        .plugin(snapshot::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_timer::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_KEY, migrations::migrations())
                .build(),
        )
        .setup(|app| {
            sync::spawn_auto_sync(app.handle().clone());
            #[cfg(desktop)]
            desktop::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window must not end the app: the tray icon and
            // the edge panel are the point of it staying alive.
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Tauri failed to start: nothing is running to report it to");
}
