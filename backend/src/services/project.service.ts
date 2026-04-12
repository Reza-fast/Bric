import type {
  Project,
  ProjectCreateInput,
  ProjectPortfolioCard,
  ProjectUpdateInput,
} from "../domain/index.js";
import type { ProjectStatus } from "../domain/index.js";
import { ProjectMembersRepository } from "../repositories/projectMembers.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";

export class ProjectService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly members: ProjectMembersRepository,
  ) {}

  listForUser(userId: string, status?: ProjectStatus): Promise<Project[]> {
    return this.projects.listByMemberUserId(userId, status);
  }

  listPortfolioForUser(userId: string, status?: ProjectStatus): Promise<ProjectPortfolioCard[]> {
    return this.projects.listPortfolioByMemberUserId(userId, status);
  }

  getByIdForUser(projectId: string, userId: string): Promise<Project | null> {
    return this.projects.findByIdForMember(projectId, userId);
  }

  async createForUser(input: ProjectCreateInput, creatorUserId: string): Promise<Project> {
    const project = await this.projects.create(input);
    await this.members.addMember(project.id, creatorUserId);
    return project;
  }

  async updateForUser(
    projectId: string,
    userId: string,
    input: ProjectUpdateInput,
  ): Promise<Project | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.projects.update(projectId, input);
  }
}
