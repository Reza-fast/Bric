import type { Pool } from "pg";
import type { Report, ReportCreateInput } from "../domain/index.js";
import { ReportStatus } from "../domain/index.js";

interface ReportRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status as ReportStatus,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ReportsRepository {
  constructor(private readonly pool: Pool) {}

  async countByStatus(status: ReportStatus): Promise<number> {
    const { rows } = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM reports WHERE status = $1`,
      [status],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async countByStatusInProjects(status: ReportStatus, projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const { rows } = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM reports
       WHERE status = $1 AND project_id = ANY($2::uuid[])`,
      [status, projectIds],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async create(input: ReportCreateInput): Promise<Report> {
    const { rows } = await this.pool.query<ReportRow>(
      `INSERT INTO reports (project_id, title, status, due_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.projectId, input.title, input.status, input.dueAt ?? null],
    );
    return mapReport(rows[0]!);
  }
}
