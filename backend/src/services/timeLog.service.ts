import type { TimeLog, TimeLogCreateInput } from "../domain/index.js";
import { ProjectMembersRepository } from "../repositories/projectMembers.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";
import { TimeLogsRepository } from "../repositories/timeLogs.repository.js";

export class TimeLogService {
  constructor(
    private readonly timeLogs: TimeLogsRepository,
    private readonly projects: ProjectsRepository,
    private readonly members: ProjectMembersRepository,
  ) {}

  async create(actorUserId: string, input: Omit<TimeLogCreateInput, "userId">): Promise<TimeLog> {
    const project = await this.projects.findById(input.projectId);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    const isMember = await this.members.isMember(input.projectId, actorUserId);
    if (!isMember) {
      throw new Error("PROJECT_FORBIDDEN");
    }
    return this.timeLogs.create({
      ...input,
      userId: actorUserId,
    });
  }
}
