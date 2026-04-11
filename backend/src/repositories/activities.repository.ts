import type { Pool } from "pg";
import type { Activity, ActivityCreateInput } from "../domain/index.js";
import { ActivityType } from "../domain/index.js";

interface ActivityRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  body: string | null;
  media_urls: string[];
  actor_user_id: string | null;
  created_at: Date;
}

function mapActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as ActivityType,
    title: row.title,
    body: row.body,
    mediaUrls: row.media_urls ?? [],
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  };
}

export class ActivitiesRepository {
  constructor(private readonly pool: Pool) {}

  async listRecent(limit = 20): Promise<Activity[]> {
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT * FROM activities ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map(mapActivity);
  }

  async listRecentForProjects(projectIds: string[], limit = 20): Promise<Activity[]> {
    if (projectIds.length === 0) return [];
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT * FROM activities
       WHERE project_id = ANY($1::uuid[])
       ORDER BY created_at DESC
       LIMIT $2`,
      [projectIds, limit],
    );
    return rows.map(mapActivity);
  }

  async listByProject(projectId: string, limit = 50): Promise<Activity[]> {
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT * FROM activities WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [projectId, limit],
    );
    return rows.map(mapActivity);
  }

  async create(input: ActivityCreateInput): Promise<Activity> {
    const { rows } = await this.pool.query<ActivityRow>(
      `INSERT INTO activities (project_id, type, title, body, media_urls, actor_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.projectId,
        input.type,
        input.title,
        input.body ?? null,
        input.mediaUrls ?? [],
        input.actorUserId ?? null,
      ],
    );
    return mapActivity(rows[0]!);
  }
}
