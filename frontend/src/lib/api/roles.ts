export type UserRole = "hr" | "architect" | "contractor" | "subcontractor" | "client";

export function isHr(role: UserRole | string | undefined | null): boolean {
  return role === "hr";
}

/** Team directory and invites (backend enforces HR-only). */
export function canAccessTeam(role: UserRole | string | undefined | null): boolean {
  return isHr(role);
}
