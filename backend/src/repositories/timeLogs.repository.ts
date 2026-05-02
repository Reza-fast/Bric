import type { Pool } from "pg";
import type { TimeLog, TimeLogCreateInput } from "../domain/index.js";

interface TimeLogRow {
  id: string;
  project_id: string | null;
  user_id: string;
  duration_hours: string;
  logged_at: Date;
  note: string | null;
  created_at: Date;
  project_name?: string | null;
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

  async listByUserInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<TimeLog & { projectName: string }>> {
    const { rows } = await this.pool.query<TimeLogRow>(
      `SELECT tl.id, tl.project_id, tl.user_id, tl.duration_hours, tl.logged_at, tl.note, tl.created_at,
              p.name AS project_name
       FROM time_logs tl
       LEFT JOIN projects p ON p.id = tl.project_id
       WHERE tl.user_id = $1 AND tl.logged_at >= $2 AND tl.logged_at < $3
       ORDER BY tl.logged_at DESC`,
      [userId, from, to],
    );
    return rows.map((row) => ({
      ...mapTimeLog(row),
      projectName: row.project_name ?? "Day worked",
    }));
  }

  async findByUserAndId(userId: string, logId: string): Promise<TimeLog | null> {
    const { rows } = await this.pool.query<TimeLogRow>(
      `SELECT id, project_id, user_id, duration_hours, logged_at, note, created_at
       FROM time_logs WHERE id = $1 AND user_id = $2`,
      [logId, userId],
    );
    const row = rows[0];
    return row ? mapTimeLog(row) : null;
  }

  async findById(logId: string): Promise<TimeLog | null> {
    const { rows } = await this.pool.query<TimeLogRow>(
      `SELECT id, project_id, user_id, duration_hours, logged_at, note, created_at
       FROM time_logs WHERE id = $1`,
      [logId],
    );
    const row = rows[0];
    return row ? mapTimeLog(row) : null;
  }

  async deleteByUserAndId(userId: string, logId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM time_logs WHERE id = $1 AND user_id = $2`, [
      logId,
      userId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async deleteById(logId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM time_logs WHERE id = $1`, [logId]);
    return (rowCount ?? 0) > 0;
  }

  /** All users' logs in range (HR oversight). */
  async listAllInRange(
    from: Date,
    to: Date,
  ): Promise<Array<TimeLog & { projectName: string; ownerEmail: string; ownerDisplayName: string }>> {
    const { rows } = await this.pool.query<
      TimeLogRow & { owner_email: string; owner_display_name: string }
    >(
      `SELECT tl.id, tl.project_id, tl.user_id, tl.duration_hours, tl.logged_at, tl.note, tl.created_at,
              p.name AS project_name,
              u.email AS owner_email,
              u.display_name AS owner_display_name
       FROM time_logs tl
       LEFT JOIN projects p ON p.id = tl.project_id
       INNER JOIN users u ON u.id = tl.user_id
       WHERE tl.logged_at >= $1 AND tl.logged_at < $2
       ORDER BY tl.logged_at DESC`,
      [from, to],
    );
    return rows.map((row) => ({
      ...mapTimeLog(row),
      projectName: row.project_name ?? "Day worked",
      ownerEmail: row.owner_email,
      ownerDisplayName: row.owner_display_name,
    }));
  }

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

  /** Sum of day-clock rows (no project) for user in [start, end). */
  async sumDayClockHoursForUserInRange(userId: string, start: Date, end: Date): Promise<number> {
    const { rows } = await this.pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(duration_hours), 0)::text AS s
       FROM time_logs
       WHERE user_id = $1 AND project_id IS NULL AND logged_at >= $2 AND logged_at < $3`,
      [userId, start, end],
    );
    return Number(rows[0]?.s ?? 0);
  }

  /** Sum of project allocations for user in [start, end). */
  async sumProjectHoursForUserInRange(userId: string, start: Date, end: Date): Promise<number> {
    const { rows } = await this.pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(duration_hours), 0)::text AS s
       FROM time_logs
       WHERE user_id = $1 AND project_id IS NOT NULL AND logged_at >= $2 AND logged_at < $3`,
      [userId, start, end],
    );
    return Number(rows[0]?.s ?? 0);
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

  /** HR: total hours logged to each project by user (all time). */
  async aggregateHoursByProjectForUser(userId: string): Promise<Array<{ projectId: string; projectName: string; hours: number }>> {
    const { rows } = await this.pool.query<{ project_id: string; project_name: string; hours: string }>(
      `SELECT tl.project_id::text AS project_id,
              p.name AS project_name,
              COALESCE(SUM(tl.duration_hours), 0)::text AS hours
       FROM time_logs tl
       INNER JOIN projects p ON p.id = tl.project_id
       WHERE tl.user_id = $1 AND tl.project_id IS NOT NULL
       GROUP BY tl.project_id, p.name
       ORDER BY SUM(tl.duration_hours) DESC`,
      [userId],
    );
    return rows.map((r) => ({
      projectId: r.project_id,
      projectName: r.project_name,
      hours: Number(r.hours),
    }));
  }

  /** Hours logged without a project (day pool / registration only). */
  async sumDayPoolHoursAllTimeForUser(userId: string): Promise<number> {
    const { rows } = await this.pool.query<{ s: string }>(
      `SELECT COALESCE(SUM(duration_hours), 0)::text AS s
       FROM time_logs WHERE user_id = $1 AND project_id IS NULL`,
      [userId],
    );
    return Number(rows[0]?.s ?? 0);
  }
}
