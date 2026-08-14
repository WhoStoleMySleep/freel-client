import { useLayoutEffect, useRef } from 'react';

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  dotColor?: string;
  small?: boolean;
  grow?: boolean;
}

export function Chip({ label, active, onClick, dotColor, small, grow }: ChipProps) {
  const cls = ['chip', small && 'small', grow && 'grow', active && 'active'].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={onClick}>
      {dotColor ? <span className="chip-dot" style={{ background: dotColor }} /> : null}
      {label}
    </button>
  );
}

interface FieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  accent?: boolean;
  /** Masks the value — used for the sync account password. */
  secure?: boolean;
}

export function Field({ label, value, onChange, placeholder, multiline, numeric, accent, secure }: FieldProps) {
  const cls = ['input', numeric && 'num', accent && 'accent'].filter(Boolean).join(' ');
  return (
    <label style={{ display: 'block' }}>
      {label ? <span className="field-label">{label}</span> : null}
      {multiline ? (
        <GrowingArea className={cls} value={value} placeholder={placeholder} onChange={onChange} />
      ) : (
        <input
          className={cls}
          value={value}
          placeholder={placeholder}
          type={secure ? 'password' : undefined}
          inputMode={numeric ? 'decimal' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

interface AreaProps {
  className: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}

/**
 * A description field that grows downwards instead of scrolling.
 *
 * Height is driven by the content: reset to `auto`, then set to the element's
 * own `scrollHeight` — the only way to make a textarea shrink again after text
 * is deleted.
 */
function GrowingArea({ className, value, placeholder, onChange }: AreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // `box-sizing: border-box` is global here, so the height being set has to
    // include the borders — `scrollHeight` alone leaves the last line clipped.
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borders}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button className={on ? 'switch on' : 'switch'} onClick={onToggle} aria-pressed={on} />;
}
