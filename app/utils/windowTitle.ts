import { getCurrentWindow } from '@tauri-apps/api/window'

export const APP_TITLE = 'freel'

export async function setWindowTitle(title: string): Promise<void> {
  document.title = title
  if (!isDesktopApp()) return
  try {
    await getCurrentWindow().setTitle(title)
  }
  catch (e) {
    console.warn('window title failed', e)
  }
}
