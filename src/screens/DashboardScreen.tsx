import { useMemo, useState } from 'react';
import { TaskFormModal } from '../modals/TaskFormModal';
import { DoneTasksModal } from '../modals/DoneTasksModal';
import { SettingsModal } from '../modals/SettingsModal';
import { useAppStore } from '../store/useAppStore';
import { useTimerTick } from '../store/useTimerTick';
import { COUNTED_STATUSES, DASH_ORDER, EARNED_STATUSES, STATUS } from '../domain/status';
import { liveMinutesFor, taskAmount } from '../domain/earnings';
import { formatMinutes } from '../domain/time';
import { formatMoney } from '../domain/money';
import { CURRENCY_SYMBOL, nextCurrency } from '../domain/currency';
import { dayKeyFromIso, greeting, todayKey } from '../utils/date';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconMoon,
  IconPause,
  IconPlay,
  IconSettings,
  IconSun,
} from '../components/icons';

type ModalState = { type: 'add' } | { type: 'edit'; taskId: string } | { type: 'done' } | { type: 'settings' } | null;

export function DashboardScreen({ isDark, onReplayOnboarding }: { isDark: boolean; onReplayOnboarding: () => void }) {
  const nowMs = useTimerTick();
  const [modal, setModal] = useState<ModalState>(null);
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const activeTimer = useAppStore((s) => s.activeTimer);
  const settings = useAppStore((s) => s.settings);
  const todayMinutesBase = useAppStore((s) => s.todayMinutes);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const stepTaskStatus = useAppStore((s) => s.stepTaskStatus);
  const startTimer = useAppStore((s) => s.startTimer);
  const stopTimer = useAppStore((s) => s.stopTimer);

  // See PanelApp: one index beats a scan per rendered task row.
  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectName = (id: string) => projectNames.get(id) ?? '—';

  const stats = useMemo(() => {
    const now = new Date();
    const inCurMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };

    const listTasks = tasks.filter((t) => t.status !== 'done');
    // Outstanding money vs money earned: invoicing a task moves it out of the
    // first set but must leave the second alone.
    const outstanding = tasks.filter((t) => COUNTED_STATUSES.includes(t.status));
    const earned = tasks.filter((t) => EARNED_STATUSES.includes(t.status));

    const earnedTotal = outstanding.reduce((a, t) => a + taskAmount(t, liveMinutesFor(t, activeTimer, nowMs)), 0);
    const hoursTotal = tasks.reduce((a, t) => a + liveMinutesFor(t, activeTimer, nowMs), 0);
    const earnedMonth = earned
      .filter((t) => inCurMonth(t.createdAt))
      .reduce((a, t) => a + taskAmount(t, liveMinutesFor(t, activeTimer, nowMs)), 0);
    const hoursMonth = tasks
      .filter((t) => inCurMonth(t.createdAt))
      .reduce((a, t) => a + liveMinutesFor(t, activeTimer, nowMs), 0);

    const earnedToday = earned
      .filter((t) => dayKeyFromIso(t.updatedAt) === todayKey())
      .reduce((a, t) => a + taskAmount(t, liveMinutesFor(t, activeTimer, nowMs)), 0);
    const createdToday = tasks.filter((t) => dayKeyFromIso(t.createdAt) === todayKey()).length;
    const runningMinutes = activeTimer
      ? Math.max(0, Math.floor((nowMs - new Date(activeTimer.startedAt).getTime()) / 60000))
      : 0;
    const timeToday = todayMinutesBase + (activeTimer?.paused ? 0 : runningMinutes);

    const groups = DASH_ORDER.map((key) => ({
      key,
      label: STATUS[key].label,
      color: STATUS[key].color,
      tasks: listTasks.filter((t) => t.status === key),
    })).filter((g) => g.tasks.length > 0);

    return {
      earnedTotal,
      hoursTotal,
      earnedMonth,
      hoursMonth,
      earnedToday,
      createdToday,
      timeToday,
      groups,
      listCount: listTasks.length,
      doneCount: tasks.filter((t) => t.status === 'done').length,
    };
  }, [tasks, activeTimer, nowMs, todayMinutesBase]);

  const hasProjects = projects.some((p) => !p.archived);

  return (
    <div className="screen scr">
      <div className="header">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1 className="h1">Дашборд</h1>
        </div>
        <div className="header-btns">
          <button className="icon-btn" onClick={() => setCurrency(nextCurrency(settings.currency))}>
            {CURRENCY_SYMBOL[settings.currency]}
          </button>
          <button className="icon-btn" onClick={() => setThemeMode(isDark ? 'light' : 'dark')}>
            {isDark ? <IconMoon size={15} /> : <IconSun size={15} />}
          </button>
          <button className="icon-btn" onClick={() => setModal({ type: 'settings' })}>
            <IconSettings size={17} />
          </button>
        </div>
      </div>

      <div className="hero">
        <div className="hero-inner">
          <div className="hero-label">Заработано · к оплате</div>
          <div className="hero-total num">{formatMoney(stats.earnedTotal, settings.currency)}</div>
          <div className="hero-hours">
            <b>
              <IconClock size={13} color="#43d6a0" /> {formatMinutes(stats.hoursTotal)}
            </b>
            <span>всего отработано</span>
          </div>
          <div className="hero-divider" />
          <div className="hero-row">
            <div>
              <div className="hero-sub-label">За текущий месяц</div>
              <div className="hero-sub-value num">{formatMoney(stats.earnedMonth, settings.currency)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hero-sub-label">Часов за месяц</div>
              <div className="hero-sub-value num">{formatMinutes(stats.hoursMonth)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-head">
        <span className="dot" />
        <span className="section-title">Сегодня</span>
        <span className="section-note">00:00 – 23:59</span>
      </div>
      <div className="tiles">
        <div className="tile">
          <div className="tile-value num">{formatMoney(stats.earnedToday, settings.currency)}</div>
          <div className="tile-label">Заработано</div>
        </div>
        <div className="tile">
          <div className="tile-value num">{stats.createdToday}</div>
          <div className="tile-label">Создано задач</div>
        </div>
        <div className="tile">
          <div className="tile-value num">{formatMinutes(stats.timeToday)}</div>
          <div className="tile-label">Отработано</div>
        </div>
      </div>

      <div className="tasks-head">
        <div className="tasks-title-row">
          <span className="tasks-title">Задачи</span>
          <span className="tasks-count">{stats.listCount}</span>
        </div>
        <div className="header-btns">
          <button className="done-btn" onClick={() => setModal({ type: 'done' })}>
            <IconCheck size={11} /> Готово {stats.doneCount}
          </button>
          <button className="add-btn" onClick={() => setModal({ type: 'add' })}>
            +
          </button>
        </div>
      </div>

      {stats.groups.map((g) => (
        <div className="group" key={g.key}>
          <div className="group-head">
            <span className="group-dot" style={{ background: g.color }} />
            <span className="group-label">{g.label}</span>
            <span className="group-count">{g.tasks.length}</span>
          </div>
          <div className="group-list">
            {g.tasks.map((t) => {
              const liveMinutes = liveMinutesFor(t, activeTimer, nowMs);
              const running = activeTimer?.taskId === t.id;
              return (
                <div className="task" key={t.id}>
                  <span className="task-bar" style={{ background: STATUS[t.status].color }} />
                  <div onClick={() => setModal({ type: 'edit', taskId: t.id })}>
                  <div className="task-top">
                    <div className="task-title">{t.title}</div>
                    <div className="task-amount num">{formatMoney(taskAmount(t, liveMinutes), settings.currency)}</div>
                  </div>
                  <div className="task-meta">
                    <span>{projectName(t.projectId)}</span>
                    <span className="sep" />
                    <span>{t.rateType === 'hourly' ? 'Почасовая' : 'Фикс'}</span>
                    <span className="sep" />
                    <span className="with-icon">
                      <IconClock size={11} /> {formatMinutes(liveMinutes)}
                    </span>
                  </div>
                  </div>
                  <div className="task-controls">
                    <button className="step-btn" onClick={() => stepTaskStatus(t.id, -1)}>
                      <IconChevronLeft size={14} />
                    </button>
                    <button
                      className={running ? 'timer-btn running' : 'timer-btn'}
                      onClick={() => (running ? stopTimer() : startTimer(t.id))}
                    >
                      {running ? <IconPause size={11} /> : <IconPlay size={11} />}
                      {running ? 'Остановить' : 'Запустить таймер'}
                    </button>
                    <button className="step-btn" onClick={() => stepTaskStatus(t.id, 1)}>
                      <IconChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {stats.listCount === 0 ? (
        <div className="empty">
          <div className="empty-title">{hasProjects ? 'Пока нет задач' : 'Начните с проекта'}</div>
          <p className="empty-text">
            {hasProjects
              ? 'Нажмите «+» рядом со списком, чтобы добавить первую задачу.'
              : 'Создайте первый проект во вкладке «Проекты», а затем добавьте задачу.'}
          </p>
        </div>
      ) : null}

      <TaskFormModal
        open={modal?.type === 'add' || modal?.type === 'edit'}
        mode={modal?.type === 'edit' ? 'edit' : 'add'}
        taskId={modal?.type === 'edit' ? modal.taskId : null}
        onClose={() => setModal(null)}
      />
      <DoneTasksModal open={modal?.type === 'done'} onClose={() => setModal(null)} />
      <SettingsModal
        open={modal?.type === 'settings'}
        onClose={() => setModal(null)}
        onReplayOnboarding={() => {
          setModal(null);
          onReplayOnboarding();
        }}
      />
    </div>
  );
}
