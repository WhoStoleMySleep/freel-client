import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A short-lived value that resets itself after `ms`.
 *
 * The pending timer is cancelled when the component goes away: modals here are
 * routinely closed before the notice expires, and a surviving timer would both
 * hold the component's closure and set state on something already unmounted.
 * A second flash replaces the first rather than stacking timers.
 */
export function useFlash<T>(idle: T, ms: number): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(idle);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef(idle);
  idleRef.current = idle;

  const flash = useCallback(
    (next: T) => {
      if (timer.current) clearTimeout(timer.current);
      setValue(next);
      // Flashing the idle value is a plain reset — there is nothing to undo.
      if (Object.is(next, idleRef.current)) return;
      timer.current = setTimeout(() => setValue(idleRef.current), ms);
    },
    [ms]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return [value, flash];
}
