import { useEffect, useState } from 'react';
import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Chip, Field } from '../components/Field';
import { useAppStore } from '../store/useAppStore';
import { RateType, STATUS, TaskStatus } from '../domain/status';
import { formatMinutes } from '../domain/time';
import { shortDate } from '../utils/date';

const RATE_OPTIONS: { key: RateType; label: string }[] = [
  { key: 'hourly', label: 'Почасовая' },
  { key: 'fixed', label: 'Фиксированная' },
];
const STATUS_OPTIONS = (Object.keys(STATUS) as TaskStatus[]).filter((k) => k !== 'done');

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  taskId: string | null;
  onClose: () => void;
}

export function TaskFormModal({ open, mode, taskId, onClose }: Props) {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const settings = useAppStore((s) => s.settings);
  const addTask = useAppStore((s) => s.addTask);
  const editTask = useAppStore((s) => s.editTask);
  const addManualTime = useAppStore((s) => s.addManualTime);
  const deleteTask = useAppStore((s) => s.deleteTask);

  const task = taskId ? tasks.find((t) => t.id === taskId) ?? null : null;
  const compact = settings.compactTaskForm && mode === 'add';
  const activeProjects = projects.filter((p) => !p.archived);
  const projectOptions =
    task && task.projectId && !activeProjects.some((p) => p.id === task.projectId)
      ? [...activeProjects, ...projects.filter((p) => p.id === task.projectId)]
      : activeProjects;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [projectId, setProjectId] = useState('');
  const [rateType, setRateType] = useState<RateType>('hourly');
  const [rateStr, setRateStr] = useState('');
  const [status, setStatus] = useState<TaskStatus>('in_work');
  const [showAddTime, setShowAddTime] = useState(false);
  const [addH, setAddH] = useState('');
  const [addM, setAddM] = useState('');

  useEffect(() => {
    if (!open) return;
    setShowAddTime(false);
    setAddH('');
    setAddM('');
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description);
      setLink(task.link);
      setProjectId(task.projectId);
      setRateType(task.rateType);
      setRateStr(String(task.rate));
      setStatus(task.status);
    } else {
      setTitle('');
      setDescription('');
      setLink('');
      setProjectId(activeProjects[0]?.id ?? '');
      setRateType('hourly');
      setRateStr(String(settings.defaultRate));
      setStatus(settings.compactTaskForm ? 'next' : 'in_work');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, mode]);

  const save = () => {
    if (!title.trim()) return;
    const rate = parseFloat(rateStr) || 0;
    if (mode === 'edit' && task) {
      editTask(task.id, { projectId, title: title.trim(), description, link, rateType, rate, status });
    } else {
      if (!projectId) {
        alert('Сначала создайте проект на вкладке «Проекты».');
        return;
      }
      const initialMinutes = (parseInt(addH, 10) || 0) * 60 + (parseInt(addM, 10) || 0);
      addTask({ projectId, title: title.trim(), description, link, rateType, rate, status, initialMinutes });
    }
    onClose();
  };

  const commitAddTime = () => {
    const extra = (parseInt(addH, 10) || 0) * 60 + (parseInt(addM, 10) || 0);
    if (mode === 'edit' && task && extra > 0) {
      addManualTime(task.id, extra);
      setAddH('');
      setAddM('');
    }
    setShowAddTime(false);
  };

  const confirmDelete = () => {
    if (!task) return;
    if (confirm('Удалить задачу? Задача и всё учтённое по ней время будут удалены безвозвратно.')) {
      deleteTask(task.id);
      onClose();
    }
  };

  const rateLabel = rateType === 'hourly' ? `Ставка в час, ${settings.currency}` : `Стоимость, ${settings.currency}`;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title={mode === 'add' ? 'Новая задача' : 'Редактирование'} onClose={onClose} />
        <div className="stack">
          <Field label="Название" value={title} onChange={setTitle} placeholder="Название задачи" />
          <Field label="Описание" value={description} onChange={setDescription} placeholder="Что нужно сделать" multiline />
          <Field label="Ссылка" value={link} onChange={setLink} placeholder="https://" accent />

          <div>
            <span className="field-label">Проект</span>
            <div className="chips">
              {projectOptions.map((p) => (
                <Chip key={p.id} label={p.name} active={projectId === p.id} onClick={() => setProjectId(p.id)} />
              ))}
            </div>
          </div>

          {!compact && (
            <>
              <div>
                <span className="field-label">Тип ставки</span>
                <div className="chips">
                  {RATE_OPTIONS.map((o) => (
                    <Chip key={o.key} label={o.label} active={rateType === o.key} onClick={() => setRateType(o.key)} grow />
                  ))}
                </div>
              </div>

              <Field label={rateLabel} value={rateStr} onChange={setRateStr} numeric />

              <div className="time-box">
                <div className="time-top">
                  <div>
                    <div className="card-label">Отработано времени</div>
                    <div className="time-value num">{formatMinutes(task?.minutes ?? 0)}</div>
                  </div>
                  <button className="plus-btn" onClick={() => setShowAddTime((v) => !v)}>
                    +
                  </button>
                </div>
                {showAddTime && (
                  <div className="time-add">
                    <label>
                      <span className="mini-label">Часы</span>
                      <Field value={addH} onChange={setAddH} placeholder="0" numeric />
                    </label>
                    <label>
                      <span className="mini-label">Минуты</span>
                      <Field value={addM} onChange={setAddM} placeholder="0" numeric />
                    </label>
                    <button className="btn-primary" style={{ margin: 0, width: 'auto', padding: '13px 14px' }} onClick={commitAddTime}>
                      Добавить
                    </button>
                  </div>
                )}
              </div>

              <div>
                <span className="field-label">Статус</span>
                <div className="chips">
                  {STATUS_OPTIONS.map((k) => (
                    <Chip
                      key={k}
                      label={STATUS[k].label}
                      dotColor={STATUS[k].color}
                      active={status === k}
                      onClick={() => setStatus(k)}
                      small
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'edit' && task ? (
            <div className="created-at">Дата создания: {shortDate(task.createdAt.slice(0, 10))}</div>
          ) : null}

          <button className="btn-primary" onClick={save}>
            {mode === 'add' ? 'Создать задачу' : 'Сохранить'}
          </button>

          {mode === 'edit' && task ? (
            <button className="btn-secondary danger" onClick={confirmDelete}>
              Удалить задачу
            </button>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}
