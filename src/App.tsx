import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { useResolvedTheme } from './hooks/useResolvedTheme';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { BillingScreen } from './screens/BillingScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { listenTimerActions } from './notifications/timerNotification';
import { IconTabBilling, IconTabDash, IconTabProjects } from './components/icons';
import { APP_TITLE, isDesktopApp, setWindowTitle } from './services/windowTitle';
import { onChanged } from './services/sync';
import { formatClock } from './domain/time';

const MIN_SPLASH_MS = 2400;
type Tab = 'dash' | 'projects' | 'billing';
type Phase = 'loading' | 'onboarding' | 'app';
/** Mirrors the running timer into the window title, desktop's status bar. */
function useTimerInWindowTitle() {
  const activeTimer = useAppStore((s) => s.activeTimer);
  // Only the running task's title belongs in the title bar. Subscribing to the
  // whole task list would tear down and rebuild the interval on every sync,
  // since each hydrate hands out a freshly built array.
  const name = useAppStore(
    (s) => (s.activeTimer ? s.tasks.find((t) => t.id === s.activeTimer!.taskId)?.title : undefined) ?? 'Задача'
  );

  useEffect(() => {
    if (!isDesktopApp()) return;
    if (!activeTimer) {
      setWindowTitle(APP_TITLE);
      return;
    }
    const render = () => {
      const ms =
        activeTimer.accumulatedMs +
        (activeTimer.paused ? 0 : Date.now() - new Date(activeTimer.startedAt).getTime());
      const clock = formatClock(Math.floor(ms / 1000));
      const suffix = activeTimer.paused ? ' (пауза)' : '';
      setWindowTitle(`${clock}${suffix} · ${name} — ${APP_TITLE}`);
    };
    render();
    if (activeTimer.paused) return;
    const id = setInterval(render, 1000);
    return () => clearInterval(id);
  }, [activeTimer, name]);
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const hydrate = useAppStore((s) => s.hydrate);
  const hasOnboarded = useAppStore((s) => s.settings.hasOnboarded);
  const [phase, setPhase] = useState<Phase>('loading');
  const [minElapsed, setMinElapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dash');
  const isDark = useResolvedTheme();
  useTimerInWindowTitle();

  useEffect(() => {
    hydrate().catch((e) => setError(String(e)));
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [hydrate]);

  // The panel and the auto-sync loop both write to the database behind this
  // window's back; re-read whenever either reports a change.
  useEffect(() => {
    // The subscription resolves a tick later than the cleanup can run, so the
    // unsubscriber has to be applied retroactively — otherwise an unmount that
    // beats the promise leaks a listener that fires for the rest of the session.
    let un: (() => void) | undefined;
    let cancelled = false;
    onChanged(() => {
      useAppStore.getState().hydrate().catch(() => {});
    }).then((fn) => (cancelled ? fn() : (un = fn)));
    return () => {
      cancelled = true;
      un?.();
    };
  }, []);

  // Notification buttons act on the store directly.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listenTimerActions({
      onPause: () => useAppStore.getState().pauseTimer(),
      onResume: () => useAppStore.getState().resumeTimer(),
      onStop: () => useAppStore.getState().stopTimer(),
    }).then((fn) => (cancelled ? fn() : (unlisten = fn)));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (phase === 'loading' && ready && minElapsed) {
      setPhase(hasOnboarded ? 'app' : 'onboarding');
    }
  }, [phase, ready, minElapsed, hasOnboarded]);

  if (error) {
    return (
      <div className="screen">
        <div className="empty">
          <div className="empty-title">Ошибка запуска</div>
          <p className="empty-text">{error}</p>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="loading">
        <div className="wordmark">freel</div>
        <div className="loading-sub">УЧЁТ ЧАСОВ И СЧЕТОВ ДЛЯ ФРИЛАНСЕРА</div>
      </div>
    );
  }

  if (phase === 'onboarding') {
    return <OnboardingScreen onFinish={() => setPhase('app')} />;
  }

  return (
    <div className="app">
      {tab === 'dash' ? <DashboardScreen isDark={isDark} onReplayOnboarding={() => setPhase('onboarding')} /> : null}
      {tab === 'projects' ? <ProjectsScreen /> : null}
      {tab === 'billing' ? <BillingScreen /> : null}

      <nav className="tabbar">
        <div className="sidebar-brand">freel</div>
        <button className={tab === 'dash' ? 'tab active' : 'tab'} onClick={() => setTab('dash')}>
          <IconTabDash />
          Главная
        </button>
        <button className={tab === 'projects' ? 'tab active' : 'tab'} onClick={() => setTab('projects')}>
          <IconTabProjects />
          Проекты
        </button>
        <button className={tab === 'billing' ? 'tab active' : 'tab'} onClick={() => setTab('billing')}>
          <IconTabBilling />
          Счета
        </button>
      </nav>
    </div>
  );
}
