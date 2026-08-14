import { getDb } from '../client';
import { softDelete } from '../softDelete';
import { Project } from '../../domain/types';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    archived: !!row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<ProjectRow[]>(
    'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at ASC'
  );
  return rows.map(mapProject);
}

export async function createProject(input: { name: string; description: string }): Promise<Project> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    'INSERT INTO projects (id, name, description, archived, created_at, updated_at) VALUES ($1, $2, $3, 0, $4, $5)',
    [id, input.name, input.description, now, now]
  );
  return { id, name: input.name, description: input.description, archived: false, createdAt: now, updatedAt: now };
}

export async function updateProject(id: string, patch: { name: string; description: string }): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE projects SET name = $1, description = $2, updated_at = $3 WHERE id = $4', [
    patch.name,
    patch.description,
    nowIso(),
    id,
  ]);
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE projects SET archived = $1, updated_at = $2 WHERE id = $3', [archived ? 1 : 0, nowIso(), id]);
}

/** Tombstones the project along with its tasks and their time entries. */
export async function deleteProjectForever(id: string): Promise<void> {
  await softDelete('project', id);
}
