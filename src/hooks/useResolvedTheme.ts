import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

/** Resolves the effective light/dark mode and stamps it on <html>. */
export function useResolvedTheme(): boolean {
  const themeMode = useAppStore((s) => s.settings.themeMode);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = themeMode === 'system' ? systemDark : themeMode === 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return isDark;
}
