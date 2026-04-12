import type { Request, Response } from "express";
import { z } from "zod";
import type { ProjectUpdateInput } from "../domain/index.js";
import { ProjectStatus } from "../domain/index.js";
import type { ProjectService } from "../services/project.service.js";

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

export class ProjectsController {
  constructor(private readonly projects: ProjectService) {}

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
    res.json(list);
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
    res.json(project);
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
      res.status(201).json(project);
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
    res.json(updated);
  };
}
