import type { Request, Response } from "express";
import { z } from "zod";
import { ProjectStatus } from "../domain/index.js";
import type { ProjectService } from "../services/project.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  status: z.nativeEnum(ProjectStatus).optional(),
  budgetedHours: z.number().nonnegative(),
  description: z.string().nullable().optional(),
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
    const list = await this.projects.listForUser(userId, valid);
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
    const project = await this.projects.createForUser(
      {
        name: body.name,
        slug: body.slug,
        status: body.status ?? ProjectStatus.Active,
        budgetedHours: body.budgetedHours,
        description: body.description ?? null,
      },
      userId,
    );
    res.status(201).json(project);
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
    const updated = await this.projects.updateForUser(req.params.id!, userId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(updated);
  };
}
