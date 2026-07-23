"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ProjectPortfolioCard } from "@/lib/api/projects";
import type { UserRole } from "@/lib/api/roles";
import type { TeamMember } from "@/lib/api/team";
import {
  assignTeamMemberToProject,
  deleteTeamMember,
  fetchTeamMemberHours,
  removeTeamMemberFromProject,
  updateTeamMemberRole,
  type MemberHoursBreakdown,
} from "@/lib/api/team";
import { useIsMobile } from "@/lib/useMediaQuery";

/** Roles for staff inside the architect firm (directory edit). */
const FIRM_ROLE_VALUES: UserRole[] = ["hr", "architect"];

const FIRM_ROLES = new Set<UserRole>(["hr", "architect"]);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function footerUid(member: TeamMember): string {
  const compact = member.userId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const tag = initials(member.displayName).replace(/\s/g, "") || "MBR";
  return `BRIC_TEAM_${compact}_${tag}`;
}

type Props = {
  member: TeamMember;
  allProjects: ProjectPortfolioCard[];
  currentUserId?: string | null;
  onClose: () => void;
  onMembershipsChanged: () => void;
};

function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "0";
  return h >= 10 ? h.toFixed(1) : h.toFixed(2);
}

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  color: "#64748b",
};

const sectionDesc: CSSProperties = {
  margin: "0.45rem 0 0",
  fontSize: "0.8rem",
  lineHeight: 1.45,
  color: "#64748b",
};

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v0M9 12v0M9 15v0M9 18v0" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

