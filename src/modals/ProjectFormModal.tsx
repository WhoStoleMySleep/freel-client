import { useEffect, useState } from 'react';
import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Field } from '../components/Field';
import { useAppStore } from '../store/useAppStore';

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  projectId: string | null;
  onClose: () => void;
}

export function ProjectFormModal({ open, mode, projectId, onClose }: Props) {
  const projects = useAppStore((s) => s.projects);
  const addProject = useAppStore((s) => s.addProject);
  const editProject = useAppStore((s) => s.editProject);
  const setProjectArchived = useAppStore((s) => s.setProjectArchived);
  const deleteProjectForever = useAppStore((s) => s.deleteProjectForever);

  const project = projectId ? projects.find((p) => p.id === projectId) ?? null : null;
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(mode === 'edit' && project ? project.name : '');
    setDesc(mode === 'edit' && project ? project.description : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, mode]);

  const save = () => {
    if (!name.trim()) return;
    if (mode === 'edit' && project) editProject(project.id, name.trim(), desc);
    else addProject(name.trim(), desc);
    onClose();
  };

  const confirmDelete = () => {
    if (!project) return;
    if (confirm('Удалить проект навсегда? Все задачи этого проекта будут безвозвратно удалены.')) {
      deleteProjectForever(project.id);
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title={mode === 'add' ? 'Новый проект' : 'Проект'} onClose={onClose} />
        <div className="stack">
          <Field label="Название проекта" value={name} onChange={setName} />
          <Field label="Описание (опционально)" value={desc} onChange={setDesc} multiline />

          <button className="btn-primary" onClick={save}>
            {mode === 'add' ? 'Создать' : 'Сохранить'}
          </button>

          {mode === 'edit' && project ? (
            <>
              <div className="btn-row">
                <button className="btn-secondary" onClick={() => setProjectArchived(project.id, !project.archived)}>
                  {project.archived ? 'Восстановить из архива' : 'Архивировать проект'}
                </button>
                {project.archived ? (
                  <button className="btn-secondary danger" onClick={confirmDelete}>
                    Удалить навсегда
                  </button>
                ) : null}
              </div>
              {project.archived ? (
                <p className="card-note" style={{ textAlign: 'center' }}>
                  Проект в архиве — данные сохранены
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}
