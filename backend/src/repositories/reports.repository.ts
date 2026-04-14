import type { Pool } from "pg";
import type { Report, ReportCreateInput, ReportPatchInput } from "../domain/index.js";
import { ReportStatus } from "../domain/index.js";

interface ReportRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_at: Date | null;
  body: string | null;
  file_original_name: string | null;
  file_storage_key: string | null;
  file_mime_type: string | null;
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
    body: row.body,
    fileOriginalName: row.file_original_name,
    fileStorageKey: row.file_storage_key,
    fileMimeType: row.file_mime_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PATCH_COL: Record<keyof ReportPatchInput, string> = {
  title: "title",
  body: "body",
  status: "status",
  dueAt: "due_at",
  fileOriginalName: "file_original_name",
  fileStorageKey: "file_storage_key",
  fileMimeType: "file_mime_type",
};

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

  async listByProject(projectId: string): Promise<Report[]> {
    const { rows } = await this.pool.query<ReportRow>(
      `SELECT * FROM reports WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return rows.map(mapReport);
  }

  async findByProjectAndId(projectId: string, reportId: string): Promise<Report | null> {
    const { rows } = await this.pool.query<ReportRow>(
      `SELECT * FROM reports WHERE project_id = $1 AND id = $2`,
      [projectId, reportId],
    );
    const row = rows[0];
    return row ? mapReport(row) : null;
  }

  async create(input: ReportCreateInput): Promise<Report> {
    const { rows } = await this.pool.query<ReportRow>(
      `INSERT INTO reports (
         id, project_id, title, status, due_at,
         body, file_original_name, file_storage_key, file_mime_type
       )
       VALUES (
         COALESCE($1::uuid, gen_random_uuid()),
         $2, $3, $4, $5,
         $6, $7, $8, $9
       )
       RETURNING *`,
      [
        input.id ?? null,
        input.projectId,
        input.title,
        input.status,
        input.dueAt ?? null,
        input.body,
        input.fileOriginalName,
        input.fileStorageKey,
        input.fileMimeType,
      ],
    );
    return mapReport(rows[0]!);
  }

  async update(projectId: string, reportId: string, patch: ReportPatchInput): Promise<Report | null> {
    const entries = Object.entries(patch).filter(
      ([k, v]) => v !== undefined && k in PATCH_COL,
    ) as [keyof ReportPatchInput, unknown][];

    if (entries.length === 0) {
      return this.findByProjectAndId(projectId, reportId);
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    for (const [key, val] of entries) {
      sets.push(`${PATCH_COL[key]} = $${p++}`);
      vals.push(val);
    }
    sets.push(`updated_at = now()`);
    vals.push(projectId, reportId);

    const { rows } = await this.pool.query<ReportRow>(
      `UPDATE reports SET ${sets.join(", ")}
       WHERE project_id = $${p} AND id = $${p + 1}
       RETURNING *`,
      vals,
    );
    const row = rows[0];
    return row ? mapReport(row) : null;
  }
}