export function MemberDetailModal({ member, allProjects, currentUserId, onClose, onMembershipsChanged }: Props) {
  const t = useTranslations("MemberModal");
  const tTeam = useTranslations("Team");
  const tCommon = useTranslations("Common");
  const isMobile = useIsMobile(640);

  function roleLabel(role: UserRole): string {
    if (role === "hr") return tTeam("roles.hrFull");
    return tTeam(`roles.${role}`);
  }
  const sectionGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 220px) minmax(0, 1fr)",
    gap: isMobile ? "0.65rem" : "1rem 1.75rem",
    alignItems: "start",
  };
  const [breakdown, setBreakdown] = useState<MemberHoursBreakdown | null>(null);
  const [loadHours, setLoadHours] = useState(true);
  const [hoursError, setHoursError] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>(() => (FIRM_ROLES.has(member.role) ? member.role : "architect"));
  const [savingRole, setSavingRole] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");

  useEffect(() => {
    setRoleDraft(FIRM_ROLES.has(member.role) ? member.role : "architect");
    setRoleMsg(null);
    setAssignSearch("");
  }, [member.userId, member.role]);

  const reloadHours = useCallback(async () => {
    setLoadHours(true);
    setHoursError(false);
    const data = await fetchTeamMemberHours(member.userId);
    if (data === null) setHoursError(true);
    else setBreakdown(data);
    setLoadHours(false);
  }, [member.userId]);

  useEffect(() => {
    void reloadHours();
  }, [reloadHours]);

  const assignedIds = new Set(member.projects.map((p) => p.id));
  const canAdd = allProjects.filter((p) => !assignedIds.has(p.id));
  const filteredCanAdd = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return canAdd;
    return canAdd.filter((p) => p.name.toLowerCase().includes(q));
  }, [canAdd, assignSearch]);

  async function onAddProject(projectId: string) {
    setActionError(null);
    setBusyProjectId(projectId);
    const ok = await assignTeamMemberToProject(member.userId, projectId);
    setBusyProjectId(null);
    if (!ok) {
      setActionError(t("addProjectFailed"));
      return;
    }
    setAssignSearch("");
    onMembershipsChanged();
  }

  const isSelf = currentUserId != null && member.userId === currentUserId;
  const roleDirty = roleDraft !== member.role;

  async function onSaveRole() {
    if (!roleDirty) return;
    setActionError(null);
    setRoleMsg(null);
    setSavingRole(true);
    const res = await updateTeamMemberRole(member.userId, roleDraft);
    setSavingRole(false);
    if (!res.ok) {
      if (res.status === 404) setActionError(t("roleUpdateGone"));
      else setActionError(t("roleUpdateFailed"));
      return;
    }
    setRoleMsg(t("roleUpdated"));
    onMembershipsChanged();
  }

  async function onDeleteMember() {
    if (!window.confirm(t("confirmDelete", { name: member.displayName }))) {
      return;
    }
    setActionError(null);
    setDeleting(true);
    const ok = await deleteTeamMember(member.userId);
    setDeleting(false);
    if (!ok) {
      setActionError(t("removeAccountFailed"));
      return;
    }
    onMembershipsChanged();
    onClose();
  }

  async function onRemoveProject(projectId: string, projectName: string) {
    if (!window.confirm(t("confirmUnassign", { name: member.displayName, project: projectName }))) {
      return;
    }
    setActionError(null);
    setBusyProjectId(projectId);
    const ok = await removeTeamMemberFromProject(member.userId, projectId);
    setBusyProjectId(null);
    if (!ok) {
      setActionError(t("removeAssignmentFailed"));
      return;
    }
    onMembershipsChanged();
  }

  const totalHoursDisplay =
    breakdown && !loadHours && !hoursError ? `${formatHours(breakdown.totalLoggedHours)}h` : tCommon("emDash");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: isMobile ? "0.75rem" : "1.25rem",
        overflow: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          marginTop: isMobile ? "0.35rem" : "1rem",
          marginBottom: isMobile ? "1rem" : "2rem",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "var(--surface)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? "1.1rem 1rem" : "1.35rem 1.5rem",
            borderBottom: "1px solid #e8eef5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", minWidth: 0 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "linear-gradient(145deg, #e0e7ff 0%, #c7d2fe 100%)",
                display: "grid",
                placeItems: "center",
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "#312e81",
                flexShrink: 0,
              }}
            >
              {initials(member.displayName)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="member-detail-title" style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
                {member.displayName}
              </h2>
              <div style={{ fontSize: "0.9rem", color: "#64748b", marginTop: 6 }}>{member.email}</div>
            </div>
          </div>
          <button
            type="button"
            aria-label={tCommon("close")}
            onClick={onClose}
            style={{
              padding: "0.5rem",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            <IconX />
          </button>
        </div>

        <div style={{ padding: isMobile ? "1.1rem 1rem 0" : "1.5rem 1.5rem 0" }}>
          {actionError ? (
            <p style={{ margin: "0 0 1rem", padding: "0.65rem 0.85rem", borderRadius: 10, background: "#fef2f2", color: "#991b1b", fontSize: "0.85rem" }}>
              {actionError}
            </p>
          ) : null}

          {!FIRM_ROLES.has(member.role) ? (
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#b45309", background: "#fffbeb", padding: "0.55rem 0.75rem", borderRadius: 8, border: "1px solid #fde68a" }}>
              {t("firmRoleHint", { role: roleLabel(member.role) })}
            </p>
          ) : null}

          {/* Role management */}
          <div style={{ ...sectionGrid, marginBottom: "1.75rem" }}>
            <div>
              <h3 style={sectionTitle}>{t("roleManagement")}</h3>
              <p style={sectionDesc}>{t("roleDesc")}</p>
            </div>
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: "1rem 1.1rem",
              }}
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", color: "#3b82f6", marginBottom: "0.5rem" }}>
                {t("currentAppRole")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
                <select
                  value={roleDraft}
                  onChange={(e) => {
                    setRoleDraft(e.target.value as UserRole);
                    setRoleMsg(null);
                  }}
                  style={{
                    flex: "1 1 200px",
                    minWidth: 0,
                    padding: "0.55rem 0.65rem",
                    borderRadius: 8,
                    border: "1px solid #93c5fd",
                    background: "var(--surface)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {FIRM_ROLE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value === "hr" ? tTeam("roles.hrFull") : tTeam(`roles.${value}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={savingRole || !roleDirty}
                  onClick={() => void onSaveRole()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.55rem 1rem",
                    borderRadius: 8,
                    border: "none",
                    background: savingRole || !roleDirty ? "#94a3b8" : "var(--text)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: savingRole || !roleDirty ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <IconSave />
                  {savingRole ? t("savingRole") : t("saveRole")}
                </button>
              </div>
              {roleMsg ? (
                <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#047857", fontWeight: 600 }}>{roleMsg}</p>
              ) : null}
            </div>
          </div>

          {/* Logged hours */}
          <div style={{ ...sectionGrid, marginBottom: "1.75rem" }}>
            <div>
              <h3 style={sectionTitle}>{t("loggedHours")}</h3>
              <p style={sectionDesc}>{t("hoursDesc")}</p>
              <div
                style={{
                  marginTop: "1rem",
                  borderRadius: 12,
                  background: "#ffedd5",
                  border: "1px solid #fdba74",
                  padding: "1rem 1.1rem",
                }}
              >
                <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.1em", color: "#c2410c" }}>{t("totalLogged")}</div>
                <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#9a3412", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{totalHoursDisplay}</div>
              </div>
            </div>
            <div>
              {loadHours ? (
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>{t("hoursLoading")}</p>
              ) : hoursError ? (
                <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{t("hoursLoadError")}</p>
              ) : breakdown ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fafbfc" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "0.5rem",
                      padding: "0.65rem 1rem",
                      background: "#f1f5f9",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "#64748b",
                    }}
                  >
                    <span>{t("projectName")}</span>
                    <span style={{ textAlign: "right" }}>{t("hoursCol")}</span>
                  </div>
                  <div style={{ maxHeight: 220, overflow: "auto" }}>
                    {breakdown.byProject.length === 0 ? (
                      <p style={{ margin: 0, padding: "1rem", color: "#94a3b8", fontSize: "0.88rem" }}>{t("noHours")}</p>
                    ) : (
                      breakdown.byProject.map((row) => (
                        <div
                          key={row.projectId}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: "0.5rem",
                            padding: "0.6rem 1rem",
                            borderTop: "1px solid #e8eef5",
                            fontSize: "0.88rem",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                            <span style={{ color: "var(--text)", fontSize: "0.5rem" }}>●</span>
                            {row.projectName}
                          </span>
                          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#334155" }}>{formatHours(row.hours)}</span>
                        </div>
                      ))
                    )}
                    {breakdown.dayPoolHours > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "0.5rem",
                          padding: "0.6rem 1rem",
                          borderTop: "1px solid #e8eef5",
                          fontSize: "0.88rem",
                          color: "#64748b",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <span style={{ fontSize: "0.5rem" }}>●</span>
                          {t("dayPool")}
                        </span>
                        <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatHours(breakdown.dayPoolHours)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Project access */}
          <div style={{ ...sectionGrid, marginBottom: "1.75rem" }}>
            <div>
              <h3 style={sectionTitle}>{t("projectAccess")}</h3>
              <p style={sectionDesc}>{t("accessDesc")}</p>
            </div>
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {member.projects.length === 0 ? (
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>{t("notAssigned")}</p>
                ) : (
                  member.projects.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.6rem 0.85rem",
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: "var(--text)", fontSize: "0.88rem", minWidth: 0 }}>
                        <span style={{ color: "#3b82f6", flexShrink: 0 }}>
                          <IconBuilding />
                        </span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      </span>
                      <button
                        type="button"
                        disabled={busyProjectId !== null}
                        onClick={() => void onRemoveProject(p.id, p.name)}
                        style={{
                          flexShrink: 0,
                          padding: "0.3rem 0.55rem",
                          borderRadius: 8,
                          border: "1px solid #fecaca",
                          background: "var(--surface)",
                          color: "#b91c1c",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          cursor: busyProjectId !== null ? "wait" : "pointer",
                        }}
                      >
                        {busyProjectId === p.id ? "…" : t("remove")}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {canAdd.length > 0 ? (
                <div style={{ marginTop: "1.1rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", flexWrap: "wrap" }}>
                    <div
                      style={{
                        flex: "1 1 200px",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.45rem 0.65rem",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                      }}
                    >
                      <span style={{ color: "#94a3b8", display: "flex" }}>
                        <IconSearch />
                      </span>
                      <input
                        type="search"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder={t("searchProjects")}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: "none",
                          background: "transparent",
                          fontSize: "0.88rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflow: "auto" }}>
                    {filteredCanAdd.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>{t("noSearchMatch")}</p>
                    ) : (
                      filteredCanAdd.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: "0.85rem", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                          <button
                            type="button"
                            disabled={busyProjectId !== null}
                            onClick={() => void onAddProject(p.id)}
                            style={{
                              flexShrink: 0,
                              padding: "0.4rem 0.85rem",
                              borderRadius: 8,
                              border: "none",
                              background: "var(--text)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              cursor: busyProjectId !== null ? "wait" : "pointer",
                            }}
                          >
                            {busyProjectId === p.id ? "…" : t("assign")}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ margin: "1rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                  {allProjects.length === 0 ? t("noProjects") : t("allAssigned")}
                </p>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 220px) minmax(0, 1fr)",
              gap: isMobile ? "0.65rem" : "1rem 1.75rem",
              alignItems: "start",
              paddingBottom: "1.5rem",
              borderBottom: "1px solid #e8eef5",
            }}
          >
            <div>
              <h3 style={{ ...sectionTitle, color: "#dc2626" }}>{t("dangerZone")}</h3>
              <p style={{ ...sectionDesc, color: "#991b1b" }}>{t("dangerDesc")}</p>
            </div>
            <div>
              {!isSelf ? (
                <button
                  type="button"
                  disabled={deleting || busyProjectId !== null}
                  onClick={() => void onDeleteMember()}
                  style={{
                    padding: "0.65rem 1.1rem",
                    borderRadius: 10,
                    border: "2px solid #dc2626",
                    background: "var(--surface)",
                    color: "#dc2626",
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    letterSpacing: "0.02em",
                    cursor: deleting || busyProjectId !== null ? "wait" : "pointer",
                  }}
                >
                  {deleting ? t("removing") : t("removeOrg")}
                </button>
              ) : (
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>{t("cannotDeleteSelf")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            padding: "0.65rem 1.5rem",
            background: "linear-gradient(90deg, #e0f2fe 0%, #eff6ff 50%, #e0e7ff 100%)",
            borderTop: "1px solid #bae6fd",
            fontSize: "0.68rem",
            color: "#475569",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{t("uid", { id: footerUid(member) })}</span>
          <span style={{ opacity: 0.85 }}>{t("authFooter")}</span>
        </div>
      </div>
    </div>
  );
}
