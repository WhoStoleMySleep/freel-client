import { invoke } from '@tauri-apps/api/core'
import type { SyncResult, SyncStatus } from '~/types'

/**
 * Thin wrappers over the Rust side, which owns the whole exchange: the reply
 * has to be applied in one transaction, a request from `tauri://` would trip
 * over CORS, and the account token is deliberately kept out of JavaScript.
 */
export const syncStatus = () => invoke<SyncStatus>('sync_status')
export const syncNow = () => invoke<SyncResult>('sync_now')

export async function syncRegister(url: string, email: string, password: string): Promise<void> {
  await invoke('sync_register', { url, email, password })
}

export async function syncLogin(url: string, email: string, password: string): Promise<void> {
  await invoke('sync_login', { url, email, password })
}

export async function syncLogout(): Promise<void> {
  await invoke('sync_logout')
}
