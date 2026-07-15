import type { Pool } from "pg";
import type { TechnicalPlan, TechnicalPlanCreateInput, TechnicalPlanWithProjectName } from "../domain/TechnicalPlan.js";

interface TechnicalPlanRow {
  id: string;
  project_id: string;
  title: string;
  file_original_name: string;
  file_storage_key: string;
  file_mime_type: string | null;
  uploaded_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TechnicalPlanRowWithProject extends TechnicalPlanRow {
  project_name: string;
}

function mapPlan(row: TechnicalPlanRow): TechnicalPlan {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    fileOriginalName: row.file_original_name,
    fileStorageKey: row.file_storage_key,
    fileMimeType: row.file_mime_type,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlanWithProject(row: TechnicalPlanRowWithProject): TechnicalPlanWithProjectName {
  return { ...mapPlan(row), projectName: row.project_name };
}

export class TechnicalPlansRepository {
  constructor(private readonly pool: Pool) {}

  async listByProject(projectId: string): Promise<TechnicalPlan[]> {
    const { rows } = await this.pool.query<TechnicalPlanRow>(
      `SELECT * FROM technical_plans WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return rows.map(mapPlan);
  }

  async listForMemberUser(userId: string, projectId?: string): Promise<TechnicalPlanWithProjectName[]> {
    const { rows } = await this.pool.query<TechnicalPlanRowWithProject>(
      `SELECT tp.*, p.name AS project_name
       FROM technical_plans tp
       INNER JOIN projects p ON p.id = tp.project_id
       INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       WHERE ($2::uuid IS NULL OR tp.project_id = $2)
       ORDER BY tp.created_at DESC`,
      [userId, projectId ?? null],
    );
    return rows.map(mapPlanWithProject);
  }

  async findByProjectAndId(projectId: string, planId: string): Promise<TechnicalPlan | null> {
    const { rows } = await this.pool.query<TechnicalPlanRow>(
      `SELECT * FROM technical_plans WHERE project_id = $1 AND id = $2`,
      [projectId, planId],
    );
    return rows[0] ? mapPlan(rows[0]) : null;
  }

  async create(input: TechnicalPlanCreateInput): Promise<TechnicalPlan> {
    const { rows } = await this.pool.query<TechnicalPlanRow>(
      `INSERT INTO technical_plans (
        id, project_id, title, file_original_name, file_storage_key, file_mime_type, uploaded_by_user_id
      ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id ?? null,
        input.projectId,
        input.title,
        input.fileOriginalName,
        input.fileStorageKey,
        input.fileMimeType,
        input.uploadedByUserId,
      ],
    );
    return mapPlan(rows[0]!);
  }

  async deleteByProjectAndId(projectId: string, planId: string): Promise<TechnicalPlan | null> {
    const { rows } = await this.pool.query<TechnicalPlanRow>(
      `DELETE FROM technical_plans WHERE project_id = $1 AND id = $2 RETURNING *`,
      [projectId, planId],
    );
    return rows[0] ? mapPlan(rows[0]) : null;
  }
}
