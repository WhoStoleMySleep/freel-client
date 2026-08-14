import { useEffect, useState } from 'react';
import { useAppStore } from './useAppStore';

/**
 * Current time for live elapsed/amount rendering, advancing once a second
 * while a timer actually runs.
 *
 * The value is held in state rather than read from `Date.now()` on every call:
 * a fresh timestamp per render would change the identity of every `useMemo`
 * that depends on it, so the dashboard would recompute all of its totals on
 * unrelated renders too. A paused timer contributes no live time (see
 * `timerElapsedMs`), so it is left frozen instead of ticking.
 */
export function useTimerTick(): number {
  const ticking = useAppStore((s) => !!s.activeTimer && !s.activeTimer.paused);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id !== null) return;
      // Resuming — after a pause or after the window comes back — must not
      // leave the stale clock on screen for up to a second.
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };

    // A hidden window — the concealed edge panel, or a minimised app — is
    // re-rendered every second for nobody. The clock catches up on return.
    const onVisibility = () => (document.hidden ? stop() : start());
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [ticking]);

  return now;
}
