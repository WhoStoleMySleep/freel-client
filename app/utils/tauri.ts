/**
 * The app runs both inside a Tauri window and in a plain browser (`nuxt dev`
 * without a build). A browser has neither IPC nor SQLite, so every call that
 * leaves the page asks this first.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function isMobileWebview(): boolean {
  return /android|iphone|ipad/i.test(navigator.userAgent)
}

/**
 * Desktop has no equivalent of Android's ongoing notification, so the running
 * timer is surfaced in the window title instead — it shows up in the taskbar
 * and window switcher while the app is behind other windows.
 */
export function isDesktopApp(): boolean {
  return isTauri() && !isMobileWebview()
}
