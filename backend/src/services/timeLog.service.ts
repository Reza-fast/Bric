import type { TimeLog, TimeLogCreateInput } from "../domain/index.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";
import { TimeLogsRepository } from "../repositories/timeLogs.repository.js";

export class TimeLogService {
  constructor(
    private readonly timeLogs: TimeLogsRepository,
    private readonly projects: ProjectsRepository,
  ) {}

  async create(input: TimeLogCreateInput): Promise<TimeLog> {
    const project = await this.projects.findById(input.projectId);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    return this.timeLogs.create(input);
  }
}
