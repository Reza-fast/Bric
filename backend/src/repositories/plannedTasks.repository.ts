import type { Pool } from "pg";
import type { PlannedTask, PlannedTaskCreateInput, PlannedTaskUpdateInput } from "../domain/index.js";
import { PlannedTaskStatus, TaskPriority } from "../domain/index.js";

interface PlannedTaskRow {
  id: string;
  project_id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
  phase_label: string | null;
  task_status: string;
  priority: string;
  sort_order: string;
  created_at: Date;
  updated_at: Date;
}

function mapPlannedTask(row: PlannedTaskRow): PlannedTask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    phaseLabel: row.phase_label,
    taskStatus: row.task_status as PlannedTaskStatus,
    priority: row.priority as TaskPriority,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PlannedTasksRepository {
  constructor(private readonly pool: Pool) {}

  async listInRange(start: Date, end: Date): Promise<PlannedTask[]> {
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `SELECT * FROM planned_tasks
       WHERE starts_at < $2 AND ends_at > $1
       ORDER BY sort_order ASC, created_at ASC`,
      [start, end],
    );
    return rows.map(mapPlannedTask);
  }

  async listInRangeForProjects(
    start: Date,
    end: Date,
    projectIds: string[],
  ): Promise<PlannedTask[]> {
    if (projectIds.length === 0) return [];
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `SELECT * FROM planned_tasks
       WHERE starts_at < $2 AND ends_at > $1
         AND project_id = ANY($3::uuid[])
       ORDER BY sort_order ASC, created_at ASC`,
      [start, end, projectIds],
    );
    return rows.map(mapPlannedTask);
  }

  async listByProjectInRange(projectId: string, start: Date, end: Date): Promise<PlannedTask[]> {
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `SELECT * FROM planned_tasks
       WHERE project_id = $1 AND starts_at < $3 AND ends_at > $2
       ORDER BY sort_order ASC, created_at ASC`,
      [projectId, start, end],
    );
    return rows.map(mapPlannedTask);
  }

  async listByProject(projectId: string): Promise<PlannedTask[]> {
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `SELECT * FROM planned_tasks WHERE project_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [projectId],
    );
    return rows.map(mapPlannedTask);
  }

  async findByIdForProject(taskId: string, projectId: string): Promise<PlannedTask | null> {
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `SELECT * FROM planned_tasks WHERE id = $1 AND project_id = $2`,
      [taskId, projectId],
    );
    return rows[0] ? mapPlannedTask(rows[0]) : null;
  }

  async create(input: PlannedTaskCreateInput): Promise<PlannedTask> {
    const taskStatus = input.taskStatus ?? PlannedTaskStatus.Scheduled;
    const priority = input.priority ?? TaskPriority.Normal;
    const sortOrder = input.sortOrder ?? 0;
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `INSERT INTO planned_tasks (
        project_id, title, starts_at, ends_at, location,
        phase_label, task_status, priority, sort_order
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.projectId,
        input.title,
        input.startsAt,
        input.endsAt,
        input.location ?? null,
        input.phaseLabel ?? null,
        taskStatus,
        priority,
        sortOrder,
      ],
    );
    return mapPlannedTask(rows[0]!);
  }

  async update(taskId: string, projectId: string, input: PlannedTaskUpdateInput): Promise<PlannedTask | null> {
    const existing = await this.findByIdForProject(taskId, projectId);
    if (!existing) return null;
    const next = {
      title: input.title ?? existing.title,
      startsAt: input.startsAt ?? existing.startsAt,
      endsAt: input.endsAt ?? existing.endsAt,
      location: input.location !== undefined ? input.location : existing.location,
      phaseLabel: input.phaseLabel !== undefined ? input.phaseLabel : existing.phaseLabel,
      taskStatus: input.taskStatus ?? existing.taskStatus,
      priority: input.priority ?? existing.priority,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
    };
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `UPDATE planned_tasks SET
        title = $3, starts_at = $4, ends_at = $5, location = $6,
        phase_label = $7, task_status = $8, priority = $9, sort_order = $10, updated_at = now()
       WHERE id = $1 AND project_id = $2
       RETURNING *`,
      [
        taskId,
        projectId,
        next.title,
        next.startsAt,
        next.endsAt,
        next.location,
        next.phaseLabel,
        next.taskStatus,
        next.priority,
        next.sortOrder,
      ],
    );
    return rows[0] ? mapPlannedTask(rows[0]) : null;
  }

  async delete(taskId: string, projectId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM planned_tasks WHERE id = $1 AND project_id = $2`, [
      taskId,
      projectId,
    ]);
    return (rowCount ?? 0) > 0;
  }
}
