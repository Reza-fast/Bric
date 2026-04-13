import type { Request, Response } from "express";
import { z } from "zod";
import { PlannedTaskStatus, TaskPriority } from "../domain/index.js";
import type { PlannedTaskService } from "../services/plannedTask.service.js";

function startOfWeekMonday(ref: Date): Date {
  const x = new Date(ref);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function defaultPlanningRange(): { start: Date; end: Date } {
  const start = startOfWeekMonday(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 56);
  return { start, end };
}

const createBodySchema = z
  .object({
    title: z.string().min(1).max(500).trim(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z.string().max(500).nullable().optional(),
    phaseLabel: z.string().max(200).nullable().optional(),
    taskStatus: z.nativeEnum(PlannedTaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine((d) => d.endsAt > d.startsAt, { message: "endsAt must be after startsAt" });

const updateBodySchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  location: z.string().max(500).nullable().optional(),
  phaseLabel: z.string().max(200).nullable().optional(),
  taskStatus: z.nativeEnum(PlannedTaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const emptyToNull = (s: string | null | undefined) => {
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > 0 ? t : null;
};

export class PlannedTasksController {
  constructor(private readonly planned: PlannedTaskService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    if (req.query.scope === "all") {
      const list = await this.planned.listAllForUser(projectId, userId);
      if (list === null) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.json({ tasks: list });
      return;
    }
    let start: Date;
    let end: Date;
    const sq = req.query.start;
    const eq = req.query.end;
    if (typeof sq === "string" && typeof eq === "string" && sq.length > 0 && eq.length > 0) {
      start = new Date(sq);
      end = new Date(eq);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        res.status(400).json({ error: "INVALID_RANGE" });
        return;
      }
    } else {
      const r = defaultPlanningRange();
      start = r.start;
      end = r.end;
    }
    const list = await this.planned.listForUser(projectId, userId, start, end);
    if (list === null) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ tasks: list, range: { start: start.toISOString(), end: end.toISOString() } });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    const task = await this.planned.createForUser(
      {
        projectId,
        title: b.title,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        location: emptyToNull(b.location ?? undefined),
        phaseLabel: emptyToNull(b.phaseLabel ?? undefined),
        taskStatus: b.taskStatus,
        priority: b.priority,
        sortOrder: b.sortOrder,
      },
      userId,
    );
    if (!task) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.status(201).json(task);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const taskId = req.params.taskId!;
    const parsed = updateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    const updated = await this.planned.updateForUser(projectId, taskId, userId, {
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      location: b.location !== undefined ? emptyToNull(b.location ?? undefined) : undefined,
      phaseLabel: b.phaseLabel !== undefined ? emptyToNull(b.phaseLabel ?? undefined) : undefined,
      taskStatus: b.taskStatus,
      priority: b.priority,
      sortOrder: b.sortOrder,
    });
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(updated);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const projectId = req.params.projectId!;
    const taskId = req.params.taskId!;
    const ok = await this.planned.deleteForUser(projectId, taskId, userId);
    if (!ok) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.status(204).send();
  };
}
