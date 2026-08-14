import { useState } from 'react';
import { Chip, Field } from '../components/Field';
import { LogoMark } from '../components/icons';
import { useAppStore } from '../store/useAppStore';
import { CURRENCIES } from '../domain/currency';
import { ThemeMode } from '../domain/types';

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'Системная' },
  { mode: 'dark', label: 'Тёмная' },
  { mode: 'light', label: 'Светлая' },
];

export function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const settings = useAppStore((s) => s.settings);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const setDefaultRate = useAppStore((s) => s.setDefaultRate);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [rateStr, setRateStr] = useState(String(settings.defaultRate));

  const finish = () => {
    completeOnboarding();
    onFinish();
  };

  return (
    <div className="onb">
      <div className="onb-top">
        {step === 1 ? (
          <button className="onb-skip" onClick={finish}>
            Пропустить
          </button>
        ) : null}
      </div>

      {step === 1 ? (
        <div className="onb-step1">
          <div className="onb-logo">
            <LogoMark size={62} />
          </div>
          <h1 className="onb-h1">
            Добро пожаловать
            <br />в freel
          </h1>
          <p className="onb-p">
            Считайте отработанные часы, ведите задачи по статусам и генерируйте счета — полностью офлайн, ничего лишнего.
          </p>
        </div>
      ) : (
        <div className="onb-step2">
          <h2 className="onb-h2">Базовые настройки</h2>
          <p className="onb-p2">Их всегда можно изменить в разделе «Настройки».</p>

          <div className="onb-section">
            <div className="onb-label">Валюта</div>
            <div className="chips" style={{ gap: 8 }}>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={settings.currency === c} onClick={() => setCurrency(c)} />
              ))}
            </div>
          </div>

          <div className="onb-section">
            <div className="onb-label">Стоимость часа по умолчанию</div>
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

          <div className="onb-section">
            <div className="onb-label">Тема оформления</div>
            <div className="chips" style={{ gap: 8 }}>
              {THEME_OPTIONS.map((o) => (
                <Chip key={o.mode} label={o.label} active={settings.themeMode === o.mode} onClick={() => setThemeMode(o.mode)} grow />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="onb-footer">
        <div className="onb-dots">
          <span className={step === 1 ? 'onb-dot active' : 'onb-dot'} />
          <span className={step === 2 ? 'onb-dot active' : 'onb-dot'} />
        </div>
        <button className="onb-next" onClick={() => (step === 1 ? setStep(2) : finish())}>
          {step === 1 ? 'Начать' : 'Готово, к работе'}
        </button>
      </div>
    </div>
  );
}
