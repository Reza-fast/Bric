import type { Request, Response } from "express";
import { z } from "zod";
import type { TimeLogService } from "../services/timeLog.service.js";

const createSchema = z.object({
  projectId: z.string().uuid(),
  durationHours: z.number().positive(),
  loggedAt: z.string().optional(),
  note: z.string().nullable().optional(),
});

export class TimeLogsController {
  constructor(private readonly timeLogs: TimeLogService) {}

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
    try {
      const log = await this.timeLogs.create(userId, {
        projectId: body.projectId,
        durationHours: body.durationHours,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
        note: body.note ?? null,
      });
      res.status(201).json(log);
    } catch (e) {
      if (e instanceof Error && e.message === "PROJECT_NOT_FOUND") {
        res.status(404).json({ error: "PROJECT_NOT_FOUND" });
        return;
      }
      if (e instanceof Error && e.message === "PROJECT_FORBIDDEN") {
        res.status(403).json({ error: "PROJECT_FORBIDDEN" });
        return;
      }
      throw e;
    }
  };
}
