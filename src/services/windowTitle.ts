import { getCurrentWindow } from '@tauri-apps/api/window';

export const APP_TITLE = 'freel';

const isTauri = () => '__TAURI_INTERNALS__' in window;
const isMobileWebview = () => /android|iphone|ipad/i.test(navigator.userAgent);

/**
 * Desktop has no equivalent of Android's ongoing notification, so the running
 * timer is surfaced in the window title instead — it shows up in the taskbar
 * and window switcher while the app is behind other windows.
 */
export const isDesktopApp = () => isTauri() && !isMobileWebview();

export async function setWindowTitle(title: string): Promise<void> {
  document.title = title;
  if (!isDesktopApp()) return;
  try {
    await getCurrentWindow().setTitle(title);
  } catch (e) {
    console.warn('window title failed', e);
  }
}
