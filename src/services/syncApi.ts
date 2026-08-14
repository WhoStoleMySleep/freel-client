import { invoke } from '@tauri-apps/api/core';

export interface SyncStatus {
  url: string;
  email: string;
  connected: boolean;
  lastSyncAt: string;
}

export interface SyncResult {
  sent: number;
  received: number;
  lastSyncAt: string;
}

/**
 * Thin wrappers over the Rust side, which owns the whole exchange: the reply
 * has to be applied in one transaction, a request from `tauri://` would trip
 * over CORS, and the account token is deliberately kept out of JavaScript.
 */
export const syncStatus = () => invoke<SyncStatus>('sync_status');
export const syncRegister = (url: string, email: string, password: string) =>
  invoke<void>('sync_register', { url, email, password });
export const syncLogin = (url: string, email: string, password: string) =>
  invoke<void>('sync_login', { url, email, password });
export const syncLogout = () => invoke<void>('sync_logout');
export const syncNow = () => invoke<SyncResult>('sync_now');
