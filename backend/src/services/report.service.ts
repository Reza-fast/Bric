import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Report } from "../domain/index.js";
import type { ReportPhoto } from "../domain/index.js";
import type { ReportPatchInput } from "../domain/index.js";
import { ReportStatus } from "../domain/index.js";
import { config } from "../config.js";
import { ReportPhotosRepository } from "../repositories/report-photos.repository.js";
import { ReportsRepository } from "../repositories/reports.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";

const PHOTO_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
  ".heic",
  ".heif",
]);

const PHOTO_EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function safePhotoExtension(originalname: string): string | null {
  const ext = path.extname(originalname).toLowerCase();
  if (!ext || ext.length > 12) return null;
  return PHOTO_EXT.has(ext) ? ext : null;
}

function normalizePhotoMime(raw: string | undefined, originalname: string): string | null {
  const t = raw?.trim();
  if (t && t.length <= 200 && !t.includes("\r") && !t.includes("\n")) {
    return t;
  }
  const ext = safePhotoExtension(originalname);
  if (!ext) return null;
  return PHOTO_EXT_MIME[ext] ?? null;
}

export type ReportWithPhotos = Report & { photos: ReportPhoto[] };

export class ReportService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly projects: ProjectsRepository,
    private readonly reportPhotos: ReportPhotosRepository,
  ) {}

  async listForUser(projectId: string, userId: string): Promise<ReportWithPhotos[] | null> {
    const allowed = await this.projects.findByIdForMember(projectId, userId);
    if (!allowed) return null;
    const list = await this.reports.listByProject(projectId);
    if (list.length === 0) return [];
    const photoMap = await this.reportPhotos.listByReportIds(list.map((r) => r.id));
    return list.map((r) => ({ ...r, photos: photoMap.get(r.id) ?? [] }));
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

  async getForUserWithPhotos(
    projectId: string,
    reportId: string,
    userId: string,
  ): Promise<ReportWithPhotos | null> {
    const report = await this.getForUser(projectId, reportId, userId);
    if (!report) return null;
    const map = await this.reportPhotos.listByReportIds([reportId]);
    return { ...report, photos: map.get(reportId) ?? [] };
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

  async addPhotosForUser(
    projectId: string,
    reportId: string,
    userId: string,
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
  ): Promise<
    { ok: true; photos: ReportPhoto[] } | { ok: false; reason: "NOT_FOUND" | "INVALID_FILES" | "TOO_MANY" }
  > {
    const existing = await this.getForUser(projectId, reportId, userId);
    if (!existing) return { ok: false, reason: "NOT_FOUND" };
    if (files.length === 0) return { ok: false, reason: "INVALID_FILES" };
    const photoMap = await this.reportPhotos.listByReportIds([reportId]);
    const already = photoMap.get(reportId)?.length ?? 0;
    const maxGallery = 30;
    if (already + files.length > maxGallery) return { ok: false, reason: "TOO_MANY" };
    for (const file of files) {
      const ext = safePhotoExtension(file.originalname);
      if (!ext || !file.buffer?.length) return { ok: false, reason: "INVALID_FILES" };
    }

    let sortBase = await this.reportPhotos.nextSortOrder(reportId);
    const saved: ReportPhoto[] = [];
    const writtenPaths: string[] = [];

    try {
      for (const file of files) {
        const ext = safePhotoExtension(file.originalname)!;
        const photoId = randomUUID();
        const storageKey = `reports/${reportId}/photos/${photoId}${ext}`;
        const absFile = path.join(config.uploadDir, storageKey);
        const mime = normalizePhotoMime(file.mimetype, file.originalname);
        await mkdir(path.dirname(absFile), { recursive: true });
        await writeFile(absFile, file.buffer);
        writtenPaths.push(absFile);
        const row = await this.reportPhotos.insert({
          id: photoId,
          reportId,
          fileOriginalName: file.originalname.slice(0, 500),
          fileStorageKey: storageKey,
          fileMimeType: mime,
          sortOrder: sortBase++,
        });
        saved.push(row);
      }
      return { ok: true, photos: saved };
    } catch (e) {
      for (const p of writtenPaths) {
        await unlink(p).catch(() => {});
      }
      throw e;
    }
  }

  async getPhotoForDownload(
    projectId: string,
    reportId: string,
    photoId: string,
    userId: string,
  ): Promise<ReportPhoto | null> {
    const allowed = await this.getForUser(projectId, reportId, userId);
    if (!allowed) return null;
    return this.reportPhotos.findByProjectReportAndPhotoId(projectId, reportId, photoId);
  }

  async deletePhotoForUser(
    projectId: string,
    reportId: string,
    photoId: string,
    userId: string,
  ): Promise<boolean> {
    const allowed = await this.getForUser(projectId, reportId, userId);
    if (!allowed) return false;
    const deleted = await this.reportPhotos.deleteByReportAndId(reportId, photoId);
    if (!deleted) return false;
    const abs = path.join(config.uploadDir, deleted.fileStorageKey);
    await unlink(abs).catch(() => {});
    return true;
  }
}
