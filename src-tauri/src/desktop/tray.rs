//! The tray icon and its menu.

use tauri::{AppHandle, Manager};

use super::panel;

/// Tray icon with the three things the app can be asked for while hidden.
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let open = MenuItem::with_id(app, "open", "Открыть freel", true, None::<&str>)?;
    let show_panel = MenuItem::with_id(app, "panel", "Показать панель", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &show_panel, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.on_menu_event(chosen).build(app)?;
    Ok(())
}

fn chosen(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        "open" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }
        "panel" => {
            if let Some(w) = app.get_webview_window("panel") {
                panel::reveal(app, &w);
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}
