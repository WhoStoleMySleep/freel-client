import { create } from 'zustand';
import * as projectsRepo from '../db/repositories/projectsRepo';
import * as tasksRepo from '../db/repositories/tasksRepo';
import * as invoicesRepo from '../db/repositories/invoicesRepo';
import * as timeEntriesRepo from '../db/repositories/timeEntriesRepo';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as backupRepo from '../db/repositories/backupRepo';
import { BackupFile } from '../domain/backup';
import { ActiveTimer, Invoice, Project, Settings, Task, ThemeMode } from '../domain/types';
import { broadcastChanged } from '../services/sync';
import { InvoiceStatus, RateType, TaskStatus, stepStatus } from '../domain/status';
import { Currency } from '../domain/currency';
import { timerElapsedMs } from '../domain/earnings';
import { newId } from '../utils/id';
import { todayKey } from '../utils/date';
import { cancelTimerNotification, showTimerNotification } from '../notifications/timerNotification';
import { buildDemoData, demoTodayMinutes } from './demoData';

interface NewTaskFields {
  projectId: string;
  title: string;
  description: string;
  link: string;
  rateType: RateType;
  rate: number;
  status: TaskStatus;
  initialMinutes: number;
}

interface EditTaskFields {
  projectId: string;
  title: string;
  description: string;
  link: string;
  rateType: RateType;
  rate: number;
  status: TaskStatus;
}

export type AppPhase = 'loading' | 'onboarding' | 'app';

interface AppState {
  ready: boolean;
  phase: AppPhase;
  settings: Settings;
  activeTimer: ActiveTimer | null;
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  todayMinutes: number;
  demoMode: boolean;

