"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MemberDetailModal } from "@/components/team/MemberDetailModal";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { type TeamMember, fetchTeamDirectory, inviteTeamMember } from "@/lib/api/team";
import type { UserRole } from "@/lib/api/roles";
import { canAccessTeam } from "@/lib/api/roles";
import "@/components/team/team.css";

const ROLE_VALUES: UserRole[] = ["architect", "contractor", "subcontractor", "client"];
const FILTER_ROLES = ["all", "architect", "contractor", "subcontractor", "client", "hr"] as const;
type RoleFilter = (typeof FILTER_ROLES)[number];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function pillClass(status: string, index: number): string {
  if (status === "critical") return "team-pill team-pill--peach";
  if (status === "completed" || status === "inactive") return "team-pill team-pill--muted";
  if (index % 5 === 2) return "team-pill team-pill--peach";
  return "team-pill team-pill--blue";
}

export default function TeamPage() {
  const t = useTranslations("Team");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<ProjectPortfolioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("contractor");
  const [inviteFunction, setInviteFunction] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState(false);
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
      if (!team) setError(t("loadError"));
    })();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const metrics = useMemo(() => {
    const total = members.length;
    const activeOnProjects = members.filter((m) => m.activeProjectCount > 0).length;
    const projectCount = new Set(members.flatMap((m) => m.projects.map((p) => p.id))).size;
    const utilization = total === 0 ? 0 : Math.round((activeOnProjects / total) * 100);
    return { total, activeOnProjects, projectCount, utilization };
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (roleFilter === "all") return members;
    return members.filter((m) => m.role === roleFilter);
  }, [members, roleFilter]);

  async function refreshTeamDirectory(): Promise<void> {
    const team = await fetchTeamDirectory();
    if (!team) return;
    setMembers(team);
    setDetailMember((prev) => (prev ? team.find((x) => x.userId === prev.userId) ?? null : null));
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setInviteMsg(null);
    setInviteOk(false);
    if (selectedProjectIds.length === 0) {
      setInviteMsg(t("chooseOneProject"));
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
      if (res.status === 400) setInviteMsg(t("inviteCheckFields"));
      else if (res.status === 403) setInviteMsg(t("inviteForbidden"));
      else if (res.status === 404) setInviteMsg(t("inviteInvalidProjects"));
      else setInviteMsg(t("inviteFailed"));
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
    setInviteOk(true);
    setInviteMsg(
      res.temporaryPassword
        ? t("inviteCreatedWithPassword", { password: res.temporaryPassword })
        : t("inviteSuccess"),
    );
  }

  return (
    <DashboardShell user={user} fullBleed>
      <div className="team-page">
        <div className="team-page-inner">
          <header>
            <p className="team-eyebrow">{t("eyebrow")}</p>
            <h1 className="team-title">{t("title")}</h1>
            <p className="team-subtitle">{t("subtitle")}</p>
          </header>

          <div className="team-metrics">
            <div className="team-metric-card">
              <div className="team-metric-label">{t("totalPersonnel")}</div>
              <div className="team-metric-value">{metrics.total}</div>
              <div className="team-metric-hint">{t("metricInDirectory")}</div>
            </div>
            <div className="team-metric-card">
              <div className="team-metric-label">{t("onProjectsNow")}</div>
              <div className="team-metric-value">{metrics.activeOnProjects}</div>
              <div className="team-metric-hint">{t("metricUtilization", { pct: metrics.utilization })}</div>
            </div>
            <div className="team-metric-card">
              <div className="team-metric-label">{t("projectCoverage")}</div>
              <div className="team-metric-value">{metrics.projectCount}</div>
              <div className="team-metric-hint">{t("metricActiveSites")}</div>
            </div>
          </div>

          <div className="team-layout">
            <section className="team-ledger">
              <div className="team-ledger-head">
                <h2 className="team-ledger-title">{t("personnelLedger")}</h2>
                <select
                  className="team-role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  aria-label={t("allRoles")}
                >
                  {FILTER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role === "all" ? t("allRoles") : t(`roles.${role}`)}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <p className="team-empty">{t("loading")}</p>
              ) : error ? (
                <p className="team-empty" style={{ color: "#b91c1c" }}>
                  {error}
                </p>
              ) : filteredMembers.length === 0 ? (
                <p className="team-empty">{t("empty")}</p>
              ) : (
                <div className="team-table-scroll">
                  <table className="team-table">
                    <thead>
                      <tr>
                        <th>{t("colMember")}</th>
                        <th>{t("colRoleTitle")}</th>
                        <th>{t("colAllocations")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m) => (
                        <tr
                          key={m.userId}
                          tabIndex={0}
                          role="button"
                          aria-label={t("openDetails", { name: m.displayName })}
                          onClick={() => setDetailMember(m)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDetailMember(m);
                            }
                          }}
                        >
                          <td>
                            <div className="team-member-cell">
                              <div className="team-avatar">{initials(m.displayName)}</div>
                              <div style={{ minWidth: 0 }}>
                                <div className="team-member-name">{m.displayName}</div>
                                <div className="team-member-email">{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="team-role-primary">{t(`roles.${m.role}`)}</div>
                            <div className="team-role-secondary">{m.functionTitle ?? tCommon("emDash")}</div>
                          </td>
                          <td>
                            <div className="team-pills">
                              {m.projects.length === 0 ? (
                                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{tCommon("emDash")}</span>
                              ) : (
                                m.projects.map((p, i) => (
                                  <span key={`${m.userId}-${p.id}`} className={pillClass(p.status, i)} title={p.name}>
                                    {p.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="team-invite">
              <h2 className="team-invite-title">{t("quickInvite")}</h2>
              <form className="team-invite-form" onSubmit={(e) => void onInvite(e)}>
                <label className="team-invite-label">
                  {t("fullName")}
                  <input
                    className="team-invite-input"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    required
                  />
                </label>
                <label className="team-invite-label">
                  {t("email")}
                  <input
                    className="team-invite-input"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    required
                  />
                </label>
                <label className="team-invite-label">
                  {t("role")}
                  <select
                    className="team-invite-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  >
                    {ROLE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`roles.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="team-invite-label">
                  {t("functionTitle")}
                  <input
                    className="team-invite-input"
                    value={inviteFunction}
                    onChange={(e) => setInviteFunction(e.target.value)}
                    placeholder={t("functionPlaceholder")}
                  />
                </label>

                <div className="team-assign-label">{t("assignProjects")}</div>
                <div className="team-project-list">
                  {projects.length === 0 ? (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{t("noProjectsFound")}</div>
                  ) : (
                    projects.map((p) => (
                      <label key={p.id} className="team-project-option">
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.includes(p.id)}
                          onChange={(e) => {
                            setSelectedProjectIds((prev) =>
                              e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            );
                          }}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))
                  )}
                </div>

                {inviteMsg ? (
                  <p className={`team-invite-msg ${inviteOk ? "team-invite-msg--ok" : "team-invite-msg--err"}`}>
                    {inviteMsg}
                  </p>
                ) : null}

                <button type="submit" className="app-btn app-btn-primary team-invite-submit" disabled={inviting}>
                  {inviting ? t("sendingInvite") : t("inviteMember")}
                </button>
              </form>
            </aside>
          </div>
        </div>
      </div>

      {detailMember ? (
        <MemberDetailModal
          member={detailMember}
          allProjects={projects}
          currentUserId={user?.id}
          onClose={() => setDetailMember(null)}
          onMembershipsChanged={() => void refreshTeamDirectory()}
        />
      ) : null}
    </DashboardShell>
  );
}
