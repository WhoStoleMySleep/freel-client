//! The slide-out panel: its window, how it is shown, and what opens it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager, WebviewWindow};

/// Width of the slide-out panel, in logical pixels.
const WIDTH: f64 = 360.0;
/// How close to the screen edge the pointer must be to arm the panel.
const EDGE_ZONE: f64 = 2.0;
/// Polls before the panel opens — keeps a passing cursor from triggering it.
const DWELL_TICKS: u8 = 4;
/// Every tick asks the windowing system for the cursor, so the loop runs at
/// full rate only where it matters: against the edge, or while the panel is
/// open and might need to close. Further out the pointer has ground to cover
/// before either can happen.
const NEAR_POLL_MS: u64 = 60;
const FAR_POLL_MS: u64 = 150;
const NEAR_ZONE: f64 = 200.0;
/// Unchanged from the original tick-counted dwell: 4 × 60 ms.
const DWELL_MS: u64 = NEAR_POLL_MS * DWELL_TICKS as u64;
/// The scale factor only changes when the panel's monitor does, while
/// `primary_monitor()` is a call into the window server every tick.
const SCALE_TTL_MS: u64 = 2000;

/// Set while the panel holds text the user is in the middle of typing.
/// Auto-hide is suspended then, or moving the mouse would discard the input.
static LOCKED: AtomicBool = AtomicBool::new(false);

pub fn set_locked(locked: bool) {
    LOCKED.store(locked, Ordering::Relaxed);
}

/// Brings the panel forward and gives it the keyboard.
///
/// Focus is taken deliberately: without it the first click only activates the
/// window and a second is needed to actually press anything. `app.show()` comes
/// first because hiding the app on the way out leaves its windows unshowable
/// until the app itself is visible again.
pub fn reveal(app: &AppHandle, panel: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    let _ = app.show();
    let _ = panel.show();
    let _ = panel.set_focus();
    let _ = app;
}

/// Hides the panel and hands the keyboard back to whatever the user was in.
///
/// On macOS `app.hide()` is what restores the previous application — there is
/// no need to remember which one it was. It is skipped when the main window is
/// on screen, since hiding the app would take that down too.
fn conceal(app: &AppHandle, panel: &WebviewWindow) {
    let _ = panel.hide();
    #[cfg(target_os = "macos")]
    {
        let main_visible = app
            .get_webview_window("main")
            .and_then(|w| w.is_visible().ok())
            .unwrap_or(false);
        if !main_visible {
            let _ = app.hide();
        }
    }
    let _ = app;
}

/// Where the panel's page lives.
///
/// Сборка Nuxt кладёт страницу файлом `panel/index.html`, и протокол `tauri://`
/// отдаёт ровно тот путь, который попросили, — каталог он не раскрывает. В dev
/// же адрес уходит на сервер Nuxt, а там маршрут называется `/panel`: запрос
/// файла попал бы в роутер как несуществующий путь.
fn page() -> &'static str {
    if tauri::is_dev() {
        "panel"
    } else {
        "panel/index.html"
    }
}

/// Creates the edge panel up front, hidden. Building it lazily on first hover
/// would show a blank window while the webview boots.
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let (screen_h, _) = screen_metrics(app);
    let height = (screen_h * 0.8).max(420.0);

    WebviewWindowBuilder::new(app, "panel", WebviewUrl::App(page().into()))
        .title("freel")
        .inner_size(WIDTH, height)
        .position(0.0, (screen_h - height) / 2.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()?;
    Ok(())
}

/// Logical height of the primary screen and its scale factor.
fn screen_metrics(app: &AppHandle) -> (f64, f64) {
    match app.primary_monitor() {
        Ok(Some(m)) => {
            let scale = m.scale_factor();
            (m.size().height as f64 / scale, scale)
        }
        _ => (900.0, 1.0),
    }
}

/// Watches the pointer and opens the panel when it rests against the left edge.
pub fn watch_edge(app: AppHandle) {
    thread::spawn(move || {
        let mut watch = Watch::new();
        loop {
            thread::sleep(Duration::from_millis(watch.poll_ms));
            watch.tick(&app);
        }
    });
}

/// The pointer is sampled tick by tick, so what it was doing has to be carried
/// between them.
struct Watch {
    dwell_ms: u64,
    poll_ms: u64,
    scale: f64,
    scale_age_ms: u64,
}

impl Watch {
    fn new() -> Self {
        Self {
            dwell_ms: 0,
            poll_ms: NEAR_POLL_MS,
            scale: 1.0,
            // Forces a read on the first pass.
            scale_age_ms: SCALE_TTL_MS,
        }
    }

    /// Tauri reports the cursor in physical pixels, so everything is converted
    /// to logical units before being compared with the panel's own geometry.
    fn tick(&mut self, app: &AppHandle) {
        self.scale_age_ms = self.scale_age_ms.saturating_add(self.poll_ms);

        let Some(panel) = app.get_webview_window("panel") else {
            return;
        };
        let Ok(pos) = app.cursor_position() else {
            return;
        };
        if self.scale_age_ms >= SCALE_TTL_MS {
            self.scale = screen_metrics(app).1;
            self.scale_age_ms = 0;
        }

        let x = pos.x / self.scale;
        let visible = panel.is_visible().unwrap_or(false);
        if visible {
            self.while_open(app, &panel, x);
        } else {
            self.while_closed(app, &panel, x);
        }
        self.poll_ms = if visible || x <= NEAR_ZONE {
            NEAR_POLL_MS
        } else {
            FAR_POLL_MS
        };
    }

    /// The margin is generous so the panel does not vanish while the pointer
    /// travels towards a control near its right edge.
    fn while_open(&mut self, app: &AppHandle, panel: &WebviewWindow, x: f64) {
        let typing = LOCKED.load(Ordering::Relaxed);
        if !typing && x > WIDTH + 60.0 {
            conceal(app, panel);
        }
        self.dwell_ms = 0;
    }

    fn while_closed(&mut self, app: &AppHandle, panel: &WebviewWindow, x: f64) {
        if x > EDGE_ZONE {
            self.dwell_ms = 0;
            return;
        }
        self.dwell_ms = self.dwell_ms.saturating_add(self.poll_ms);
        if self.dwell_ms >= DWELL_MS {
            reveal(app, panel);
            self.dwell_ms = 0;
        }
    }
}
