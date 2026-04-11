import type { Activity, ActivityCreateInput } from "../domain/index.js";
import { ActivitiesRepository } from "../repositories/activities.repository.js";

export class ActivityService {
  constructor(private readonly activities: ActivitiesRepository) {}

  listRecent(limit?: number): Promise<Activity[]> {
    return this.activities.listRecent(limit);
  }

  listByProject(projectId: string, limit?: number): Promise<Activity[]> {
    return this.activities.listByProject(projectId, limit);
  }

  create(input: ActivityCreateInput): Promise<Activity> {
    return this.activities.create(input);
  }
}
