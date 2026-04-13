import type {
  PlannedTask,
  PlannedTaskCreateInput,
  PlannedTaskUpdateInput,
} from "../domain/index.js";
import { PlannedTaskStatus, TaskPriority } from "../domain/index.js";
import { PlannedTasksRepository } from "../repositories/plannedTasks.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";

export class PlannedTaskService {
  constructor(
    private readonly tasks: PlannedTasksRepository,
    private readonly projects: ProjectsRepository,
  ) {}

  listInRange(start: Date, end: Date): Promise<PlannedTask[]> {
    return this.tasks.listInRange(start, end);
  }

  async listForUser(
    projectId: string,
    userId: string,
    start: Date,
    end: Date,
  ): Promise<PlannedTask[] | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.tasks.listByProjectInRange(projectId, start, end);
  }

  async listAllForUser(projectId: string, userId: string): Promise<PlannedTask[] | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.tasks.listByProject(projectId);
  }

  async createForUser(input: PlannedTaskCreateInput, userId: string): Promise<PlannedTask | null> {
    const allowed = await this.projects.findByIdForMember(input.projectId, userId);
    if (!allowed) return null;
    const payload: PlannedTaskCreateInput = {
      ...input,
      taskStatus: input.taskStatus ?? PlannedTaskStatus.Scheduled,
      priority: input.priority ?? TaskPriority.Normal,
      sortOrder: input.sortOrder ?? 0,
    };
    return this.tasks.create(payload);
  }

  async updateForUser(
    projectId: string,
    taskId: string,
    userId: string,
    input: PlannedTaskUpdateInput,
  ): Promise<PlannedTask | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.tasks.update(taskId, projectId, input);
  }

  async deleteForUser(projectId: string, taskId: string, userId: string): Promise<boolean> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return false;
    return this.tasks.delete(taskId, projectId);
  }
}
