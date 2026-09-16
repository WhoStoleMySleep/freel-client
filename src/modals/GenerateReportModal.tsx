import { useEffect, useMemo, useState } from 'react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Chip } from '../components/Field';
import { SelectBox, markStateOf } from '../components/SelectBox';
import { IconLink } from '../components/icons';
import { useFlash } from '../hooks/useFlash';
import { useAppStore } from '../store/useAppStore';
import { DASH_ORDER, REVIEW_STATUSES, STATUS, TaskStatus } from '../domain/status';
import { reportToText } from '../domain/reportText';
import { Task } from '../domain/types';

/**
 * Builds the "what is sitting with you" message: the tasks handed off for
 * review, grouped by project, each with its link.
 *
 * Deliberately produces nothing but text. An invoice is a record and is stored;
 * a report is a snapshot of statuses that change by the hour, so keeping copies
 * of it would only leave stale ones lying around — regenerate instead.
 */
export function GenerateReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);

  const [statuses, setStatuses] = useState<TaskStatus[]>(REVIEW_STATUSES);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, flashCopied] = useFlash(false, 2000);

  const pool = useMemo(() => tasks.filter((t) => statuses.includes(t.status)), [tasks, statuses]);

  useEffect(() => {
    if (!open) return;
    setStatuses(REVIEW_STATUSES);
    setFilterProjectId('');
    setSelected(new Set(tasks.filter((t) => REVIEW_STATUSES.includes(t.status)).map((t) => t.id)));
    flashCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectName = (id: string) => projectNames.get(id) ?? '—';

  const setMany = (ids: string[], value: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (value ? next.add(id) : next.delete(id)));
      return next;
    });

  /**
   * Turning a status on ticks its tasks, turning it off unticks them — so the
   * chips read as "include this group" without quietly discarding the manual
   * choices already made inside the other groups.
   */
  const toggleStatus = (status: TaskStatus) => {
    const on = statuses.includes(status);
    setStatuses((prev) => (on ? prev.filter((s) => s !== status) : [...prev, status]));
    setMany(
      tasks.filter((t) => t.status === status).map((t) => t.id),
      !on
    );
  };

  const visibleTasks = pool.filter((t) => !filterProjectId || t.projectId === filterProjectId);

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

  const visibleSelected = visibleTasks.filter((t) => selected.has(t.id)).length;
  const masterState = markStateOf(visibleSelected, visibleTasks.length);

  // Built from `pool`, not `visibleTasks`: the project chips narrow what is on
  // screen, they do not carve up the report being sent.
  const selectedTasks = pool.filter((t) => selected.has(t.id));
  const withoutLink = selectedTasks.filter((t) => !t.link.trim()).length;
  const text = reportToText(
    selectedTasks.map((t) => ({ projectName: projectName(t.projectId), title: t.title, link: t.link }))
  );

  const copy = async () => {
    if (!selectedTasks.length) return;
    try {
      await writeText(text);
    } catch {
      await navigator.clipboard?.writeText(text);
    }
    flashCopied(true);
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title="Отчёт по задачам" onClose={onClose} />
        <p className="modal-hint">Вместо часов в отчёт идёт ссылка на задачу. Отметьте статусы, которые нужно включить.</p>

        <div className="field-label">Статусы</div>
        <div className="chips" style={{ gap: 5, marginBottom: 14 }}>
          {DASH_ORDER.map((k) => (
            <Chip
              key={k}
              label={STATUS[k].label}
              dotColor={STATUS[k].color}
              active={statuses.includes(k)}
              onClick={() => toggleStatus(k)}
              small
            />
          ))}
        </div>

        <div className="field-label">Проект</div>
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
                    const link = t.link.trim();
                    return (
                      <button
                        key={t.id}
                        className={isSel ? 'gen-task selected' : 'gen-task'}
                        onClick={() => setMany([t.id], !isSel)}
                      >
                        <SelectBox state={isSel ? 'all' : 'none'} />
                        <span className="gen-task-body">
                          <span className="gen-task-title">{t.title}</span>
                          <span className={link ? 'gen-task-link' : 'gen-task-link missing'}>
                            <IconLink size={10} /> {link || 'ссылки нет'}
                          </span>
                        </span>
                        <span
                          className="status-badge"
                          style={{ background: STATUS[t.status].color + '22', color: STATUS[t.status].color }}
                        >
                          {STATUS[t.status].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {visibleTasks.length === 0 ? (
            <p className="modal-hint" style={{ textAlign: 'center', padding: '20px 0' }}>
              Нет задач с выбранными статусами по этому фильтру
            </p>
          ) : null}
        </div>

        <div className="sel-summary">
          <span className="sel-count">Выбрано: {selectedTasks.length}</span>
          {withoutLink ? <span className="sel-warn">Без ссылки: {withoutLink}</span> : null}
        </div>

        {selectedTasks.length > 0 ? <pre className="report-preview">{text}</pre> : null}

        <button className="btn-primary" style={{ marginTop: 12 }} disabled={!selectedTasks.length} onClick={copy}>
          {copied ? 'Скопировано' : 'Скопировать отчёт'}
        </button>
      </div>
    </BottomSheet>
  );
}
