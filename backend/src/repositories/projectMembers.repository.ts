import type { Pool } from "pg";

export class ProjectMembersRepository {
  constructor(private readonly pool: Pool) {}

  async addMember(projectId: string, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [projectId, userId],
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
}
