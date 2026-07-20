import type { TimeLog, TimeLogCreateInput } from "../domain/index.js";
import { UserRole } from "../domain/index.js";
import { ProjectMembersRepository } from "../repositories/projectMembers.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";
import { TimeLogsRepository } from "../repositories/timeLogs.repository.js";

/** Tolerance for hour comparisons (floating point / rounding). */
const HOUR_EPS = 0.0005;

/** UTC calendar day containing `loggedAt`, as [start, end). */
function utcDayInterval(loggedAt: Date): { start: Date; end: Date } {
  const startMs = Date.UTC(
    loggedAt.getUTCFullYear(),
    loggedAt.getUTCMonth(),
    loggedAt.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return { start: new Date(startMs), end: new Date(startMs + 86_400_000) };
}

export type PersonnelProjectBreakdown = {
  projectId: string;
  name: string;
  hours: number;
};

export type PersonnelMonthBreakdown = {
  /** UTC calendar month as `YYYY-MM`. */
  monthKey: string;
  hours: number;
};

export type PersonnelAnalysisPerson = {
  userId: string;
  name: string;
  email: string;
  clockHours: number;
  projectHours: number;
  totalHours: number;
  projects: PersonnelProjectBreakdown[];
  months: PersonnelMonthBreakdown[];
};

export class TimeLogService {
  constructor(
    private readonly timeLogs: TimeLogsRepository,
    private readonly projects: ProjectsRepository,
    private readonly members: ProjectMembersRepository,
  ) {}

  async listForUserOrHr(
    actorUserId: string,
    actorRole: UserRole,
    range: { from: Date; to: Date },
  ): Promise<
    | Array<TimeLog & { projectName: string }>
    | Array<TimeLog & { projectName: string; ownerEmail: string; ownerDisplayName: string }>
  > {
    if (actorRole === UserRole.Hr) {
      return this.timeLogs.listAllInRange(range.from, range.to);
    }
    return this.timeLogs.listByUserInRange(actorUserId, range.from, range.to);
  }

  /**
   * HR-only aggregated roster: total hours per person, broken down by project and by month.
   */
  async personnelAnalysis(range: { from: Date; to: Date }): Promise<PersonnelAnalysisPerson[]> {
    const logs = await this.timeLogs.listAllInRange(range.from, range.to);

    type Acc = {
      userId: string;
      name: string;
      email: string;
      clockHours: number;
      projects: Map<string, PersonnelProjectBreakdown>;
      months: Map<string, number>;
    };

    const byUser = new Map<string, Acc>();

    for (const log of logs) {
      const existing = byUser.get(log.userId) ?? {
        userId: log.userId,
        name: log.ownerDisplayName,
        email: log.ownerEmail,
        clockHours: 0,
        projects: new Map(),
        months: new Map(),
      };

      existing.name = log.ownerDisplayName;
      existing.email = log.ownerEmail;

      const y = log.loggedAt.getUTCFullYear();
      const m = String(log.loggedAt.getUTCMonth() + 1).padStart(2, "0");
      const monthKey = `${y}-${m}`;
      existing.months.set(monthKey, (existing.months.get(monthKey) ?? 0) + log.durationHours);

      if (log.projectId === null) {
        existing.clockHours += log.durationHours;
      } else {
        const proj = existing.projects.get(log.projectId) ?? {
          projectId: log.projectId,
          name: log.projectName,
          hours: 0,
        };
        proj.hours += log.durationHours;
        proj.name = log.projectName;
        existing.projects.set(log.projectId, proj);
      }

      byUser.set(log.userId, existing);
    }

    return [...byUser.values()]
      .map((row): PersonnelAnalysisPerson => {
        const projects = [...row.projects.values()].sort((a, b) => b.hours - a.hours);
        const projectHours = projects.reduce((sum, p) => sum + p.hours, 0);
        const months = [...row.months.entries()]
          .map(([monthKey, hours]) => ({ monthKey, hours }))
          .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

        return {
          userId: row.userId,
          name: row.name,
          email: row.email,
          clockHours: row.clockHours,
          projectHours,
          totalHours: row.clockHours + projectHours,
          projects,
          months,
        };
      })
      .filter((row) => row.totalHours > 0)
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private async assertCanDeleteDayLog(log: TimeLog): Promise<void> {
    if (log.projectId !== null) return;
    const ownerId = log.userId;
    const { start, end } = utcDayInterval(log.loggedAt);
    const dayPool = await this.timeLogs.sumDayClockHoursForUserInRange(ownerId, start, end);
    const allocated = await this.timeLogs.sumProjectHoursForUserInRange(ownerId, start, end);
    const poolAfterDelete = dayPool - log.durationHours;
    if (allocated > poolAfterDelete + HOUR_EPS) {
      throw new Error("CANNOT_DELETE_DAY_LOG");
    }
  }

  /** Validates day-pool rules, then deletes by id. */
  private async removeLogAfterChecks(log: TimeLog): Promise<boolean> {
    await this.assertCanDeleteDayLog(log);
    return this.timeLogs.deleteById(log.id);
  }

  async deleteForUser(actorUserId: string, logId: string): Promise<boolean> {
    const log = await this.timeLogs.findByUserAndId(actorUserId, logId);
    if (!log) return false;
    return this.removeLogAfterChecks(log);
  }

  async deleteForViewer(
    actorUserId: string,
    actorRole: UserRole,
    logId: string,
  ): Promise<"NOT_FOUND" | "FORBIDDEN" | true> {
    const log = await this.timeLogs.findById(logId);
    if (!log) return "NOT_FOUND";
    if (actorRole !== UserRole.Hr && log.userId !== actorUserId) return "FORBIDDEN";
    const ok = await this.removeLogAfterChecks(log);
    return ok ? true : "NOT_FOUND";
  }

  async create(actorUserId: string, input: Omit<TimeLogCreateInput, "userId">): Promise<TimeLog> {
    const loggedAt = input.loggedAt ?? new Date();

    if (input.projectId === null) {
      return this.timeLogs.create({
        projectId: null,
        userId: actorUserId,
        durationHours: input.durationHours,
        loggedAt,
        note: input.note ?? null,
      });
    }

    const project = await this.projects.findById(input.projectId);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    const isMember = await this.members.isMember(input.projectId, actorUserId);
    if (!isMember) {
      throw new Error("PROJECT_FORBIDDEN");
    }

    const { start, end } = utcDayInterval(loggedAt);
    const dayPool = await this.timeLogs.sumDayClockHoursForUserInRange(actorUserId, start, end);
    const allocated = await this.timeLogs.sumProjectHoursForUserInRange(actorUserId, start, end);

    if (dayPool < HOUR_EPS) {
      throw new Error("DAY_POOL_EMPTY");
    }
    if (allocated + input.durationHours > dayPool + HOUR_EPS) {
      throw new Error("ALLOCATION_EXCEEDS_DAY_POOL");
    }

    return this.timeLogs.create({
      ...input,
      userId: actorUserId,
      loggedAt,
    });
  }
}
