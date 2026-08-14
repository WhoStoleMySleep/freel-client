import { useEffect, useMemo, useState } from 'react';
import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Chip } from '../components/Field';
import { IconCheck, IconClock } from '../components/icons';
import { useAppStore } from '../store/useAppStore';
import { formatMinutes } from '../domain/time';
import { formatMoney } from '../domain/money';
import { taskAmount } from '../domain/earnings';
import { Task } from '../domain/types';

type MarkState = 'none' | 'some' | 'all';

function markStateOf(selected: number, total: number): MarkState {
  if (selected === 0 || total === 0) return 'none';
  return selected === total ? 'all' : 'some';
}

function SelectBox({ state, big }: { state: MarkState; big?: boolean }) {
  const cls = ['checkbox', big && 'big', state === 'all' && 'all', state === 'some' && 'some'].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {state === 'all' ? <IconCheck size={big ? 12 : 11} color="#fff" /> : null}
      {state === 'some' ? <span className="checkbox-dash" /> : null}
    </span>
  );
}

export function GenerateInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const currency = useAppStore((s) => s.settings.currency);
  const createInvoiceFromTasks = useAppStore((s) => s.createInvoiceFromTasks);

  const waitingTasks = useMemo(() => tasks.filter((t) => t.status === 'waiting_payment'), [tasks]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterProjectId, setFilterProjectId] = useState('');

  useEffect(() => {
    if (open) {
      setSelected(new Set(waitingTasks.map((t) => t.id)));
      setFilterProjectId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—';
  const visibleTasks = waitingTasks.filter((t) => !filterProjectId || t.projectId === filterProjectId);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byProject = new Map<string, Task[]>();
    for (const t of visibleTasks) {
      if (!byProject.has(t.projectId)) {
        byProject.set(t.projectId, []);
        order.push(t.projectId);
      }
      byProject.get(t.projectId)!.push(t);
    }
    return order.map((pid) => ({ projectId: pid, name: projectName(pid), tasks: byProject.get(pid)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTasks, projects]);

  const setMany = (ids: string[], value: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });

  const visibleSelected = visibleTasks.filter((t) => selected.has(t.id)).length;
  const masterState = markStateOf(visibleSelected, visibleTasks.length);
  const selectedTasks = waitingTasks.filter((t) => selected.has(t.id));
  const selTotal = selectedTasks.reduce((a, t) => a + taskAmount(t, t.minutes), 0);

  const create = () => {
    if (!selectedTasks.length) return;
    createInvoiceFromTasks(selectedTasks.map((t) => t.id));
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title="Новый счёт" onClose={onClose} />
        <p className="modal-hint">Задачи со статусом «Ожидает оплаты», сгруппированы по проектам. Пустой фильтр = все.</p>

        <div className="chips" style={{ gap: 5, marginBottom: 12 }}>
          <Chip label="Все" active={filterProjectId === ''} onClick={() => setFilterProjectId('')} small />
          {projects
            .filter((p) => !p.archived)
            .map((p) => (
              <Chip key={p.id} label={p.name} active={filterProjectId === p.id} onClick={() => setFilterProjectId(p.id)} small />
            ))}
        </div>

        {visibleTasks.length > 0 && (
          <button className="master-row" onClick={() => setMany(visibleTasks.map((t) => t.id), masterState !== 'all')}>
            <SelectBox state={masterState} big />
            <span className="master-label">{masterState === 'all' ? 'Снять выбор со всех' : 'Выбрать все'}</span>
            <span className="counter">
              {visibleSelected}/{visibleTasks.length}
            </span>
          </button>
        )}

        <div className="list" style={{ gap: 12 }}>
          {groups.map((g) => {
            const ids = g.tasks.map((t) => t.id);
            const groupSelected = g.tasks.filter((t) => selected.has(t.id)).length;
            const groupState = markStateOf(groupSelected, g.tasks.length);
            return (
              <div className="gen-group" key={g.projectId}>
                <button className="gen-group-head" onClick={() => setMany(ids, groupState !== 'all')}>
                  <SelectBox state={groupState} />
                  <span className="gen-group-name">{g.name}</span>
                  <span className="counter">
                    {groupSelected}/{g.tasks.length}
                  </span>
                </button>
                <div className="list" style={{ gap: 7, paddingBottom: 6 }}>
                  {g.tasks.map((t) => {
                    const isSel = selected.has(t.id);
                    return (
                      <button
                        key={t.id}
                        className={isSel ? 'gen-task selected' : 'gen-task'}
                        onClick={() => setMany([t.id], !isSel)}
                      >
                        <SelectBox state={isSel ? 'all' : 'none'} />
                        <span className="gen-task-body">
                          <span className="gen-task-title">{t.title}</span>
                          <span className="gen-task-meta">
                            <IconClock size={10} /> {formatMinutes(t.minutes)}
                          </span>
                        </span>
                        <span className="inv-item-amount num">{formatMoney(taskAmount(t, t.minutes), currency)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {visibleTasks.length === 0 ? (
            <p className="modal-hint" style={{ textAlign: 'center', padding: '20px 0' }}>
              Нет задач «Ожидает оплаты» по этому фильтру
            </p>
          ) : null}
        </div>

        <div className="sel-summary">
          <span className="sel-count">Выбрано: {selectedTasks.length}</span>
          <span className="sel-total num">{formatMoney(selTotal, currency)}</span>
        </div>

        <button className="btn-primary" style={{ marginTop: 0 }} disabled={!selectedTasks.length} onClick={create}>
          Создать счёт
        </button>
      </div>
    </BottomSheet>
  );
}
