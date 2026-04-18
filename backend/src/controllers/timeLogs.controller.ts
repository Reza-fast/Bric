import type { Request, Response } from "express";
import { z } from "zod";
import type { TimeLog } from "../domain/index.js";
import { UserRole } from "../domain/index.js";
import type { TimeLogService } from "../services/timeLog.service.js";

const createSchema = z.object({
  /** `null` = day timer / clocked hours (no project). */
  projectId: z.union([z.string().uuid(), z.null()]),
  durationHours: z.number().positive().max(24),
  loggedAt: z.string().optional(),
  note: z.string().max(8000).nullable().optional(),
});

const listQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const MS_PER_DAY = 86_400_000;
const MAX_RANGE_DAYS = 400;

function serializeTimeLog(
  log: TimeLog & {
    projectName?: string;
    ownerEmail?: string;
    ownerDisplayName?: string;
  },
) {
  const base: Record<string, unknown> = {
    id: log.id,
    projectId: log.projectId,
    projectName: "projectName" in log && log.projectName !== undefined ? log.projectName : undefined,
    userId: log.userId,
    durationHours: log.durationHours,
    loggedAt: log.loggedAt.toISOString(),
    note: log.note,
    createdAt: log.createdAt.toISOString(),
  };
  if ("ownerEmail" in log && "ownerDisplayName" in log) {
    base.ownerEmail = log.ownerEmail;
    base.ownerDisplayName = log.ownerDisplayName;
  }
  return base;
}

export class TimeLogsController {
  constructor(private readonly timeLogs: TimeLogService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    const role = req.authUser?.role;
    if (!userId || role === undefined) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      return;
    }
    const q = parsed.data;
    const to = q.to ?? new Date();
    const from = q.from ?? new Date(to.getTime() - 28 * MS_PER_DAY);
    if (!(from < to)) {
      res.status(400).json({ error: "INVALID_RANGE" });
      return;
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * MS_PER_DAY) {
      res.status(400).json({ error: "RANGE_TOO_LARGE", maxDays: MAX_RANGE_DAYS });
      return;
    }
    const logs = await this.timeLogs.listForUserOrHr(userId, role, { from, to });
    res.json({ logs: logs.map((l) => serializeTimeLog(l)) });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const userId = req.authUser?.id;
    const role = req.authUser?.role;
    if (!userId || role === undefined) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const logId = req.params.id;
    if (!logId) {
      res.status(400).json({ error: "VALIDATION_ERROR" });
      return;
    }
    try {
      if (role === UserRole.Hr) {
        const r = await this.timeLogs.deleteForViewer(userId, role, logId);
        if (r === "NOT_FOUND") {
          res.status(404).json({ error: "NOT_FOUND" });
          return;
        }
        if (r === "FORBIDDEN") {
          res.status(403).json({ error: "FORBIDDEN" });
          return;
        }
        res.status(204).end();
        return;
      }
      const ok = await this.timeLogs.deleteForUser(userId, logId);
      if (!ok) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
      }
      res.status(204).end();
    } catch (e) {
      if (e instanceof Error && e.message === "CANNOT_DELETE_DAY_LOG") {
        res.status(409).json({ error: "CANNOT_DELETE_DAY_LOG" });
        return;
      }
      throw e;
    }
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
    try {
      const log = await this.timeLogs.create(userId, {
        projectId: body.projectId,
        durationHours: body.durationHours,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
        note: body.note ?? null,
      });
      res.status(201).json(serializeTimeLog(log));
    } catch (e) {
      if (e instanceof Error && e.message === "PROJECT_NOT_FOUND") {
        res.status(404).json({ error: "PROJECT_NOT_FOUND" });
        return;
      }
      if (e instanceof Error && e.message === "PROJECT_FORBIDDEN") {
        res.status(403).json({ error: "PROJECT_FORBIDDEN" });
        return;
      }
      if (e instanceof Error && e.message === "DAY_POOL_EMPTY") {
        res.status(409).json({ error: "DAY_POOL_EMPTY" });
        return;
      }
      if (e instanceof Error && e.message === "ALLOCATION_EXCEEDS_DAY_POOL") {
        res.status(409).json({ error: "ALLOCATION_EXCEEDS_DAY_POOL" });
        return;
      }
      throw e;
    }
  };
}
