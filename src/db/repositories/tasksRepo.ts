import { getDb } from '../client';
import { softDelete } from '../softDelete';
import { Task } from '../../domain/types';
import { RateType, TaskStatus } from '../../domain/status';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  link: string;
  rate_type: RateType;
  rate: number;
  minutes: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    link: row.link,
    rateType: row.rate_type,
    rate: row.rate,
    minutes: row.minutes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at ASC'
  );
  return rows.map(mapTask);
}

export interface NewTaskInput {
  projectId: string;
  title: string;
  description: string;
  link: string;
  rateType: RateType;
  rate: number;
  status: TaskStatus;
  initialMinutes: number;
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO tasks (id, project_id, title, description, link, rate_type, rate, minutes, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, input.projectId, input.title, input.description, input.link, input.rateType, input.rate, input.initialMinutes, input.status, now, now]
  );
  return {
    id,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    link: input.link,
    rateType: input.rateType,
    rate: input.rate,
    minutes: input.initialMinutes,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
}

export interface TaskEditInput {
  projectId: string;
  title: string;
  description: string;
  link: string;
  rateType: RateType;
  rate: number;
  status: TaskStatus;
}

export async function updateTask(id: string, patch: TaskEditInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET project_id = $1, title = $2, description = $3, link = $4,
     rate_type = $5, rate = $6, status = $7, updated_at = $8 WHERE id = $9`,
    [patch.projectId, patch.title, patch.description, patch.link, patch.rateType, patch.rate, patch.status, nowIso(), id]
  );
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET status = $1, updated_at = $2 WHERE id = $3', [status, nowIso(), id]);
}

export async function setTasksStatusBulk(ids: string[], status: TaskStatus): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const now = nowIso();
  for (const id of ids) {
    await db.execute('UPDATE tasks SET status = $1, updated_at = $2 WHERE id = $3', [status, now, id]);
  }
}


/** Tombstones the task along with its time entries. */
export async function deleteTask(id: string): Promise<void> {
  await softDelete('task', id);
}

export async function touchTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE tasks SET updated_at = $1 WHERE id = $2', [nowIso(), id]);
}
