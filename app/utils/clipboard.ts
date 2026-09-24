import { writeText } from '@tauri-apps/plugin-clipboard-manager'

/** Copies through Tauri, falling back to the web API in a plain browser. */
export async function copyText(text: string): Promise<void> {
  try {
    await writeText(text)
  }
  catch {
    await navigator.clipboard?.writeText(text)
  }
}
