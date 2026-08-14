import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ProjectFormModal } from '../modals/ProjectFormModal';
import { IconChevronRight } from '../components/icons';

const TINTS: [string, string][] = [
  ['rgba(108,140,255,0.16)', '#8fa6ff'],
  ['rgba(67,214,160,0.16)', '#43d6a0'],
  ['rgba(245,196,81,0.16)', '#f5c451'],
  ['rgba(185,140,255,0.16)', '#b98cff'],
];

type ModalState = { type: 'add' } | { type: 'edit'; projectId: string } | null;

export function ProjectsScreen() {
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const [modal, setModal] = useState<ModalState>(null);

  const activeCount = (id: string) => tasks.filter((t) => t.projectId === id && t.status !== 'done').length;

  return (
    <div className="screen scr">
      <div className="header">
        <div>
          <div className="eyebrow">Управление</div>
          <h1 className="h1">Проекты</h1>
        </div>
      </div>

      <div className="list">
        {projects.map((p, i) => {
          const [bg, fg] = TINTS[i % TINTS.length];
          return (
            <button
              className="project-row"
              key={p.id}
              style={{ opacity: p.archived ? 0.55 : 1 }}
              onClick={() => setModal({ type: 'edit', projectId: p.id })}
            >
              <span className="project-avatar" style={{ background: bg, color: fg }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="project-body">
                <span className="project-name-row">
                  <span className="project-name">{p.name}</span>
                  {p.archived ? <span className="archive-badge">АРХИВ</span> : null}
                </span>
                <span className="project-sub">
                  {(p.description || 'Без описания') + ' · ' + activeCount(p.id) + ' активн.'}
                </span>
              </span>
              <IconChevronRight size={16} color="var(--mute)" strokeWidth={2} />
            </button>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Пока нет проектов</div>
          <p className="empty-text">Нажмите «+», чтобы создать первый проект.</p>
        </div>
      ) : null}

      <button className="fab" onClick={() => setModal({ type: 'add' })}>
        +
      </button>

      <ProjectFormModal
        open={modal?.type === 'add' || modal?.type === 'edit'}
        mode={modal?.type === 'edit' ? 'edit' : 'add'}
        projectId={modal?.type === 'edit' ? modal.projectId : null}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
