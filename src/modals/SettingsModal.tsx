import { useEffect, useState } from 'react';
import { useFlash } from '../hooks/useFlash';
import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Chip, Field, Switch } from '../components/Field';
import { useAppStore } from '../store/useAppStore';
import { CURRENCIES } from '../domain/currency';
import { ThemeMode } from '../domain/types';
import { summarize } from '../domain/backup';
import { pickBackup, saveBackup } from '../services/backupFile';
import { SyncStatus, syncLogin, syncLogout, syncNow, syncRegister, syncStatus } from '../services/syncApi';
import { shortDate } from '../utils/date';

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'Системная' },
  { mode: 'dark', label: 'Тёмная' },
  { mode: 'light', label: 'Светлая' },
];

export function SettingsModal({ open, onClose, onReplayOnboarding }: { open: boolean; onClose: () => void; onReplayOnboarding: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const setDefaultRate = useAppStore((s) => s.setDefaultRate);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const setCompactTaskForm = useAppStore((s) => s.setCompactTaskForm);
  const demoMode = useAppStore((s) => s.demoMode);
  const toggleDemoMode = useAppStore((s) => s.toggleDemoMode);
  const buildBackup = useAppStore((s) => s.buildBackup);
  const restoreBackup = useAppStore((s) => s.restoreBackup);
  const hydrate = useAppStore((s) => s.hydrate);
  const [rateStr, setRateStr] = useState(String(settings.defaultRate));
  const [busy, setBusy] = useState<'export' | 'import' | 'login' | 'register' | 'sync' | null>(null);
  const [notice, flash] = useFlash<string | null>(null, 4000);

  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [syncNotice, flashSync] = useFlash<string | null>(null, 5000);
  const canAuth = url.trim().length > 8 && email.includes('@') && password.length >= 8;

  useEffect(() => {
    if (open) setRateStr(String(settings.defaultRate));
  }, [open, settings.defaultRate]);

  useEffect(() => {
    if (!open) return;
    syncStatus()
      .then((s) => {
        setSync(s);
        if (s.url) setUrl(s.url);
        if (s.email) setEmail(s.email);
      })
      .catch(() => setSync(null));
  }, [open]);

  const refreshSync = async () => setSync(await syncStatus().catch(() => null));

  const doRegister = async () => {
    setBusy('register');
    try {
      await syncRegister(url.trim(), email.trim(), password);
      flashSync('Аккаунт создан, теперь войдите');
    } catch (e) {
      flashSync(String(e));
    } finally {
      setBusy(null);
    }
  };

  const doLogin = async () => {
    setBusy('login');
    try {
      await syncLogin(url.trim(), email.trim(), password);
      setPassword('');
      await refreshSync();
      flashSync('Подключено');
    } catch (e) {
      flashSync(String(e));
    } finally {
      setBusy(null);
    }
  };

  const doLogout = async () => {
    await syncLogout().catch(() => {});
    await refreshSync();
    flashSync('Отключено. Данные остались на устройстве.');
  };

  const doSync = async () => {
    setBusy('sync');
    try {
      const res = await syncNow();
      // The merge rewrote rows underneath the store, so it has to re-read.
      await hydrate();
      await refreshSync();
      flashSync(`Обмен завершён: отправлено ${res.sent}, получено ${res.received}`);
    } catch (e) {
      flashSync(String(e));
    } finally {
      setBusy(null);
    }
  };

  const doBackup = async () => {
    setBusy('export');
    try {
      const backup = await buildBackup();
      const res = await saveBackup(backup);
      if (res.status === 'saved') flash('Копия сохранена');
    } catch (e) {
      flash('Не получилось сохранить: ' + String(e));
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setBusy('import');
    try {
      const picked = await pickBackup();
      if (picked.status === 'cancelled') return;
      if (picked.status === 'error') {
        flash(picked.message);
        return;
      }
      const s = summarize(picked.backup);
      const ok = confirm(
        `В копии: проектов — ${s.projects}, задач — ${s.tasks}, счетов — ${s.invoices}.\n` +
          `Создана: ${shortDate(s.exportedAt.slice(0, 10))}.\n\n` +
          'Текущие данные будут полностью заменены. Отменить это будет нельзя.'
      );
      if (!ok) return;
      await restoreBackup(picked.backup);
      flash('Данные восстановлены');
      onClose();
    } catch (e) {
      flash('Не получилось восстановить: ' + String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title="Настройки" onClose={onClose} />
        <div className="stack" style={{ gap: 16 }}>
          <div className="card-box">
            <div className="card-label" style={{ marginBottom: 6 }}>
              Стоимость часа по умолчанию
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field
                  value={rateStr}
                  onChange={(v) => {
                    setRateStr(v);
                    const n = parseFloat(v);
                    setDefaultRate(Number.isFinite(n) ? n : 0);
                  }}
                  numeric
                />
              </div>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--dim)' }}>{settings.currency}/ч</span>
            </div>
            <p className="card-note">Подставляется как ставка при создании новой почасовой задачи.</p>
          </div>

          <div>
            <span className="field-label">Валюта</span>
            <div className="chips">
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={settings.currency === c} onClick={() => setCurrency(c)} />
              ))}
            </div>
          </div>

          <div>
            <span className="field-label">Тема</span>
            <div className="chips">
              {THEME_OPTIONS.map((o) => (
                <Chip key={o.mode} label={o.label} active={settings.themeMode === o.mode} onClick={() => setThemeMode(o.mode)} grow />
              ))}
            </div>
          </div>

          <div className="card-box">
            <div className="switch-row">
              <div className="switch-text">
                <div className="card-label">Компактное добавление задач</div>
                <p className="card-note" style={{ marginTop: 4 }}>
                  В форме новой задачи скрываются ставка, тип ставки и время. Статус сразу «Далее».
                </p>
              </div>
              <Switch on={settings.compactTaskForm} onToggle={() => setCompactTaskForm(!settings.compactTaskForm)} />
            </div>
          </div>

          <div className="card-box">
            <div className="switch-row">
              <div className="switch-text">
                <div className="card-label">Демо-данные</div>
                <p className="card-note" style={{ marginTop: 4 }}>
                  Показать приложение с примерами проектов и задач. Ваши реальные данные не изменяются и вернутся как были.
                </p>
              </div>
              <Switch on={demoMode} onToggle={() => toggleDemoMode()} />
            </div>
            {demoMode ? <div className="badge-info">Сейчас показаны демо-данные</div> : null}
          </div>

          <div className="card-box">
            <div className="card-label">Резервная копия</div>
            <p className="card-note" style={{ marginBottom: 12 }}>
              Все проекты, задачи, время и счета одним файлом. Восстановление полностью заменяет текущие данные.
            </p>
            <div className="btn-row">
              <button className="btn-secondary" disabled={busy !== null} onClick={doBackup}>
                {busy === 'export' ? 'Готовим…' : 'Сохранить копию'}
              </button>
              <button className="btn-secondary" disabled={busy !== null} onClick={doRestore}>
                {busy === 'import' ? 'Читаем…' : 'Восстановить'}
              </button>
            </div>
            {notice ? <div className="badge-info">{notice}</div> : null}
          </div>

          <div className="card-box">
            <div className="card-label">Синхронизация</div>
            {sync?.connected ? (
              <>
                <p className="card-note" style={{ marginBottom: 12 }}>
                  {sync.email} · {sync.url}
                  <br />
                  {sync.lastSyncAt ? `Последний обмен: ${sync.lastSyncAt.slice(0, 16).replace('T', ' ')}` : 'Обмена ещё не было'}
                </p>
                <div className="btn-row">
                  <button className="btn-secondary" disabled={busy !== null} onClick={doSync}>
                    {busy === 'sync' ? 'Обмен…' : 'Синхронизировать'}
                  </button>
                  <button className="btn-secondary" disabled={busy !== null} onClick={doLogout}>
                    Отключить
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="card-note" style={{ marginBottom: 10 }}>
                  Данные останутся на устройстве. Аккаунт нужен только чтобы держать их
                  одинаковыми на телефоне и компьютере.
                </p>
                <div className="stack" style={{ gap: 8 }}>
                  <Field value={url} onChange={setUrl} placeholder="https://адрес-сервера" />
                  <Field value={email} onChange={setEmail} placeholder="Почта" />
                  <Field value={password} onChange={setPassword} placeholder="Пароль" secure />
                </div>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn-secondary" disabled={busy !== null || !canAuth} onClick={doLogin}>
                    {busy === 'login' ? 'Вход…' : 'Войти'}
                  </button>
                  <button className="btn-secondary" disabled={busy !== null || !canAuth} onClick={doRegister}>
                    {busy === 'register' ? 'Создаём…' : 'Создать аккаунт'}
                  </button>
                </div>
              </>
            )}
            {syncNotice ? <div className="badge-info">{syncNotice}</div> : null}
          </div>

          <button className="btn-secondary" style={{ width: '100%' }} onClick={onReplayOnboarding}>
            Показать экраны запуска заново
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
