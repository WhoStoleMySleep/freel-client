import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Chip } from '../components/Field';
import { IconClock } from '../components/icons';
import { useAppStore } from '../store/useAppStore';
import { RESTORE_ORDER, STATUS } from '../domain/status';
import { formatMinutes } from '../domain/time';
import { formatMoney } from '../domain/money';
import { taskAmount } from '../domain/earnings';

export function DoneTasksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const currency = useAppStore((s) => s.settings.currency);
  const setTaskStatus = useAppStore((s) => s.setTaskStatus);
  const deleteTask = useAppStore((s) => s.deleteTask);

  const doneTasks = tasks.filter((t) => t.status === 'done');
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—';

  const confirmDelete = (id: string, title: string) => {
    if (confirm(`Удалить задачу «${title}»? Всё учтённое по ней время будет удалено безвозвратно.`)) {
      deleteTask(id);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title="Готовые задачи" onClose={onClose} />
        <p className="modal-hint">Выберите статус, чтобы вернуть задачу в работу.</p>
        <div className="list">
          {doneTasks.map((t) => (
            <div className="done-card" key={t.id}>
              <div className="done-top">
                <div className="done-title">{t.title}</div>
                <div className="done-title num">{formatMoney(taskAmount(t, t.minutes), currency)}</div>
              </div>
              <div className="done-meta">
                <span>{projectName(t.projectId)} ·</span>
                <IconClock size={11} />
                <span>{formatMinutes(t.minutes)}</span>
                <button className="delete-link" onClick={() => confirmDelete(t.id, t.title)}>
                  Удалить
                </button>
              </div>
              <div className="chips">
                {RESTORE_ORDER.map((k) => (
                  <Chip
                    key={k}
                    label={STATUS[k].label}
                    dotColor={STATUS[k].color}
                    active={false}
                    onClick={() => setTaskStatus(t.id, k)}
                    small
                  />
                ))}
              </div>
            </div>
          ))}
          {doneTasks.length === 0 ? (
            <p className="modal-hint" style={{ textAlign: 'center', padding: '30px 0' }}>
              Пока нет готовых задач
            </p>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}
