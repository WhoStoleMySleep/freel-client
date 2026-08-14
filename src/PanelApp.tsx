import { useEffect, useMemo, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppStore } from './store/useAppStore';
import { useTimerTick } from './store/useTimerTick';
import { useResolvedTheme } from './hooks/useResolvedTheme';
import { lockPanel, onChanged } from './services/sync';
import { DASH_ORDER, STATUS } from './domain/status';
import { liveMinutesFor, taskAmount, timerElapsedMs } from './domain/earnings';
import { formatClock, formatMinutes } from './domain/time';
import { formatMoney } from './domain/money';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPause,
  IconPlay,
  IconStop,
} from './components/icons';

/**
 * The edge panel: a second window that slides in from the left so time can be
 * started and stopped without bringing the main window forward.
 *
 * It shares the database with the main window but not the store — each window
 * has its own JavaScript context — so it reloads whenever the other one
 * reports a change.
 */
export default function PanelApp() {
  const nowMs = useTimerTick();
  useResolvedTheme();

  const ready = useAppStore((s) => s.ready);
  const hydrate = useAppStore((s) => s.hydrate);
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const settings = useAppStore((s) => s.settings);
  const activeTimer = useAppStore((s) => s.activeTimer);
  const startTimer = useAppStore((s) => s.startTimer);
  const pauseTimer = useAppStore((s) => s.pauseTimer);
  const resumeTimer = useAppStore((s) => s.resumeTimer);
  const stopTimer = useAppStore((s) => s.stopTimer);
  const addTask = useAppStore((s) => s.addTask);
  const stepTaskStatus = useAppStore((s) => s.stepTaskStatus);

  // Indexed once per project change: the list below asks for a name per task,
  // which turned every render into a scan of the project list per row.
  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectName = (id: string) => projectNames.get(id) ?? '—';

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    hydrate().catch(() => {});
    // See App.tsx: the unsubscriber can arrive after cleanup has already run.
    let un: (() => void) | undefined;
    let cancelled = false;
    onChanged(() => hydrate().catch(() => {})).then((fn) => (cancelled ? fn() : (un = fn)));
    return () => {
      cancelled = true;
      un?.();
    };
  }, [hydrate]);

  const liveProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  useEffect(() => {
    if (!projectId && liveProjects[0]) setProjectId(liveProjects[0].id);
  }, [liveProjects, projectId]);

  // Same grouping and order as the dashboard, so the two views never disagree.
  const groups = useMemo(() => {
    const listTasks = tasks.filter((t) => t.status !== 'done');
    return DASH_ORDER.map((key) => ({
      key,
      label: STATUS[key].label,
      color: STATUS[key].color,
      tasks: listTasks.filter((t) => t.status === key),
    })).filter((g) => g.tasks.length > 0);
  }, [tasks]);

  const taskCount = useMemo(() => tasks.filter((t) => t.status !== 'done').length, [tasks]);

  const running = activeTimer ? tasks.find((t) => t.id === activeTimer.taskId) : undefined;

  const submit = async () => {
    const name = title.trim();
    if (!name || !projectId) return;
    setTitle('');
    await addTask({
      projectId,
      title: name,
      description: '',
      link: '',
      rateType: 'hourly',
      rate: settings.defaultRate,
      status: 'next',
      initialMinutes: 0,
    });
  };

  if (!ready) {
    return (
      <div className="panel">
        <div className="panel-empty">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-brand">freel</span>
        <button className="panel-close" onClick={() => getCurrentWindow().hide()} aria-label="Скрыть">
          ✕
        </button>
      </div>

      {activeTimer && running ? (
        <div className="panel-timer">
          <div className="panel-timer-title">{running.title}</div>
          <div className="panel-timer-clock num">
            {formatClock(Math.floor(timerElapsedMs(activeTimer, nowMs) / 1000))}
          </div>
          <div className="panel-timer-btns">
            <button className="panel-btn" onClick={() => (activeTimer.paused ? resumeTimer() : pauseTimer())}>
              {activeTimer.paused ? <IconPlay /> : <IconPause />}
              {activeTimer.paused ? 'Продолжить' : 'Пауза'}
            </button>
            <button className="panel-btn danger" onClick={() => stopTimer()}>
              <IconStop />
              Стоп
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel-add">
        <input
          className="panel-input"
          value={title}
          placeholder="Новая задача"
          onChange={(e) => setTitle(e.target.value)}
          // Auto-hide must stand down while typing, or moving the mouse away
          // would close the panel and throw the half-written task away.
          onFocus={() => void lockPanel(true)}
          onBlur={() => void lockPanel(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <button className="panel-add-btn" onClick={() => void submit()} disabled={!title.trim() || !projectId}>
          +
        </button>
      </div>
      {liveProjects.length > 1 ? (
        <select className="panel-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {liveProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="panel-list scr">
        {taskCount === 0 ? <div className="panel-empty">Активных задач нет</div> : null}
        {groups.map((g) => (
          <div className="panel-group" key={g.key}>
            <div className="panel-group-head">
              <span className="panel-dot" style={{ background: g.color }} />
              <span className="panel-group-label">{g.label}</span>
              <span className="panel-group-count">{g.tasks.length}</span>
            </div>
            {g.tasks.map((t) => {
              const isRunning = activeTimer?.taskId === t.id;
              const minutes = liveMinutesFor(t, activeTimer, nowMs);
              return (
                <div className={isRunning ? 'panel-task running' : 'panel-task'} key={t.id}>
                  <div className="panel-task-top">
                    <div className="panel-task-title">{t.title}</div>
                    <div className="panel-task-amount num">
                      {formatMoney(taskAmount(t, minutes), settings.currency)}
                    </div>
                  </div>
                  <div className="panel-task-meta">
                    {projectName(t.projectId)} · {formatMinutes(minutes)}
                  </div>
                  <div className="panel-task-controls">
                    <button
                      className="panel-step"
                      onClick={() => stepTaskStatus(t.id, -1)}
                      aria-label="Предыдущий статус"
                    >
                      <IconChevronLeft />
                    </button>
                    <button
                      className={isRunning ? 'panel-timer-btn running' : 'panel-timer-btn'}
                      onClick={() => (isRunning ? stopTimer() : startTimer(t.id))}
                    >
                      {isRunning ? <IconStop /> : <IconPlay />}
                      {isRunning ? 'Остановить' : 'Запустить'}
                    </button>
                    <button
                      className="panel-step"
                      onClick={() => stepTaskStatus(t.id, 1)}
                      aria-label="Следующий статус"
                    >
                      <IconChevronRight />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
