import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import type { ProjectUpdateInput } from "../domain/index.js";
import { ProjectStatus } from "../domain/index.js";
import type { ProjectService } from "../services/project.service.js";

const LOGO_EXT = new Set([
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

const LOGO_MIME: Record<string, string> = {
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

function safeLogoExtension(originalname: string): string | null {
  const ext = path.extname(originalname).toLowerCase();
  if (!ext || ext.length > 12) return null;
  return LOGO_EXT.has(ext) ? ext : null;
}

function normalizeLogoMime(raw: string | undefined, originalname: string): string | null {
  const t = raw?.trim();
  if (t && t.length <= 200 && !t.includes("\r") && !t.includes("\n") && t.startsWith("image/")) {
    return t;
  }
  const ext = safeLogoExtension(originalname);
  if (!ext) return null;
  return LOGO_MIME[ext] ?? null;
}

function serializeProject(project: {
  id: string;
  name: string;
  slug: string;
  status: string;
  budgetedHours: number;
  description: string | null;
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
  logoOriginalName: string | null;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
  actualHours?: number;
  hoursPercentUsed?: number;
  isOverBudget?: boolean;
}) {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

const createSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, and hyphens only"),
  status: z.nativeEnum(ProjectStatus).optional(),
  budgetedHours: z.coerce.number().finite().nonnegative().max(1_000_000),
  description: z.string().max(8000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  completionPercent: z.coerce.number().finite().min(0).max(100).optional(),
  portfolioLeadName: z.string().max(200).nullable().optional(),
});

const updateSchema = createSchema.partial().omit({ slug: true });

const uploadLogoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = safeLogoExtension(file.originalname);
    cb(null, Boolean(ext));
  },
});

export class ProjectsController {
  constructor(private readonly projects: ProjectService) {}

  static readonly uploadLogoMiddleware = uploadLogoMulter.single("file");

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const status = req.query.status as string | undefined;
    const valid =
      status && Object.values(ProjectStatus).includes(status as ProjectStatus)
        ? (status as ProjectStatus)
        : undefined;
    const list = await this.projects.listPortfolioForUser(userId, valid);
    res.json(list.map(serializeProject));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const project = await this.projects.getByIdForUser(req.params.id!, userId);
    if (!project) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(serializeProject(project));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const emptyToNull = (s: string | null | undefined) => {
      const t = typeof s === "string" ? s.trim() : "";
      return t.length > 0 ? t : null;
    };
    try {
      const project = await this.projects.createForUser(
        {
          name: body.name,
          slug: body.slug,
          status: body.status ?? ProjectStatus.Active,
          budgetedHours: body.budgetedHours,
          description: emptyToNull(body.description ?? undefined),
          location: emptyToNull(body.location ?? undefined),
          completionPercent: body.completionPercent ?? 0,
          portfolioLeadName: emptyToNull(body.portfolioLeadName ?? undefined),
        },
        userId,
      );
      res.status(201).json(serializeProject(project));
    } catch (err: unknown) {
      const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "23505") {
        res.status(409).json({
          error: "SLUG_IN_USE",
          message: "A project with this URL slug already exists. Change the slug and try again.",
        });
        return;
      }
      throw err;
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const emptyToNull = (s: string | null | undefined) => {
      const t = typeof s === "string" ? s.trim() : "";
      return t.length > 0 ? t : null;
    };
    const patch: ProjectUpdateInput = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.status !== undefined) patch.status = body.status;
    if (body.budgetedHours !== undefined) patch.budgetedHours = body.budgetedHours;
    if (body.description !== undefined) patch.description = emptyToNull(body.description ?? undefined);
    if (body.location !== undefined) patch.location = emptyToNull(body.location ?? undefined);
    if (body.completionPercent !== undefined) patch.completionPercent = body.completionPercent;
    if (body.portfolioLeadName !== undefined) {
      patch.portfolioLeadName = emptyToNull(body.portfolioLeadName ?? undefined);
    }
    const updated = await this.projects.updateForUser(req.params.id!, userId, patch);
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(serializeProject(updated));
  };

  uploadLogo = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.id!;
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "FILE_REQUIRED" });
      return;
    }
    const ext = safeLogoExtension(file.originalname);
    if (!ext) {
      res.status(400).json({ error: "UNSUPPORTED_FILE_TYPE" });
      return;
    }
    const mime = normalizeLogoMime(file.mimetype, file.originalname);
    const storageKey = `projects/${projectId}/logo${ext}`;
    const absFile = path.join(config.uploadDir, storageKey);

    await mkdir(path.dirname(absFile), { recursive: true });
    await writeFile(absFile, file.buffer);

    try {
      const result = await this.projects.setLogoForUser(projectId, userId, {
        originalName: file.originalname.slice(0, 500),
        storageKey,
        mimeType: mime,
      });
      if (!result) {
        await unlink(absFile).catch(() => {});
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      if (result.previousStorageKey && result.previousStorageKey !== storageKey) {
        const prevAbs = path.join(config.uploadDir, result.previousStorageKey);
        await unlink(prevAbs).catch(() => {});
      }
      res.json(serializeProject(result.project));
    } catch (e) {
      await unlink(absFile).catch(() => {});
      throw e;
    }
  };

  deleteLogo = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.id!;
    const result = await this.projects.clearLogoForUser(projectId, userId);
    if (!result) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    if (result.previousStorageKey) {
      const prevAbs = path.join(config.uploadDir, result.previousStorageKey);
      await unlink(prevAbs).catch(() => {});
    }
    res.json(serializeProject(result.project));
  };

  downloadLogo = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.id!;
    const logo = await this.projects.getLogoForMember(projectId, userId);
    if (!logo) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const absFile = path.join(config.uploadDir, logo.storageKey);
    const mime =
      logo.mimeType?.trim() ||
      LOGO_MIME[path.extname(logo.originalName).toLowerCase()] ||
      "image/png";
    res.setHeader("Content-Type", mime);
    const safeName = logo.originalName.replace(/[\r\n"]/g, "_");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(absFile, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "FILE_READ" });
      }
    });
  };
}
