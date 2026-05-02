import { randomBytes } from "node:crypto";
import { hashPassword } from "../auth/password.js";
import { config } from "../config.js";
import { UserRole } from "../domain/index.js";
import type { TeamDirectoryRow } from "../repositories/projectMembers.repository.js";
import { ProjectMembersRepository } from "../repositories/projectMembers.repository.js";
import { ProjectsRepository } from "../repositories/projects.repository.js";
import { TimeLogsRepository } from "../repositories/timeLogs.repository.js";
import { UsersRepository } from "../repositories/users.repository.js";

export interface TeamMemberSummary {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  functionTitle: string | null;
  activeProjectCount: number;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    functionTitle: string | null;
  }>;
}

function aggregateDirectoryRows(rows: TeamDirectoryRow[]): TeamMemberSummary[] {
  const map = new Map<string, TeamMemberSummary>();

  for (const row of rows) {
    const functionTitle = row.member_function?.trim() ? row.member_function.trim() : null;
    if (!map.has(row.user_id)) {
      map.set(row.user_id, {
        userId: row.user_id,
        displayName: row.display_name,
        email: row.email,
        role: row.role as UserRole,
        avatarUrl: row.avatar_url,
        functionTitle,
        activeProjectCount: 0,
        projects: [],
      });
    }
    const member = map.get(row.user_id)!;
    member.projects.push({
      id: row.project_id,
      name: row.project_name,
      status: row.project_status,
      functionTitle,
    });
    if (functionTitle && !member.functionTitle) {
      member.functionTitle = functionTitle;
    }
    if (row.project_status === "active" || row.project_status === "planning" || row.project_status === "critical") {
      member.activeProjectCount += 1;
    }
  }

  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface MemberHoursBreakdown {
  userId: string;
  byProject: Array<{ projectId: string; projectName: string; hours: number }>;
  dayPoolHours: number;
  totalLoggedHours: number;
}

export class TeamService {
  constructor(
    private readonly members: ProjectMembersRepository,
    private readonly users: UsersRepository,
    private readonly projects: ProjectsRepository,
    private readonly timeLogs: TimeLogsRepository,
  ) {}

  /** Full org directory (HR). */
  async listOrgDirectory(): Promise<TeamMemberSummary[]> {
    const rows = await this.members.listTeamDirectoryRowsAll();
    return aggregateDirectoryRows(rows);
  }

  async listDirectoryForUser(userId: string): Promise<TeamMemberSummary[]> {
    const projectIds = await this.members.listProjectIdsByUser(userId);
    const rows = await this.members.listTeamDirectoryRows(projectIds);
    return aggregateDirectoryRows(rows);
  }

  async inviteForUser(input: {
    inviterUserId: string;
    email: string;
    displayName: string;
    role: UserRole;
    functionTitle: string | null;
    projectIds: string[];
  }): Promise<{ member: TeamMemberSummary; temporaryPassword: string | null } | null> {
    if (input.role === UserRole.Hr) {
      throw new Error("HR_INVITE_NOT_ALLOWED");
    }

    const allIds = await this.projects.listAllIds();
    const allowed = new Set(allIds);
    const requested = [...new Set(input.projectIds)].filter((id) => allowed.has(id));
    if (requested.length === 0) return null;

    const existing = await this.users.findByEmailWithHash(input.email);
    let temporaryPassword: string | null = null;
    const user = existing?.user
      ? existing.user
      : await (async () => {
          temporaryPassword = `Bric!${randomBytes(8).toString("hex")}`;
          const passwordHash = await hashPassword(temporaryPassword, config.bcryptRounds);
          return this.users.createWithPasswordHash({
            email: input.email.trim().toLowerCase(),
            displayName: input.displayName.trim(),
            role: input.role,
            passwordHash,
            avatarUrl: null,
          });
        })();

    const normalizedFunction = input.functionTitle?.trim() ? input.functionTitle.trim() : null;
    for (const projectId of requested) {
      await this.members.addOrUpdateMemberWithFunction(projectId, user.id, normalizedFunction);
    }

    const directory = await this.listOrgDirectory();
    const member = directory.find((m) => m.userId === user.id) ?? null;
    if (!member) return null;
    return { member, temporaryPassword };
  }

  /** HR: logged hours per project (+ day pool) for any user. */
  async getMemberHoursBreakdown(userId: string): Promise<MemberHoursBreakdown | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    const byProject = await this.timeLogs.aggregateHoursByProjectForUser(userId);
    const dayPoolHours = await this.timeLogs.sumDayPoolHoursAllTimeForUser(userId);
    const totalProjectHours = byProject.reduce((s, r) => s + r.hours, 0);
    const totalLoggedHours = totalProjectHours + dayPoolHours;
    return { userId, byProject, dayPoolHours, totalLoggedHours };
  }

  /** HR: add project membership (idempotent). */
  async assignUserToProject(userId: string, projectId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    const project = await this.projects.findById(projectId);
    if (!user || !project) return false;
    await this.members.addMember(projectId, userId);
    return true;
  }

  /** HR: remove project membership. */
  async removeUserFromProject(userId: string, projectId: string): Promise<boolean> {
    return this.members.removeMember(projectId, userId);
  }
}
