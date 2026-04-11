import type { Pool } from "pg";
import type { Project, ProjectCreateInput, ProjectHoursSummary, ProjectUpdateInput } from "../domain/index.js";
import { ProjectStatus } from "../domain/index.js";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  budgeted_hours: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as ProjectStatus,
    budgetedHours: Number(row.budgeted_hours),
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectsRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Project | null> {
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT * FROM projects WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapProject(rows[0]) : null;
  }

  async listByStatus(status?: ProjectStatus): Promise<Project[]> {
    if (status) {
      const { rows } = await this.pool.query<ProjectRow>(
        `SELECT * FROM projects WHERE status = $1 ORDER BY name`,
        [status],
      );
      return rows.map(mapProject);
    }
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT * FROM projects ORDER BY name`,
    );
    return rows.map(mapProject);
  }

  async create(input: ProjectCreateInput): Promise<Project> {
    const { rows } = await this.pool.query<ProjectRow>(
      `INSERT INTO projects (name, slug, status, budgeted_hours, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.name,
        input.slug,
        input.status,
        input.budgetedHours,
        input.description ?? null,
      ],
    );
    return mapProject(rows[0]!);
  }

  async update(id: string, input: ProjectUpdateInput): Promise<Project | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const next = {
      name: input.name ?? existing.name,
      status: input.status ?? existing.status,
      budgetedHours: input.budgetedHours ?? existing.budgetedHours,
      description: input.description !== undefined ? input.description : existing.description,
    };
    const { rows } = await this.pool.query<ProjectRow>(
      `UPDATE projects SET
        name = $2, status = $3, budgeted_hours = $4, description = $5, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, next.name, next.status, next.budgetedHours, next.description],
    );
    return rows[0] ? mapProject(rows[0]) : null;
  }

  async countActive(): Promise<number> {
    const { rows } = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM projects WHERE status = 'active'`,
    );
    return Number(rows[0]?.c ?? 0);
  }

  /** Actual hours per project (sum of time_logs). */
  async listHoursSummaries(): Promise<ProjectHoursSummary[]> {
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      budgeted_hours: string;
      actual_hours: string;
    }>(
      `SELECT p.id, p.name, p.budgeted_hours,
        COALESCE(SUM(t.duration_hours), 0)::text AS actual_hours
       FROM projects p
       LEFT JOIN time_logs t ON t.project_id = p.id
       GROUP BY p.id, p.name, p.budgeted_hours
       ORDER BY p.name`,
    );
    return rows.map((row) => {
      const budgeted = Number(row.budgeted_hours);
      const actual = Number(row.actual_hours);
      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0;
      return {
        projectId: row.id,
        name: row.name,
        budgetedHours: budgeted,
        actualHours: actual,
        percentUsed: Math.round(percentUsed * 10) / 10,
        isOverBudget: actual > budgeted,
      };
    });
  }

  async listByMemberUserId(userId: string, status?: ProjectStatus): Promise<Project[]> {
    if (status) {
      const { rows } = await this.pool.query<ProjectRow>(
        `SELECT p.* FROM projects p
         INNER JOIN project_members m ON m.project_id = p.id AND m.user_id = $1
         WHERE p.status = $2
         ORDER BY p.name`,
        [userId, status],
      );
      return rows.map(mapProject);
    }
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT p.* FROM projects p
       INNER JOIN project_members m ON m.project_id = p.id AND m.user_id = $1
       ORDER BY p.name`,
      [userId],
    );
    return rows.map(mapProject);
  }

  async findByIdForMember(projectId: string, userId: string): Promise<Project | null> {
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT p.* FROM projects p
       INNER JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
       WHERE p.id = $1`,
      [projectId, userId],
    );
    return rows[0] ? mapProject(rows[0]) : null;
  }

  async countActiveInProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const { rows } = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM projects
       WHERE status = 'active' AND id = ANY($1::uuid[])`,
      [projectIds],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async listHoursSummariesInProjectIds(projectIds: string[]): Promise<ProjectHoursSummary[]> {
    if (projectIds.length === 0) return [];
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      budgeted_hours: string;
      actual_hours: string;
    }>(
      `SELECT p.id, p.name, p.budgeted_hours,
        COALESCE(SUM(t.duration_hours), 0)::text AS actual_hours
       FROM projects p
       LEFT JOIN time_logs t ON t.project_id = p.id
       WHERE p.id = ANY($1::uuid[])
       GROUP BY p.id, p.name, p.budgeted_hours
       ORDER BY p.name`,
      [projectIds],
    );
    return rows.map((row) => {
      const budgeted = Number(row.budgeted_hours);
      const actual = Number(row.actual_hours);
      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0;
      return {
        projectId: row.id,
        name: row.name,
        budgetedHours: budgeted,
        actualHours: actual,
        percentUsed: Math.round(percentUsed * 10) / 10,
        isOverBudget: actual > budgeted,
      };
    });
  }
}
