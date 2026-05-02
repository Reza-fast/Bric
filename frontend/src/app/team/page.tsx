"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MemberDetailModal } from "@/components/team/MemberDetailModal";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { type TeamMember, fetchTeamDirectory, inviteTeamMember } from "@/lib/api/team";
import type { UserRole } from "@/lib/api/roles";
import { canAccessTeam } from "@/lib/api/roles";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "architect", label: "Architect" },
  { value: "contractor", label: "Contractor" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "client", label: "Client" },
];

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function statusPillColor(status: string): { bg: string; fg: string } {
  if (status === "active") return { bg: "#dcfce7", fg: "#166534" };
  if (status === "critical") return { bg: "#ffedd5", fg: "#c2410c" };
  if (status === "planning") return { bg: "#e0f2fe", fg: "#0369a1" };
  if (status === "completed") return { bg: "#e4e4e7", fg: "#3f3f46" };
  return { bg: "#f1f5f9", fg: "#334155" };
}

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<ProjectPortfolioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("contractor");
  const [inviteFunction, setInviteFunction] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await meRequest();
      if (cancelled) return;
      const u = me?.user ?? null;
      setUser(u);
      if (!u || !canAccessTeam(u.role)) {
        router.replace("/dashboard");
        return;
      }
      const [team, portfolio] = await Promise.all([fetchTeamDirectory(), fetchProjectPortfolio()]);
      if (cancelled) return;
      setMembers(team ?? []);
      setProjects(portfolio ?? []);
      setSelectedProjectIds((portfolio ?? []).filter((p) => p.status !== "completed").slice(0, 1).map((p) => p.id));
      setLoading(false);
      if (!team) setError("Could not load team members.");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const metrics = useMemo(() => {
    const total = members.length;
    const activeToday = members.filter((m) => m.activeProjectCount > 0).length;
    const projectCount = new Set(members.flatMap((m) => m.projects.map((p) => p.id))).size;
    return { total, activeToday, projectCount };
  }, [members]);

  async function refreshTeamDirectory(): Promise<void> {
    const team = await fetchTeamDirectory();
    if (!team) return;
    setMembers(team);
    setDetailMember((prev) => (prev ? team.find((x) => x.userId === prev.userId) ?? null : null));
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    if (selectedProjectIds.length === 0) {
      setInviteMsg("Choose at least one project.");
      return;
    }
    setInviting(true);
    const res = await inviteTeamMember({
      email: inviteEmail.trim(),
      displayName: inviteName.trim(),
      role: inviteRole,
      functionTitle: inviteFunction.trim() || null,
      projectIds: selectedProjectIds,
    });
    setInviting(false);
    if (!res.ok) {
      if (res.status === 400) setInviteMsg("Please check the invite fields.");
      else if (res.status === 403) setInviteMsg("You do not have permission to invite team members.");
      else if (res.status === 404) setInviteMsg("Invite failed: choose valid projects.");
      else setInviteMsg("Could not invite this member right now.");
      return;
    }
    setMembers((prev) => {
      const idx = prev.findIndex((x) => x.userId === res.member.userId);
      if (idx === -1) return [res.member, ...prev];
      const clone = [...prev];
      clone[idx] = res.member;
      return clone;
    });
    setInviteEmail("");
    setInviteName("");
    setInviteFunction("");
    setInviteMsg(
      res.temporaryPassword
        ? `Member created and assigned. Temporary password: ${res.temporaryPassword}`
        : "Member invited and assigned.",
    );
  }

  return (
    <DashboardShell user={user} fullBleed>
      <div style={{ padding: "1.25rem clamp(1rem, 3vw, 2rem)", width: "100%" }}>
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748b", letterSpacing: "0.12em", fontWeight: 700 }}>TEAM DIRECTORY</div>
          <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.8rem", fontWeight: 800 }}>Manage Team Members</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#64748b", maxWidth: 720 }}>
            Invite new members, assign their function, and see which projects they are currently on. Select someone in the table to view hours by project and manage assignments.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "0.85rem 1rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>TOTAL PERSONNEL</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, marginTop: 2 }}>{metrics.total}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "0.85rem 1rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>ON PROJECTS NOW</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, marginTop: 2 }}>{metrics.activeToday}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "0.85rem 1rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>PROJECT COVERAGE</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, marginTop: 2 }}>{metrics.projectCount}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "1rem", alignItems: "start" }}>
          <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
            {loading ? (
              <p style={{ margin: 0, padding: "1rem", color: "#64748b" }}>Loading team…</p>
            ) : error ? (
              <p style={{ margin: 0, padding: "1rem", color: "#b91c1c" }}>{error}</p>
            ) : members.length === 0 ? (
              <p style={{ margin: 0, padding: "1rem", color: "#64748b" }}>No team members yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.75rem 0.9rem", color: "#64748b" }}>Member</th>
                    <th style={{ padding: "0.75rem 0.9rem", color: "#64748b" }}>Function</th>
                    <th style={{ padding: "0.75rem 0.9rem", color: "#64748b" }}>Current projects</th>
                    <th style={{ padding: "0.75rem 0.9rem", color: "#64748b" }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr
                      key={m.userId}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open details for ${m.displayName}`}
                      onClick={() => setDetailMember(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailMember(m);
                        }
                      }}
                      style={{
                        borderBottom: idx < members.length - 1 ? "1px solid #f1f5f9" : undefined,
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.9rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: "#e2e8f0",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#334155",
                              flexShrink: 0,
                            }}
                          >
                            {initials(m.displayName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{m.displayName}</div>
                            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.9rem", color: "#334155" }}>{m.functionTitle ?? "—"}</td>
                      <td style={{ padding: "0.75rem 0.9rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {m.projects.length === 0 ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            m.projects.map((p) => {
                              const c = statusPillColor(p.status);
                              return (
                                <span
                                  key={`${m.userId}-${p.id}`}
                                  style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    padding: "0.2rem 0.45rem",
                                    borderRadius: 999,
                                    background: c.bg,
                                    color: c.fg,
                                  }}
                                >
                                  {p.name}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.9rem", color: "#475569" }}>{roleLabel(m.role)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <aside style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: "1rem" }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 800 }}>Quick Invite</h2>
            <form onSubmit={(e) => void onInvite(e)} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", fontWeight: 600 }}>
                Full name
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #cbd5e1" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", fontWeight: 600 }}>
                Email
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #cbd5e1" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", fontWeight: 600 }}>
                Role
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", fontWeight: 600 }}>
                Function / title
                <input
                  value={inviteFunction}
                  onChange={(e) => setInviteFunction(e.target.value)}
                  placeholder="Site Manager, Structural Engineer..."
                  style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </label>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Assign projects</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflow: "auto", paddingRight: 4 }}>
                {projects.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>No projects found.</div>
                ) : (
                  projects.map((p) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(p.id)}
                        onChange={(e) => {
                          setSelectedProjectIds((prev) =>
                            e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                          );
                        }}
                      />
                      {p.name}
                    </label>
                  ))
                )}
              </div>
              {inviteMsg ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.82rem",
                    color:
                      inviteMsg.startsWith("Could") ||
                      inviteMsg.startsWith("Please") ||
                      inviteMsg.startsWith("Invite failed")
                        ? "#b91c1c"
                        : "#047857",
                  }}
                >
                  {inviteMsg}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={inviting}
                style={{
                  marginTop: "0.35rem",
                  border: "none",
                  borderRadius: 10,
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 700,
                  padding: "0.62rem 0.9rem",
                  cursor: inviting ? "wait" : "pointer",
                }}
              >
                {inviting ? "Sending invite…" : "Invite member"}
              </button>
            </form>
          </aside>
        </div>
      </div>

      {detailMember ? (
        <MemberDetailModal
          member={detailMember}
          allProjects={projects}
          onClose={() => setDetailMember(null)}
          onMembershipsChanged={() => void refreshTeamDirectory()}
        />
      ) : null}
    </DashboardShell>
  );
}