  setPhase: (phase: AppPhase) => void;
  hydrate: () => Promise<void>;
  toggleDemoMode: () => Promise<void>;

  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setCurrency: (currency: Currency) => Promise<void>;
  setDefaultRate: (rate: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;

  addProject: (name: string, description: string) => Promise<void>;
  editProject: (id: string, name: string, description: string) => Promise<void>;
  setProjectArchived: (id: string, archived: boolean) => Promise<void>;
  deleteProjectForever: (id: string) => Promise<void>;

  addTask: (input: NewTaskFields) => Promise<void>;
  editTask: (id: string, patch: EditTaskFields) => Promise<void>;
  stepTaskStatus: (id: string, dir: 1 | -1) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  addManualTime: (id: string, minutes: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  setCompactTaskForm: (value: boolean) => Promise<void>;

  startTimer: (taskId: string) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;

  buildBackup: () => Promise<BackupFile>;
  restoreBackup: (backup: BackupFile) => Promise<void>;

  createInvoiceFromTasks: (taskIds: string[]) => Promise<void>;
  setInvoiceStatus: (id: string, status: InvoiceStatus, factual: number | null) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  currency: 'RUB',
  defaultRate: 2500,
  hasOnboarded: false,
  invoiceSeq: 0,
  compactTaskForm: false,
};


// Snapshot of the real, DB-backed data — saved only while demoMode is on, so
// it can be restored exactly as it was without ever writing demo edits back
// to SQLite. Lives outside the store since it's not something the UI reads.
interface LiveSnapshot {
  activeTimer: ActiveTimer | null;
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  todayMinutes: number;
}
let liveBackup: LiveSnapshot | null = null;

async function refreshTodayMinutes(set: (patch: Partial<AppState>) => void) {
  const minutes = await timeEntriesRepo.sumMinutesForDay(todayKey());
  set({ todayMinutes: minutes });
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  phase: 'loading',
  settings: DEFAULT_SETTINGS,
  activeTimer: null,
  projects: [],
  tasks: [],
  invoices: [],
  todayMinutes: 0,
  demoMode: false,

  setPhase: (phase) => set({ phase }),

  hydrate: async () => {
    // Running in a plain browser (`npm run dev`) there is no Tauri runtime and
    // therefore no SQLite — fall back to the demo dataset so the UI can be
    // iterated on without rebuilding the app.
    if (!('__TAURI_INTERNALS__' in window)) {
      const demo = buildDemoData();
      set({
        ready: true,
        projects: demo.projects,
        tasks: demo.tasks,
        invoices: demo.invoices,
        todayMinutes: demoTodayMinutes(demo.tasks),
      });
      return;
    }

    await settingsRepo.ensureDevice();
    const { settings, activeTimer } = await settingsRepo.loadSettings();
    const [projects, tasks, invoices, todayMinutes] = await Promise.all([
      projectsRepo.listProjects(),
      tasksRepo.listTasks(),
      invoicesRepo.listInvoices(),
      timeEntriesRepo.sumMinutesForDay(todayKey()),
    ]);
    set({ ready: true, settings, activeTimer, projects, tasks, invoices, todayMinutes });
    if (activeTimer) {
      const task = tasks.find((t) => t.id === activeTimer.taskId);
      if (task) await showTimerNotification(task.title, activeTimer);
    }
  },

  toggleDemoMode: async () => {
    const s = get();
    if (!s.demoMode) {
      liveBackup = { activeTimer: s.activeTimer, projects: s.projects, tasks: s.tasks, invoices: s.invoices, todayMinutes: s.todayMinutes };
      if (s.activeTimer) await cancelTimerNotification();
      const demo = buildDemoData();
      set({
        demoMode: true,
        activeTimer: null,
        projects: demo.projects,
        tasks: demo.tasks,
        invoices: demo.invoices,
        todayMinutes: demoTodayMinutes(demo.tasks),
      });
    } else {
      const backup = liveBackup;
      liveBackup = null;
      set({
        demoMode: false,
        activeTimer: backup?.activeTimer ?? null,
        projects: backup?.projects ?? [],
        tasks: backup?.tasks ?? [],
        invoices: backup?.invoices ?? [],
        todayMinutes: backup?.todayMinutes ?? 0,
      });
      if (backup?.activeTimer) {
        const task = backup.tasks.find((t) => t.id === backup.activeTimer!.taskId);
        if (task) await showTimerNotification(task.title, backup.activeTimer);
      }
    }
  },

  setThemeMode: async (mode) => {
    await settingsRepo.updateSettings({ themeMode: mode });
    set((s) => ({ settings: { ...s.settings, themeMode: mode } }));
  },
  setCurrency: async (currency) => {
    await settingsRepo.updateSettings({ currency });
    set((s) => ({ settings: { ...s.settings, currency } }));
  },
  setDefaultRate: async (rate) => {
    await settingsRepo.updateSettings({ defaultRate: rate });
    set((s) => ({ settings: { ...s.settings, defaultRate: rate } }));
  },
  completeOnboarding: async () => {
    await settingsRepo.updateSettings({ hasOnboarded: true });
    set((s) => ({ settings: { ...s.settings, hasOnboarded: true } }));
  },
  setCompactTaskForm: async (value) => {
    await settingsRepo.updateSettings({ compactTaskForm: value });
    set((s) => ({ settings: { ...s.settings, compactTaskForm: value } }));
  },

  addProject: async (name, description) => {
    const now = new Date().toISOString();
    if (get().demoMode) {
      const project: Project = { id: newId(), name, description, archived: false, createdAt: now, updatedAt: now };
      set((s) => ({ projects: [...s.projects, project] }));
      return;
    }
    const project = await projectsRepo.createProject({ name, description });
    set((s) => ({ projects: [...s.projects, project] }));
  },
  editProject: async (id, name, description) => {
    if (get().demoMode) {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, name, description, updatedAt: new Date().toISOString() } : p)),
      }));
      return;
    }
    await projectsRepo.updateProject(id, { name, description });
    const projects = await projectsRepo.listProjects();
    set({ projects });
  },
  setProjectArchived: async (id, archived) => {
    if (get().demoMode) {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, archived, updatedAt: new Date().toISOString() } : p)),
      }));
      return;
    }
    await projectsRepo.setProjectArchived(id, archived);
    const projects = await projectsRepo.listProjects();
    set({ projects });
  },
  deleteProjectForever: async (id) => {
    if (get().demoMode) {
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.filter((t) => t.projectId !== id),
      }));
      return;
    }
    await projectsRepo.deleteProjectForever(id);
    const [projects, tasks] = await Promise.all([projectsRepo.listProjects(), tasksRepo.listTasks()]);
    set({ projects, tasks });
  },

  addTask: async (input) => {
    if (get().demoMode) {
      const now = new Date().toISOString();
      const task: Task = {
        id: newId(),
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        link: input.link,
        rateType: input.rateType,
        rate: input.rate,
        minutes: input.initialMinutes,
        status: input.status,
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ tasks: [...s.tasks, task], todayMinutes: s.todayMinutes + input.initialMinutes }));
      return;
    }
    const created = await tasksRepo.createTask(input);
    if (input.initialMinutes > 0) {
      await timeEntriesRepo.addMinutesToday(created.id, input.initialMinutes);
    }
    const tasks = await tasksRepo.listTasks();
    set({ tasks });
    await refreshTodayMinutes(set);
    void broadcastChanged();
  },
  editTask: async (id, patch) => {
    if (get().demoMode) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)) }));
      return;
    }
    await tasksRepo.updateTask(id, patch);
    const tasks = await tasksRepo.listTasks();
    set({ tasks });
    void broadcastChanged();
  },
  stepTaskStatus: async (id, dir) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const next = stepStatus(task.status, dir);
    if (get().demoMode) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: next, updatedAt: new Date().toISOString() } : t)) }));
      return;
    }
    await tasksRepo.setTaskStatus(id, next);
    const tasks = await tasksRepo.listTasks();
    set({ tasks });
    void broadcastChanged();
  },
  setTaskStatus: async (id, status) => {
    if (get().demoMode) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)) }));
      return;
    }
    await tasksRepo.setTaskStatus(id, status);
    const tasks = await tasksRepo.listTasks();
    set({ tasks });
    void broadcastChanged();
  },
  addManualTime: async (id, minutes) => {
    if (minutes <= 0) return;
    if (get().demoMode) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, minutes: t.minutes + minutes, updatedAt: new Date().toISOString() } : t)),
        todayMinutes: s.todayMinutes + minutes,
      }));
      return;
    }
    await timeEntriesRepo.addMinutesToday(id, minutes);
    const tasks = await tasksRepo.listTasks();
    set({ tasks });
    await refreshTodayMinutes(set);
    void broadcastChanged();
  },

  deleteTask: async (id) => {
    const state = get();
    // Drop the timer first if it's running on the task being removed.
    if (state.activeTimer?.taskId === id) {
      if (!state.demoMode) await settingsRepo.setActiveTimer(null);
      set({ activeTimer: null });
      await cancelTimerNotification();
    }
    if (state.demoMode) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      return;
    }
    await tasksRepo.deleteTask(id);
    const tasks = await tasksRepo.listTasks();
    set({ tasks });
    await refreshTodayMinutes(set);
    void broadcastChanged();
  },

  startTimer: async (taskId) => {
    const state = get();
    if (state.activeTimer) {
      if (state.demoMode) demoCommitActiveTimer(state.activeTimer, set);
      else await commitActiveTimer(state.activeTimer, set);
    }
    const timer: ActiveTimer = { taskId, startedAt: new Date().toISOString(), accumulatedMs: 0, paused: false };
    if (!state.demoMode) await settingsRepo.setActiveTimer(timer);
    set({ activeTimer: timer });
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) await showTimerNotification(task.title, timer);
    void broadcastChanged();
  },
  pauseTimer: async () => {
    const state = get();
    const timer = state.activeTimer;
    if (!timer || timer.paused) return;
    const paused: ActiveTimer = {
      ...timer,
      accumulatedMs: timerElapsedMs(timer, Date.now()),
      paused: true,
    };
    if (!state.demoMode) await settingsRepo.setActiveTimer(paused);
    set({ activeTimer: paused });
    const task = state.tasks.find((t) => t.id === paused.taskId);
    if (task) await showTimerNotification(task.title, paused);
    void broadcastChanged();
  },
  resumeTimer: async () => {
    const state = get();
    const timer = state.activeTimer;
    if (!timer || !timer.paused) return;
    const resumed: ActiveTimer = { ...timer, startedAt: new Date().toISOString(), paused: false };
    if (!state.demoMode) await settingsRepo.setActiveTimer(resumed);
    set({ activeTimer: resumed });
    const task = state.tasks.find((t) => t.id === resumed.taskId);
    if (task) await showTimerNotification(task.title, resumed);
    void broadcastChanged();
  },
  stopTimer: async () => {
    const state = get();
    if (!state.activeTimer) return;
    if (state.demoMode) {
      demoCommitActiveTimer(state.activeTimer, set);
    } else {
      await commitActiveTimer(state.activeTimer, set);
      await settingsRepo.setActiveTimer(null);
    }
    set({ activeTimer: null });
    await cancelTimerNotification();
    void broadcastChanged();
  },

  buildBackup: async () => {
    // A backup must reflect what's on disk, so commit any running timer first.
    const state = get();
    if (state.activeTimer && !state.demoMode) {
      await commitActiveTimer(state.activeTimer, set);
      await settingsRepo.setActiveTimer(null);
      set({ activeTimer: null });
      await cancelTimerNotification();
    }
    return backupRepo.exportBackup();
  },
  restoreBackup: async (backup) => {
    if (get().activeTimer) {
      await settingsRepo.setActiveTimer(null);
      set({ activeTimer: null });
      await cancelTimerNotification();
    }
    await backupRepo.importBackup(backup);
    // Leaving demo mode behind avoids restoring into a preview session.
    liveBackup = null;
    set({ demoMode: false });
    await get().hydrate();
  },

  createInvoiceFromTasks: async (taskIds) => {
    if (!taskIds.length) return;
    let state = get();

    if (state.demoMode) {
      if (state.activeTimer && taskIds.includes(state.activeTimer.taskId)) {
        demoCommitActiveTimer(state.activeTimer, set);
        set({ activeTimer: null });
        await cancelTimerNotification();
        state = get();
      }
      const chosen = state.tasks.filter((t) => taskIds.includes(t.id));
      if (!chosen.length) return;
      const items = chosen.map((t) => ({
        id: newId(),
        invoiceId: '',
        title: t.title,
        projectName: projectNameFor(state.projects, t.projectId),
        minutes: t.minutes,
        amount: t.rateType === 'hourly' ? t.rate * (t.minutes / 60) : t.rate,
      }));
      const total = items.reduce((a, i) => a + i.amount, 0);
      const projectNames = [...new Set(chosen.map((t) => projectNameFor(state.projects, t.projectId)))];
      const invId = newId();
      items.forEach((i) => (i.invoiceId = invId));
      const invoice: Invoice = {
        id: invId,
        number: '#' + String(state.invoices.length + 1).padStart(5, '0'),
        projectName: projectNames.length > 1 ? 'Разные проекты' : projectNames[0],
        dayKey: todayKey(),
        status: 'awaiting',
        factual: null,
        total,
        items,
      };
      set((s) => ({
        invoices: [invoice, ...s.invoices],
        tasks: s.tasks.map((t) => (taskIds.includes(t.id) ? { ...t, status: 'done', updatedAt: new Date().toISOString() } : t)),
      }));
      return;
    }

    if (state.activeTimer && taskIds.includes(state.activeTimer.taskId)) {
      await commitActiveTimer(state.activeTimer, set);
      await settingsRepo.setActiveTimer(null);
      set({ activeTimer: null });
      await cancelTimerNotification();
      state = get();
    }
    const chosen = state.tasks.filter((t) => taskIds.includes(t.id));
    if (!chosen.length) return;
    const items = chosen.map((t) => ({
      title: t.title,
      projectName: projectNameFor(state.projects, t.projectId),
      minutes: t.minutes,
      amount: t.rateType === 'hourly' ? t.rate * (t.minutes / 60) : t.rate,
    }));
    const projectNames = [...new Set(chosen.map((t) => projectNameFor(state.projects, t.projectId)))];
    await invoicesRepo.createInvoice({
      projectName: projectNames.length > 1 ? 'Разные проекты' : projectNames[0],
      dayKey: todayKey(),
      items,
    });
    await tasksRepo.setTasksStatusBulk(taskIds, 'done');
    const [tasks, invoices] = await Promise.all([tasksRepo.listTasks(), invoicesRepo.listInvoices()]);
    set({ tasks, invoices });
  },
  setInvoiceStatus: async (id, status, factual) => {
    if (get().demoMode) {
      set((s) => ({
        invoices: s.invoices.map((v) => (v.id === id ? { ...v, status, factual: status === 'paid' ? factual : null } : v)),
      }));
      return;
    }
    await invoicesRepo.updateInvoiceStatus(id, status, status === 'paid' ? factual : null);
    const invoices = await invoicesRepo.listInvoices();
    set({ invoices });
  },
  deleteInvoice: async (id) => {
    if (get().demoMode) {
      set((s) => ({ invoices: s.invoices.filter((v) => v.id !== id) }));
      return;
    }
    await invoicesRepo.deleteInvoice(id);
    const invoices = await invoicesRepo.listInvoices();
    set({ invoices });
  },
}));

async function commitActiveTimer(timer: ActiveTimer, set: (patch: Partial<AppState>) => void): Promise<void> {
  const elapsed = Math.floor(timerElapsedMs(timer, Date.now()) / 60000);
  if (elapsed > 0) {
    await timeEntriesRepo.addMinutesToday(timer.taskId, elapsed);
  } else {
    await tasksRepo.touchTask(timer.taskId);
  }
  const tasks = await tasksRepo.listTasks();
  set({ tasks });
  await refreshTodayMinutes(set);
}

function demoCommitActiveTimer(
  timer: ActiveTimer,
  set: (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void
): void {
  const elapsed = Math.floor(timerElapsedMs(timer, Date.now()) / 60000);
  if (elapsed <= 0) return;
  set((s) => ({
    tasks: s.tasks.map((t) => (t.id === timer.taskId ? { ...t, minutes: t.minutes + elapsed, updatedAt: new Date().toISOString() } : t)),
    todayMinutes: s.todayMinutes + elapsed,
  }));
}

function projectNameFor(projects: Project[], id: string): string {
  return projects.find((p) => p.id === id)?.name ?? '—';
}
