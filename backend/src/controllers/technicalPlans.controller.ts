import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { config } from "../config.js";
import type { TechnicalPlanService } from "../services/technicalPlan.service.js";

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

function mimeForDownload(plan: { fileMimeType: string | null; fileOriginalName: string }): string {
  if (plan.fileMimeType?.trim()) return plan.fileMimeType.trim();
  const ext = path.extname(plan.fileOriginalName).toLowerCase();
  return EXT_MIME[ext] ?? "application/octet-stream";
}

function contentDispositionType(mime: string): "inline" | "attachment" {
  if (mime.startsWith("image/") || mime === "application/pdf") return "inline";
  return "attachment";
}

function serializePlan(plan: {
  id: string;
  projectId: string;
  title: string;
  fileOriginalName: string;
  fileStorageKey: string;
  fileMimeType: string | null;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  projectName?: string;
}) {
  return {
    id: plan.id,
    projectId: plan.projectId,
    title: plan.title,
    fileOriginalName: plan.fileOriginalName,
    fileStorageKey: plan.fileStorageKey,
    fileMimeType: plan.fileMimeType,
    uploadedByUserId: plan.uploadedByUserId,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    ...(plan.projectName !== undefined ? { projectName: plan.projectName } : {}),
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = safeExtension(file.originalname);
    cb(null, Boolean(ext));
  },
});

export class TechnicalPlansController {
  constructor(private readonly plans: TechnicalPlanService) {}

  static readonly uploadMiddleware = upload.single("file");

  listAll = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const list = await this.plans.listAllForUser(userId, projectId);
    res.json({ plans: list.map(serializePlan) });
  };

  listByProject = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const list = await this.plans.listForUser(projectId, userId);
    if (list === null) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ plans: list.map(serializePlan) });
  };

  upload = async (req: Request, res: Response): Promise<void> => {
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
    const title = rawTitle.length > 0 ? rawTitle.slice(0, 500) : (baseName || "Technical plan").slice(0, 500);

    const planId = randomUUID();
    const storageKey = `technical-plans/${planId}${ext}`;
    const absFile = path.join(config.uploadDir, storageKey);
    const mime = normalizeMime(file.mimetype, file.originalname);

    await mkdir(path.dirname(absFile), { recursive: true });
    await writeFile(absFile, file.buffer);

    try {
      const plan = await this.plans.createForUser(projectId, userId, {
        planId,
        title,
        fileOriginalName: file.originalname.slice(0, 500),
        fileStorageKey: storageKey,
        fileMimeType: mime,
      });
      if (!plan) {
        await unlink(absFile).catch(() => {});
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.status(201).json(serializePlan(plan));
    } catch (e) {
      await unlink(absFile).catch(() => {});
      throw e;
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const planId = req.params.planId!;
    const deleted = await this.plans.deleteForUser(projectId, planId, userId);
    if (!deleted) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const absFile = path.join(config.uploadDir, deleted.fileStorageKey);
    await unlink(absFile).catch(() => {});
    res.status(204).end();
  };

  download = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const planId = req.params.planId!;
    const plan = await this.plans.getForUser(projectId, planId, userId);
    if (!plan) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const absFile = path.join(config.uploadDir, plan.fileStorageKey);
    const mime = mimeForDownload(plan);
    res.setHeader("Content-Type", mime);
    const safeName = plan.fileOriginalName.replace(/[\r\n"]/g, "_");
    const disp = contentDispositionType(mime);
    res.setHeader("Content-Disposition", `${disp}; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    res.sendFile(absFile, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "FILE_READ" });
      }
    });
  };
}
