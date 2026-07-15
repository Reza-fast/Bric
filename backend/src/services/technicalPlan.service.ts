import type { TechnicalPlan, TechnicalPlanWithProjectName } from "../domain/TechnicalPlan.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";
import { TechnicalPlansRepository } from "../repositories/technical-plans.repository.js";

export class TechnicalPlanService {
  constructor(
    private readonly plans: TechnicalPlansRepository,
    private readonly projects: ProjectsRepository,
  ) {}

  async listForUser(projectId: string, userId: string): Promise<TechnicalPlan[] | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.plans.listByProject(projectId);
  }

  async listAllForUser(userId: string, projectId?: string): Promise<TechnicalPlanWithProjectName[]> {
    return this.plans.listForMemberUser(userId, projectId);
  }

  async getForUser(projectId: string, planId: string, userId: string): Promise<TechnicalPlan | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.plans.findByProjectAndId(projectId, planId);
  }

  async createForUser(
    projectId: string,
    userId: string,
    input: {
      planId: string;
      title: string;
      fileOriginalName: string;
      fileStorageKey: string;
      fileMimeType: string | null;
    },
  ): Promise<TechnicalPlan | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.plans.create({
      id: input.planId,
      projectId,
      title: input.title,
      fileOriginalName: input.fileOriginalName,
      fileStorageKey: input.fileStorageKey,
      fileMimeType: input.fileMimeType,
      uploadedByUserId: userId,
    });
  }

  async deleteForUser(projectId: string, planId: string, userId: string): Promise<TechnicalPlan | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.plans.deleteByProjectAndId(projectId, planId);
  }
}
