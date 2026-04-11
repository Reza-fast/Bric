import type { Pool } from "pg";
import type { TimeLog, TimeLogCreateInput } from "../domain/index.js";

interface TimeLogRow {
  id: string;
  project_id: string;
  user_id: string;
  duration_hours: string;
  logged_at: Date;
  note: string | null;
  created_at: Date;
}

function mapTimeLog(row: TimeLogRow): TimeLog {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    durationHours: Number(row.duration_hours),
    loggedAt: row.logged_at,
    note: row.note,
    createdAt: row.created_at,
  };
}

export class TimeLogsRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: TimeLogCreateInput): Promise<TimeLog> {
    const loggedAt = input.loggedAt ?? new Date();
    const { rows } = await this.pool.query<TimeLogRow>(
      `INSERT INTO time_logs (project_id, user_id, duration_hours, logged_at, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.projectId,
        input.userId,
        input.durationHours,
        loggedAt,
        input.note ?? null,
      ],
    );
    return mapTimeLog(rows[0]!);
  }

  /** Sum of duration_hours where logged_at falls in [start, end). */
  async sumHoursInRange(start: Date, end: Date): Promise<number> {
    const { rows } = await this.pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(duration_hours), 0)::text AS s
       FROM time_logs
       WHERE logged_at >= $1 AND logged_at < $2`,
      [start, end],
    );
    return Number(rows[0]?.s ?? 0);
  }

  async sumHoursInRangeForProjects(
    start: Date,
    end: Date,
    projectIds: string[],
  ): Promise<number> {
    if (projectIds.length === 0) return 0;
    const { rows } = await this.pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(duration_hours), 0)::text AS s
       FROM time_logs
       WHERE logged_at >= $1 AND logged_at < $2
         AND project_id = ANY($3::uuid[])`,
      [start, end, projectIds],
    );
    return Number(rows[0]?.s ?? 0);
  }
}
