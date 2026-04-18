import { apiFetch } from "./client";
import type { UserRole } from "./roles";

export interface TeamProjectAssignment {
  id: string;
  name: string;
  status: string;
  functionTitle: string | null;
}

export interface TeamMember {
  userId: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  functionTitle: string | null;
  activeProjectCount: number;
  projects: TeamProjectAssignment[];
}

export async function fetchTeamDirectory(): Promise<TeamMember[] | null> {
  const res = await apiFetch("/api/team", { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { members: TeamMember[] };
  return json.members;
}

export async function inviteTeamMember(payload: {
  email: string;
  displayName: string;
  role: UserRole;
  functionTitle?: string | null;
  projectIds: string[];
}): Promise<
  | { ok: true; member: TeamMember; temporaryPassword: string | null }
  | { ok: false; status: number; error?: string }
> {
  const res = await apiFetch("/api/team/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = json as { error?: string };
    return { ok: false, status: res.status, error: body.error };
  }
  const body = json as { member: TeamMember; temporaryPassword?: string | null };
  return { ok: true, member: body.member, temporaryPassword: body.temporaryPassword ?? null };
}
