import type { Activity, PlannedTask, ProjectHoursSummary } from "../domain/index.js";
import { ReportStatus } from "../domain/index.js";
import { ActivitiesRepository } from "../repositories/activities.repository.js";
import { PlannedTasksRepository } from "../repositories/plannedTasks.repository.js";
import { ProjectMembersRepository } from "../repositories/projectMembers.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";
import { ReportsRepository } from "../repositories/reports.repository.js";
import { TimeLogsRepository } from "../repositories/timeLogs.repository.js";

function startOfUtcWeek(reference: Date): Date {
  const day = reference.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate(),
    ),
  );
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function addDaysUtc(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function isoWeekNumberUTC(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export interface DashboardPayload {
  metrics: {
    activeProjects: number;
    totalHoursThisWeek: number;
    weekLabel: string;
    pendingReportsActionRequired: number;
  };
  activities: Activity[];
  projectHours: ProjectHoursSummary[];
  weekTasks: PlannedTask[];
  weekRange: { start: string; end: string };
}

export class DashboardService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly timeLogs: TimeLogsRepository,
    private readonly reports: ReportsRepository,
    private readonly activities: ActivitiesRepository,
    private readonly plannedTasks: PlannedTasksRepository,
    private readonly members: ProjectMembersRepository,
  ) {}

  async getDashboardForUser(userId: string, referenceDate = new Date()): Promise<DashboardPayload> {
    const projectIds = await this.members.listProjectIdsByUser(userId);
    const weekStart = startOfUtcWeek(referenceDate);
    const weekEnd = addDaysUtc(weekStart, 7);

    const [activeProjects, totalHoursThisWeek, pendingReportsActionRequired, feed, projectHours, weekTasks] =
      await Promise.all([
        this.projects.countActiveInProjectIds(projectIds),
        this.timeLogs.sumDayClockHoursForUserInRange(userId, weekStart, weekEnd),
        this.reports.countByStatusInProjects(ReportStatus.ActionRequired, projectIds),
        this.activities.listRecentForProjects(projectIds, 15),
        this.projects.listHoursSummariesInProjectIds(projectIds),
        this.plannedTasks.listInRangeForProjects(weekStart, weekEnd, projectIds),
      ]);

    return {
      metrics: {
        activeProjects,
        totalHoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
        weekLabel: `Week ${isoWeekNumberUTC(weekStart)}`,
        pendingReportsActionRequired,
      },
      activities: feed,
      projectHours,
      weekTasks,
      weekRange: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      },
    };
  }
}
