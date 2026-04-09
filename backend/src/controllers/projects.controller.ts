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
    const status = req.query.status as string | undefined;
    const valid =
      status && Object.values(ProjectStatus).includes(status as ProjectStatus)
        ? (status as ProjectStatus)
        : undefined;
    const list = await this.projects.list(valid);
    res.json(list);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const project = await this.projects.getById(req.params.id!);
    if (!project) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(project);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const project = await this.projects.create({
      name: body.name,
      slug: body.slug,
      status: body.status ?? ProjectStatus.Active,
      budgetedHours: body.budgetedHours,
      description: body.description ?? null,
    });
    res.status(201).json(project);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const updated = await this.projects.update(req.params.id!, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(updated);
  };
}
