import type { Pool } from "pg";
import { PORTFOLIO_SEED_SLUGS } from "../constants/portfolioSeedSlugs.js";

export interface TeamDirectoryRow {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  project_id: string;
  project_name: string;
  project_status: string;
  member_function: string | null;
}

export class ProjectMembersRepository {
  constructor(private readonly pool: Pool) {}

  async addMember(projectId: string, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [projectId, userId],
    );
  }

  /** Returns true if a row was deleted. */
  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async addOrUpdateMemberWithFunction(
    projectId: string,
    userId: string,
    memberFunction: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO project_members (project_id, user_id, member_function)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET member_function = COALESCE(EXCLUDED.member_function, project_members.member_function)`,
      [projectId, userId, memberFunction],
    );
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async listProjectIdsByUser(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ project_id: string }>(
      `SELECT project_id FROM project_members WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => r.project_id);
  }

  /** Idempotent: link user to seeded portfolio projects (for demo registry). */
  async addUserToPortfolioSeedProjects(userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO project_members (project_id, user_id)
       SELECT p.id, $1
       FROM projects p
       WHERE p.slug = ANY($2::text[])
       ON CONFLICT DO NOTHING`,
      [userId, [...PORTFOLIO_SEED_SLUGS]],
    );
  }

  async listTeamDirectoryRows(projectIds: string[]): Promise<TeamDirectoryRow[]> {
    if (projectIds.length === 0) return [];
    const { rows } = await this.pool.query<TeamDirectoryRow>(
      `SELECT
         u.id AS user_id,
         u.email,
         u.display_name,
         u.role,
         u.avatar_url,
         p.id AS project_id,
         p.name AS project_name,
         p.status AS project_status,
         pm.member_function
       FROM project_members pm
       INNER JOIN users u ON u.id = pm.user_id
       INNER JOIN projects p ON p.id = pm.project_id
       WHERE pm.project_id = ANY($1::uuid[])
       ORDER BY u.display_name ASC, p.name ASC`,
      [projectIds],
    );
    return rows;
  }

  /** All project–member rows (for HR org directory). */
  async listTeamDirectoryRowsAll(): Promise<TeamDirectoryRow[]> {
    const { rows } = await this.pool.query<TeamDirectoryRow>(
      `SELECT
         u.id AS user_id,
         u.email,
         u.display_name,
         u.role,
         u.avatar_url,
         p.id AS project_id,
         p.name AS project_name,
         p.status AS project_status,
         pm.member_function
       FROM project_members pm
       INNER JOIN users u ON u.id = pm.user_id
       INNER JOIN projects p ON p.id = pm.project_id
       ORDER BY u.display_name ASC, p.name ASC`,
    );
    return rows;
  }
}
