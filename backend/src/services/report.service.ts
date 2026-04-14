import type { Report } from "../domain/index.js";
import type { ReportPatchInput } from "../domain/index.js";
import { ReportStatus } from "../domain/index.js";
import { ReportsRepository } from "../repositories/reports.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";

export class ReportService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly projects: ProjectsRepository,
  ) {}

  async listForUser(projectId: string, userId: string): Promise<Report[] | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.reports.listByProject(projectId);
  }

  async createDigitalForUser(
    projectId: string,
    userId: string,
    input: { title: string; body: string; status?: ReportStatus; dueAt?: Date | null },
  ): Promise<Report | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.reports.create({
      projectId,
      title: input.title,
      status: input.status ?? ReportStatus.InReview,
      dueAt: input.dueAt ?? null,
      body: input.body,
      fileOriginalName: null,
      fileStorageKey: null,
      fileMimeType: null,
    });
  }

  async createFileForUser(
    projectId: string,
    userId: string,
    reportId: string,
    title: string,
    fileOriginalName: string,
    fileStorageKey: string,
    fileMimeType: string | null,
  ): Promise<Report | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.reports.create({
      id: reportId,
      projectId,
      title,
      status: ReportStatus.InReview,
      dueAt: null,
      body: null,
      fileOriginalName,
      fileStorageKey,
      fileMimeType,
    });
  }

  async getForUser(projectId: string, reportId: string, userId: string): Promise<Report | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    return this.reports.findByProjectAndId(projectId, reportId);
  }

  async updateForUser(
    projectId: string,
    reportId: string,
    userId: string,
    patch: ReportPatchInput,
  ): Promise<Report | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    const existing = await this.reports.findByProjectAndId(projectId, reportId);
    if (!existing) return null;
    return this.reports.update(projectId, reportId, patch);
  }
}
