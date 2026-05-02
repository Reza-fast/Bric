"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectPortfolioCard } from "@/lib/api/projects";
import type { TeamMember } from "@/lib/api/team";
import {
  assignTeamMemberToProject,
  fetchTeamMemberHours,
  removeTeamMemberFromProject,
  type MemberHoursBreakdown,
} from "@/lib/api/team";

type Props = {
  member: TeamMember;
  allProjects: ProjectPortfolioCard[];
  onClose: () => void;
  onMembershipsChanged: () => void;
};

function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "0";
  return h >= 10 ? h.toFixed(1) : h.toFixed(2);
}

export function MemberDetailModal({ member, allProjects, onClose, onMembershipsChanged }: Props) {
  const [breakdown, setBreakdown] = useState<MemberHoursBreakdown | null>(null);
  const [loadHours, setLoadHours] = useState(true);
  const [hoursError, setHoursError] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function onAddProject(projectId: string) {
    setActionError(null);
    setBusyProjectId(projectId);
    const ok = await assignTeamMemberToProject(member.userId, projectId);
    setBusyProjectId(null);
    if (!ok) {
      setActionError("Could not add this project (check access and try again).");
      return;
    }
    onMembershipsChanged();
  }

  async function onRemoveProject(projectId: string, projectName: string) {
    if (!window.confirm(`Remove ${member.displayName} from “${projectName}”? They will lose access unless re-assigned.`)) {
      return;
    }
    setActionError(null);
    setBusyProjectId(projectId);
    const ok = await removeTeamMemberFromProject(member.userId, projectId);
    setBusyProjectId(null);
    if (!ok) {
      setActionError("Could not remove this assignment.");
      return;
    }
    onMembershipsChanged();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "1rem",
        overflow: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          marginTop: "1.5rem",
          marginBottom: "2rem",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "1.25rem 1.35rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: "#64748b" }}>TEAM MEMBER</div>
            <h2 id="member-detail-title" style={{ margin: "0.35rem 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
              {member.displayName}
            </h2>
            <div style={{ fontSize: "0.88rem", color: "#64748b", marginTop: 6 }}>{member.email}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: "1.25rem 1.35rem", display: "flex", flexDirection: "column", gap: "1.35rem" }}>
          <section>
            <h3 style={{ margin: "0 0 0.65rem", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", color: "#64748b" }}>
              LOGGED HOURS BY PROJECT (ALL TIME)
            </h3>
            {loadHours ? (
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Loading hours…</p>
            ) : hoursError ? (
              <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>Could not load hour breakdown.</p>
            ) : breakdown ? (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: "0.6rem 0.85rem", color: "#64748b", fontWeight: 700 }}>Project</th>
                      <th style={{ padding: "0.6rem 0.85rem", color: "#64748b", fontWeight: 700, textAlign: "right" }}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.byProject.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: "0.75rem 0.85rem", color: "#94a3b8" }}>
                          No project-specific time logged yet.
                        </td>
                      </tr>
                    ) : (
                      breakdown.byProject.map((row) => (
                        <tr key={row.projectId} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.6rem 0.85rem", fontWeight: 600, color: "#0f172a" }}>{row.projectName}</td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatHours(row.hours)}</td>
                        </tr>
                      ))
                    )}
                    {breakdown.dayPoolHours > 0 ? (
                      <tr style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.6rem 0.85rem", color: "#64748b" }}>Day registration (not yet assigned)</td>
                        <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748b" }}>
                          {formatHours(breakdown.dayPoolHours)}
                        </td>
                      </tr>
                    ) : null}
                    <tr style={{ borderTop: "2px solid #e2e8f0", background: "#fafafa" }}>
                      <td style={{ padding: "0.65rem 0.85rem", fontWeight: 800 }}>Total logged</td>
                      <td style={{ padding: "0.65rem 0.85rem", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {formatHours(breakdown.totalLoggedHours)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section>
            <h3 style={{ margin: "0 0 0.65rem", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", color: "#64748b" }}>
              PROJECT ACCESS
            </h3>
            {actionError ? (
              <p style={{ margin: "0 0 0.65rem", padding: "0.5rem 0.65rem", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: "0.85rem" }}>
                {actionError}
              </p>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {member.projects.length === 0 ? (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>Not assigned to any project.</p>
              ) : (
                member.projects.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.55rem 0.75rem",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.88rem" }}>{p.name}</span>
                    <button
                      type="button"
                      disabled={busyProjectId !== null}
                      onClick={() => void onRemoveProject(p.id, p.name)}
                      style={{
                        flexShrink: 0,
                        padding: "0.35rem 0.65rem",
                        borderRadius: 8,
                        border: "1px solid #fecaca",
                        background: "#fff",
                        color: "#b91c1c",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        cursor: busyProjectId !== null ? "wait" : "pointer",
                      }}
                    >
                      {busyProjectId === p.id ? "…" : "Remove"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {canAdd.length > 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", marginBottom: "0.45rem" }}>Add to project</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflow: "auto" }}>
                  {canAdd.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: "0.85rem", color: "#334155" }}>{p.name}</span>
                      <button
                        type="button"
                        disabled={busyProjectId !== null}
                        onClick={() => void onAddProject(p.id)}
                        style={{
                          flexShrink: 0,
                          padding: "0.35rem 0.75rem",
                          borderRadius: 8,
                          border: "none",
                          background: "#0f172a",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          cursor: busyProjectId !== null ? "wait" : "pointer",
                        }}
                      >
                        {busyProjectId === p.id ? "…" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ margin: "1rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                {allProjects.length === 0 ? "No projects available in your portfolio to assign." : "Member is already on every project you can assign."}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
