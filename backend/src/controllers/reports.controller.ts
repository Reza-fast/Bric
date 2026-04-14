import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { ReportStatus } from "../domain/index.js";
import type { Report } from "../domain/index.js";
import type { ReportService } from "../services/report.service.js";

/** Allowed file extensions for report attachments (lowercase, with dot). */
const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".dot",
  ".dotx",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".ppt",
  ".pptx",
  ".pps",
  ".ppsx",
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
  ".txt",
  ".csv",
  ".tsv",
  ".rtf",
  ".md",
  ".zip",
  ".rar",
  ".7z",
  ".dwg",
  ".dxf",
]);

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".dot": "application/msword",
  ".dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pps": "application/vnd.ms-powerpoint",
  ".ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
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
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".rtf": "application/rtf",
  ".md": "text/markdown",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".dwg": "image/vnd.dwg",
  ".dxf": "image/vnd.dxf",
};

function safeExtension(originalname: string): string | null {
  const ext = path.extname(originalname).toLowerCase();
  if (!ext || ext.length > 12) return null;
  return ALLOWED_EXT.has(ext) ? ext : null;
}

function normalizeMime(raw: string | undefined, originalname: string): string | null {
  const t = raw?.trim();
  if (t && t.length <= 200 && !t.includes("\r") && !t.includes("\n")) {
    return t;
  }
  const ext = safeExtension(originalname);
  if (!ext) return null;
  return EXT_MIME[ext] ?? null;
}

function mimeForDownload(report: Report): string {
  if (report.fileMimeType?.trim()) return report.fileMimeType.trim();
  const name = report.fileOriginalName ?? "";
  const ext = path.extname(name).toLowerCase();
  return EXT_MIME[ext] ?? "application/octet-stream";
}

function contentDispositionType(mime: string): "inline" | "attachment" {
  if (mime.startsWith("image/") || mime === "application/pdf") return "inline";
  return "attachment";
}

const createDigitalSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  body: z.string().min(1).max(100_000).trim(),
  status: z.nativeEnum(ReportStatus).optional(),
  dueAt: z.union([z.coerce.date(), z.null()]).optional(),
});

const patchSchema = z
  .object({
    title: z.string().min(1).max(500).trim().optional(),
    body: z.union([z.string().min(1).max(100_000), z.null()]).optional(),
    status: z.nativeEnum(ReportStatus).optional(),
    dueAt: z.union([z.coerce.date(), z.null()]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "EMPTY_PATCH" });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = safeExtension(file.originalname);
    cb(null, Boolean(ext));
  },
});

export class ReportsController {
  constructor(private readonly reports: ReportService) {}

  static readonly uploadAttachmentMiddleware = upload.single("file");

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const list = await this.reports.listForUser(projectId, userId);
    if (list === null) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ reports: list });
  };

  createDigital = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const parsed = createDigitalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    const report = await this.reports.createDigitalForUser(projectId, userId, {
      title: b.title,
      body: b.body,
      status: b.status,
      dueAt: b.dueAt,
    });
    if (!report) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.status(201).json(report);
  };

  patch = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const reportId = req.params.reportId!;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    const report = await this.reports.updateForUser(projectId, reportId, userId, {
      title: b.title,
      body: b.body,
      status: b.status,
      dueAt: b.dueAt,
    });
    if (!report) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(report);
  };

  uploadFile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "FILE_REQUIRED" });
      return;
    }

    const ext = safeExtension(file.originalname);
    if (!ext) {
      res.status(400).json({ error: "UNSUPPORTED_FILE_TYPE" });
      return;
    }

    const rawTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const title = rawTitle.length > 0 ? rawTitle.slice(0, 500) : (baseName || "Site report").slice(0, 500);

    const reportId = randomUUID();
    const storageKey = `reports/${reportId}${ext}`;
    const absFile = path.join(config.uploadDir, storageKey);
    const mime = normalizeMime(file.mimetype, file.originalname);

    await mkdir(path.dirname(absFile), { recursive: true });
    await writeFile(absFile, file.buffer);

    try {
      const report = await this.reports.createFileForUser(
        projectId,
        userId,
        reportId,
        title,
        file.originalname.slice(0, 500),
        storageKey,
        mime,
      );
      if (!report) {
        await unlink(absFile).catch(() => {});
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.status(201).json(report);
    } catch (e) {
      await unlink(absFile).catch(() => {});
      throw e;
    }
  };

  replaceAttachment = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const reportId = req.params.reportId!;
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "FILE_REQUIRED" });
      return;
    }

    const ext = safeExtension(file.originalname);
    if (!ext) {
      res.status(400).json({ error: "UNSUPPORTED_FILE_TYPE" });
      return;
    }

    const existing = await this.reports.getForUser(projectId, reportId, userId);
    if (!existing) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    const storageKey = `reports/${reportId}${ext}`;
    const absFile = path.join(config.uploadDir, storageKey);
    const mime = normalizeMime(file.mimetype, file.originalname);
    const prevKey = existing.fileStorageKey;

    await mkdir(path.dirname(absFile), { recursive: true });
    await writeFile(absFile, file.buffer);

    try {
      const updated = await this.reports.updateForUser(projectId, reportId, userId, {
        fileOriginalName: file.originalname.slice(0, 500),
        fileStorageKey: storageKey,
        fileMimeType: mime,
      });
      if (!updated) {
        await unlink(absFile).catch(() => {});
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      if (prevKey && prevKey !== storageKey) {
        const prevAbs = path.join(config.uploadDir, prevKey);
        await unlink(prevAbs).catch(() => {});
      }
      res.json(updated);
    } catch (e) {
      await unlink(absFile).catch(() => {});
      throw e;
    }
  };

  downloadFile = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const reportId = req.params.reportId!;
    const report = await this.reports.getForUser(projectId, reportId, userId);
    if (!report) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    if (!report.fileStorageKey) {
      res.status(404).json({ error: "NO_FILE" });
      return;
    }
    const absFile = path.join(config.uploadDir, report.fileStorageKey);
    const mime = mimeForDownload(report);
    res.setHeader("Content-Type", mime);
    const safeName = (report.fileOriginalName ?? "attachment").replace(/[\r\n"]/g, "_");
    const disp = contentDispositionType(mime);
    res.setHeader(
      "Content-Disposition",
      `${disp}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    res.sendFile(absFile, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: "FILE_READ" });
      }
    });
  };
}
