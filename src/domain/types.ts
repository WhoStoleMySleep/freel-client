import { Currency } from './currency';
import { InvoiceStatus, RateType, TaskStatus } from './status';

export interface Project {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  link: string;
  rateType: RateType;
  rate: number;
  minutes: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * `createdAt`/`updatedAt` below are optional only because rows read before the
 * sync-metadata migration, and backups written in format v1, do not carry them.
 * Everything the app writes now sets both.
 */
export interface TimeEntry {
  id: string;
  taskId: string;
  dayKey: string;
  minutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  title: string;
  projectName: string;
  minutes: number;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  number: string;
  projectName: string;
  dayKey: string;
  status: InvoiceStatus;
  factual: number | null;
  total: number;
  items: InvoiceItem[];
  createdAt?: string;
  updatedAt?: string;
}

export type ThemeMode = 'system' | 'dark' | 'light';

export interface Settings {
  themeMode: ThemeMode;
  currency: Currency;
  defaultRate: number;
  hasOnboarded: boolean;
  invoiceSeq: number;
  compactTaskForm: boolean;
  /** Optional so callers can build a Settings patch without one. */
  updatedAt?: string;
  /** Prefix stamped on invoice numbers, keeping them unique per device. */
  deviceCode?: string;
}

export interface ActiveTimer {
  taskId: string;
  /** When the current (unpaused) stretch began. */
  startedAt: string; // ISO timestamp
  /** Time banked from earlier stretches, before the latest pause/resume. */
  accumulatedMs: number;
  paused: boolean;
}
