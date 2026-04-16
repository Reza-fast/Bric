import type { Pool } from "pg";
import type { ReportPhoto } from "../domain/index.js";

interface ReportPhotoRow {
  id: string;
  report_id: string;
  file_original_name: string;
  file_storage_key: string;
  file_mime_type: string | null;
  sort_order: number;
  created_at: Date;
}

function mapRow(row: ReportPhotoRow): ReportPhoto {
  return {
    id: row.id,
    reportId: row.report_id,
    fileOriginalName: row.file_original_name,
    fileStorageKey: row.file_storage_key,
    fileMimeType: row.file_mime_type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export class ReportPhotosRepository {
  constructor(private readonly pool: Pool) {}

  async listByReportIds(reportIds: string[]): Promise<Map<string, ReportPhoto[]>> {
    const map = new Map<string, ReportPhoto[]>();
    if (reportIds.length === 0) return map;
    const { rows } = await this.pool.query<ReportPhotoRow>(
      `SELECT * FROM report_photos
       WHERE report_id = ANY($1::uuid[])
       ORDER BY report_id, sort_order ASC, created_at ASC`,
      [reportIds],
    );
    for (const row of rows) {
      const p = mapRow(row);
      const list = map.get(p.reportId) ?? [];
      list.push(p);
      map.set(p.reportId, list);
    }
    return map;
  }

  async nextSortOrder(reportId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM report_photos WHERE report_id = $1`,
      [reportId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async insert(input: {
    id: string;
    reportId: string;
    fileOriginalName: string;
    fileStorageKey: string;
    fileMimeType: string | null;
    sortOrder: number;
  }): Promise<ReportPhoto> {
    const { rows } = await this.pool.query<ReportPhotoRow>(
      `INSERT INTO report_photos (
         id, report_id, file_original_name, file_storage_key, file_mime_type, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.id,
        input.reportId,
        input.fileOriginalName,
        input.fileStorageKey,
        input.fileMimeType,
        input.sortOrder,
      ],
    );
    return mapRow(rows[0]!);
  }

  async findByProjectReportAndPhotoId(
    projectId: string,
    reportId: string,
    photoId: string,
  ): Promise<ReportPhoto | null> {
    const { rows } = await this.pool.query<ReportPhotoRow>(
      `SELECT rp.* FROM report_photos rp
       INNER JOIN reports r ON r.id = rp.report_id
       WHERE rp.id = $1 AND rp.report_id = $2 AND r.project_id = $3`,
      [photoId, reportId, projectId],
    );
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async deleteByReportAndId(reportId: string, photoId: string): Promise<ReportPhoto | null> {
    const { rows } = await this.pool.query<ReportPhotoRow>(
      `DELETE FROM report_photos WHERE report_id = $1 AND id = $2 RETURNING *`,
      [reportId, photoId],
    );
    const row = rows[0];
    return row ? mapRow(row) : null;
  }
}
