import { IconCheck } from './icons';

export type MarkState = 'none' | 'some' | 'all';

export function markStateOf(selected: number, total: number): MarkState {
  if (selected === 0 || total === 0) return 'none';
  return selected === total ? 'all' : 'some';
}

/** Tri-state tick used by the row, group and master selectors in both generators. */
export function SelectBox({ state, big }: { state: MarkState; big?: boolean }) {
  const cls = ['checkbox', big && 'big', state === 'all' && 'all', state === 'some' && 'some'].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {state === 'all' ? <IconCheck size={big ? 12 : 11} color="#fff" /> : null}
      {state === 'some' ? <span className="checkbox-dash" /> : null}
    </span>
  );
}
