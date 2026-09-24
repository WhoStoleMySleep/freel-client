//! Desktop-only surface: the edge panel and the tray icon.

mod panel;
mod tray;

use tauri::{AppHandle, Listener};

/// Builds the panel, the tray icon and the pointer watcher behind them.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    panel::build(app)?;
    tray::build(app)?;
    panel::watch_edge(app.clone());

    // The panel reports when a text field is focused so auto-hide can stand
    // down while the user types.
    app.listen("panel:lock", |event| {
        panel::set_locked(event.payload().contains("true"));
    });
    Ok(())
}
