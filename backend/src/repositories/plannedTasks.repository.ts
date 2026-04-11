import type { Pool } from "pg";
import type { PlannedTask, PlannedTaskCreateInput } from "../domain/index.js";

interface PlannedTaskRow {
  id: string;
  project_id: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
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
       ORDER BY starts_at`,
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
       ORDER BY starts_at`,
      [start, end, projectIds],
    );
    return rows.map(mapPlannedTask);
  }

  async create(input: PlannedTaskCreateInput): Promise<PlannedTask> {
    const { rows } = await this.pool.query<PlannedTaskRow>(
      `INSERT INTO planned_tasks (project_id, title, starts_at, ends_at, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.projectId,
        input.title,
        input.startsAt,
        input.endsAt,
        input.location ?? null,
      ],
    );
    return mapPlannedTask(rows[0]!);
  }
}
