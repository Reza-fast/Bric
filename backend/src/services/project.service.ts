import type { Project, ProjectCreateInput, ProjectUpdateInput } from "../domain/index.js";
import type { ProjectStatus } from "../domain/index.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";

export class ProjectService {
  constructor(private readonly projects: ProjectsRepository) {}

  list(status?: ProjectStatus): Promise<Project[]> {
    return this.projects.listByStatus(status);
  }

  getById(id: string): Promise<Project | null> {
    return this.projects.findById(id);
  }

  create(input: ProjectCreateInput): Promise<Project> {
    return this.projects.create(input);
  }

  update(id: string, input: ProjectUpdateInput): Promise<Project | null> {
    return this.projects.update(id, input);
  }
}
