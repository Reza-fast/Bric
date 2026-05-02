"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditProjectModal } from "@/components/projects/EditProjectModal";
import { UploadReportModal } from "@/components/projects/UploadReportModal";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import type { PlanningTask } from "@/lib/api/plannedTasks";
import { fetchPlanningTasksAll } from "@/lib/api/plannedTasks";
import type { ProjectDetail, ProjectPortfolioCard, ProjectStatus } from "@/lib/api/projects";
import { fetchProject, fetchProjectPortfolio } from "@/lib/api/projects";
import { canAccessTeam } from "@/lib/api/roles";
import type { ProjectReport } from "@/lib/api/reports";
import { fetchProjectReports, reportFileUrl, reportPhotoUrl } from "@/lib/api/reports";
import type { TeamMember } from "@/lib/api/team";
import { fetchTeamDirectory } from "@/lib/api/team";

const CANVAS_BG = "#e8eef7";
const NAVY = "#0f172a";
const SLATE_HEADER = "#64748b";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function statusReadable(status: ProjectStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "critical":
      return "Critical";
    case "planning":
      return "Planning";
    case "completed":
      return "Completed";
    default:
      return "Inactive";
  }
}

function phaseFromCompletion(pct: number): string {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  if (p < 34) return "Phase 1";
  if (p < 67) return "Phase 2";
  return "Phase 3";
}

function milestoneStatusLabel(s: PlanningTask["taskStatus"]): string {
  switch (s) {
    case "in_progress":
      return "IN PROGRESS";
    case "completed":
      return "DONE";
    case "pending_approval":
      return "PENDING APPROVAL";
    case "planned":
      return "PLANNED";
    default:
      return "SCHEDULED";
  }
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ""}${p[p.length - 1]![0] ?? ""}`.toUpperCase();
}

function splitSiteRegion(location: string | null): { site: string; region: string } {
  const raw = location?.trim();
  if (!raw) return { site: "—", region: "—" };
  const parts = raw.split(",").map((x) => x.trim());
  if (parts.length >= 2) {
    return { site: parts[0]!, region: parts.slice(1).join(", ") };
  }
  return { site: raw, region: "—" };
}

type DocRow = {
  key: string;
  kind: "file" | "narrative" | "photo";
  label: string;
  reportTitle: string;
  sortAt: string;
  href?: string;
};

function buildDocumentRows(projectId: string, reports: ProjectReport[]): DocRow[] {
  const rows: DocRow[] = [];
  for (const r of reports) {
    if (r.fileStorageKey && r.fileOriginalName) {
      rows.push({
        key: `${r.id}-file`,
        kind: "file",
        label: r.fileOriginalName,
        reportTitle: r.title,
        sortAt: r.updatedAt,
        href: reportFileUrl(projectId, r.id),
      });
    }
    if (r.body?.trim()) {
      rows.push({
        key: `${r.id}-narrative`,
        kind: "narrative",
        label: r.title,
        reportTitle: r.title,
        sortAt: r.updatedAt,
        href: `/reporting?project=${encodeURIComponent(projectId)}`,
      });
    }
    for (const p of r.photos ?? []) {
      rows.push({
        key: `${r.id}-photo-${p.id}`,
        kind: "photo",
        label: p.fileOriginalName,
        reportTitle: r.title,
        sortAt: p.createdAt,
        href: reportPhotoUrl(projectId, r.id, p.id),
      });
    }
  }
  rows.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
  return rows;
}

function kindLabel(kind: DocRow["kind"]): string {
  switch (kind) {
    case "file":
      return "Uploaded file";
    case "narrative":
      return "Digital report";
    case "photo":
      return "Site photo";
    default:
      return kind;
  }
}

const whiteCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: "1.25rem 1.35rem",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.11em",
  color: SLATE_HEADER,
  textTransform: "uppercase" as const,
};

const cardTitle: CSSProperties = {
  margin: "0.35rem 0 0",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: NAVY,
};

function ProgressTrack({ pct, tone }: { pct: number; tone?: "blue" | "amber" }) {
  const p = Math.min(100, Math.max(0, pct));
  const fill =
    tone === "amber"
      ? "linear-gradient(90deg, #ea580c, #fb923c)"
      : "linear-gradient(90deg, #1e40af, #3b82f6)";
  return (
    <div style={{ height: 10, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${p}%`, borderRadius: 999, background: fill }} />
    </div>
  );
}

function BurnBars({ pct }: { pct: number }) {
  const bars = 12;
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * bars);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 112 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${38 + ((i * 17) % 55)}%`,
            borderRadius: 4,
            background: i < filled ? NAVY : "#e2e8f0",
            minHeight: 28,
          }}
        />
      ))}
    </div>
  );
}

function DetailRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 100px) minmax(0, 1fr)",
            gap: "0.65rem 1rem",
            padding: "0.65rem 0",
            borderTop: i === 0 ? "none" : "1px solid #e8eef7",
            alignItems: "baseline",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: 700, color: SLATE_HEADER, fontSize: "0.72rem", letterSpacing: "0.06em" }}>
            {row.label}
          </span>
          <div style={{ color: NAVY, lineHeight: 1.45 }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = typeof params.id === "string" ? params.id : "";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [portfolioCard, setPortfolioCard] = useState<ProjectPortfolioCard | null>(null);
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [teamOnProject, setTeamOnProject] = useState<TeamMember[]>([]);
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [reportsError, setReportsError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const refreshReports = useCallback(async () => {
    if (!projectId) return;
    const list = await fetchProjectReports(projectId);
    setReportsError(list === null);
    setReports(list ?? []);
  }, [projectId]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    const result = await fetchProject(projectId);
    if (!result.ok) {
      if (result.status === 401) {
        router.replace(`/login?from=${encodeURIComponent(`/projects/${projectId}`)}`);
        return;
      }
      setLoadState("error");
      return;
    }
    setProject(result.project);

    const [portfolio, taskList, reportList] = await Promise.all([
      fetchProjectPortfolio(),
      fetchPlanningTasksAll(projectId),
      fetchProjectReports(projectId),
    ]);

    if (portfolio) {
      const card = portfolio.find((p) => p.id === projectId) ?? null;
      setPortfolioCard(card);
    } else {
      setPortfolioCard(null);
    }

    setTasks(taskList ?? []);
    setReportsError(reportList === null);
    setReports(reportList ?? []);

    setLoadState("ready");
  }, [projectId, router]);

  useEffect(() => {
    let cancelled = false;
    void meRequest().then((me) => {
      if (!cancelled) setUser(me?.user ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLoadState("error");
      return;
    }
    void reload();
  }, [projectId, reload]);

  useEffect(() => {
    if (!projectId || !user || !canAccessTeam(user.role)) {
      setTeamOnProject([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const dir = await fetchTeamDirectory();
      if (cancelled || !dir) {
        if (!cancelled) setTeamOnProject([]);
        return;
      }
      const onProject = dir.filter((m) => m.projects.some((p) => p.id === projectId));
      setTeamOnProject(onProject);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  const docRows = useMemo(() => buildDocumentRows(projectId, reports), [projectId, reports]);

  const completionPct = useMemo(
    () => Math.min(100, Math.max(0, Math.round(project?.completionPercent ?? 0))),
    [project?.completionPercent],
  );

  const hoursMeta = useMemo(() => {
    const budget = portfolioCard?.budgetedHours ?? project?.budgetedHours ?? 0;
    const actual = portfolioCard?.actualHours ?? 0;
    const pctUsed = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0;
    return { budget, actual, pctUsed };
  }, [portfolioCard, project?.budgetedHours]);

  const upcomingMilestones = useMemo(() => {
    const now = Date.now();
    const open = tasks.filter((t) => t.taskStatus !== "completed");
    const sorted = [...open].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
    return sorted.slice(0, 6);
  }, [tasks]);

  const scheduleEnd = useMemo(() => {
    if (tasks.length === 0) return null;
    const ends = tasks.map((t) => new Date(t.endsAt).getTime());
    const max = Math.max(...ends);
    return Number.isFinite(max) ? max : null;
  }, [tasks]);

  const daysLeft = useMemo(() => {
    if (scheduleEnd === null) return null;
    const d = Math.ceil((scheduleEnd - Date.now()) / 86400000);
    return d;
  }, [scheduleEnd]);

  function onSaved(next: ProjectDetail) {
    setProject(next);
    try {
      sessionStorage.setItem("bric_project_updated", next.name);
    } catch {
      /* ignore */
    }
    void reload();
    router.refresh();
  }

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: "0.45rem 0.85rem",
    borderRadius: 8,
    fontSize: "0.82rem",
    fontWeight: active ? 700 : 500,
    color: active ? NAVY : "#64748b",
    background: active ? "#eff6ff" : "transparent",
    textDecoration: "none",
    border: active ? "1px solid #bfdbfe" : "1px solid transparent",
  });

  const headerTabs =
    projectId && loadState === "ready" && project ? (
      <>
        <Link href={`/projects/${projectId}`} style={tabStyle(true)}>
          Overview
        </Link>
        <Link href={`/planning?project=${encodeURIComponent(projectId)}`} prefetch={false} style={tabStyle(false)}>
          Planning
        </Link>
        <Link href="/time" prefetch={false} style={tabStyle(false)}>
          Financials
        </Link>
        {canAccessTeam(user?.role) ? (
          <Link href="/team" prefetch={false} style={tabStyle(false)}>
            Team
          </Link>
        ) : null}
      </>
    ) : null;

  if (!projectId) {
    return (
      <DashboardShell user={user}>
        <p style={{ color: "var(--muted)" }}>Invalid project link.</p>
        <Link href="/projects" style={{ color: "var(--accent)" }}>
          Back to projects
        </Link>
      </DashboardShell>
    );
  }

  if (loadState === "loading") {
    return (
      <DashboardShell user={user}>
        <p style={{ color: "var(--muted)", padding: "1.5rem" }}>Loading project…</p>
      </DashboardShell>
    );
  }

  if (loadState === "error" || !project) {
    return (
      <DashboardShell user={user}>
        <p style={{ color: "var(--muted)" }}>Could not load this project.</p>
        <Link href="/projects" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Back to projects
        </Link>
      </DashboardShell>
    );
  }

  const { site, region } = splitSiteRegion(project.location);

  const gridMain: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "1.15rem",
    alignItems: "stretch",
  };

  const siteRegionRows = [
    { label: "SLUG", value: <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem" }}>{project.slug}</span> },
    { label: "SITE", value: site },
    { label: "REGION", value: region },
  ];

  return (
    <DashboardShell user={user} fullBleed headerTabs={headerTabs}>
      <div style={{ background: CANVAS_BG, minHeight: "100%", flex: 1, padding: "1.35rem 1.75rem 2.25rem", width: "100%" }}>
        <nav style={{ fontSize: "0.88rem", color: "#64748b", marginBottom: "1rem" }}>
          <Link href="/projects" style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}>
            Projects
          </Link>
          <span style={{ margin: "0 0.45rem", color: "#cbd5e1" }}>/</span>
          <span style={{ color: NAVY, fontWeight: 700 }}>{project.name}</span>
        </nav>

        {/* Hero */}
        <header style={{ marginBottom: "1.35rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: NAVY,
                background: "#fff",
                padding: "0.35rem 0.65rem",
                borderRadius: 8,
                border: "1px solid #dbe4f0",
              }}
            >
              {statusReadable(project.status).toUpperCase()} — {phaseFromCompletion(project.completionPercent ?? 0).toUpperCase()}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#475569",
                background: "#fff",
                padding: "0.35rem 0.65rem",
                borderRadius: 8,
                border: "1px solid #dbe4f0",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {project.slug}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1.25rem", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(1.65rem, 2.8vw, 2.05rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.038em",
                  lineHeight: 1.12,
                  color: NAVY,
                }}
              >
                {project.name}
              </h1>
              <p style={{ margin: "0.75rem 0 0", color: "#475569", fontSize: "0.95rem", maxWidth: 560, lineHeight: 1.55 }}>
                {project.description?.trim()
                  ? project.description
                  : "Construction registry overview — milestones, labor hours, and documents for stakeholders assigned to this project."}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                style={{
                  padding: "0.58rem 1.15rem",
                  borderRadius: 10,
                  border: "none",
                  background: NAVY,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                Edit project
              </button>
            </div>
          </div>
        </header>

        {/* KPI strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "1.15rem",
            marginBottom: "1.35rem",
          }}
        >
          <section style={whiteCard}>
            <p style={eyebrow}>Delivery</p>
            <p style={{ ...cardTitle, marginTop: "0.25rem" }}>Total completion</p>
            <p style={{ margin: "0.85rem 0 0.5rem", fontSize: "1.85rem", fontWeight: 800, color: NAVY }}>{completionPct}%</p>
            <ProgressTrack pct={completionPct} tone="blue" />
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.78rem", color: SLATE_HEADER }}>Portfolio completion target</p>
          </section>
          <section style={whiteCard}>
            <p style={eyebrow}>Labor budget</p>
            <p style={{ ...cardTitle, marginTop: "0.25rem" }}>Hours health</p>
            <p style={{ margin: "0.85rem 0 0.35rem", fontSize: "1.05rem", fontWeight: 700, color: NAVY }}>
              {hoursMeta.actual.toLocaleString()} / {hoursMeta.budget.toLocaleString()} hrs
            </p>
            <ProgressTrack pct={hoursMeta.pctUsed} tone="amber" />
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.78rem", color: SLATE_HEADER }}>
              {hoursMeta.budget > 0 ? `${hoursMeta.pctUsed}% of budgeted hours logged` : "Set budgeted hours in settings"}
            </p>
          </section>
          <section style={whiteCard}>
            <p style={eyebrow}>Schedule</p>
            <p style={{ ...cardTitle, marginTop: "0.25rem" }}>Timeline</p>
            <p style={{ margin: "0.85rem 0 0.35rem", fontSize: "1.05rem", fontWeight: 700, color: NAVY }}>
              {daysLeft !== null ? `${daysLeft} days to last milestone` : "No milestones yet"}
            </p>
            <ProgressTrack pct={scheduleEnd ? Math.min(100, completionPct) : 0} tone="blue" />
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.78rem", color: SLATE_HEADER }}>
              {scheduleEnd ? `Target wrap: ${formatDateShort(new Date(scheduleEnd).toISOString())}` : "Add tasks in Planning"}
            </p>
          </section>
        </div>

        {/* Mid grid + milestones */}
        <div style={{ ...gridMain, marginBottom: "1.35rem" }}>
          <section style={{ ...whiteCard, marginBottom: 0 }}>
            <p style={eyebrow}>Site</p>
            <h2 style={cardTitle}>Identity & location</h2>
            <DetailRows rows={siteRegionRows} />
            <div
              style={{
                marginTop: "1rem",
                borderRadius: 12,
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                minHeight: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Site map preview
            </div>
          </section>

          <section style={{ ...whiteCard, marginBottom: 0 }}>
            <p style={eyebrow}>Financials</p>
            <h2 style={cardTitle}>Hours & burn</h2>
            <p style={{ margin: "0.85rem 0 0.35rem", fontSize: "0.8rem", color: SLATE_HEADER, fontWeight: 600 }}>
              Labor burn rate
            </p>
            <p style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", fontWeight: 800, color: NAVY }}>
              {hoursMeta.actual.toLocaleString()} / {hoursMeta.budget.toLocaleString()} hrs
            </p>
            <BurnBars pct={hoursMeta.pctUsed} />
            <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid #e8eef7", display: "grid", gap: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: SLATE_HEADER }}>
                <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>UTILIZATION</span>
                <span style={{ fontWeight: 700, color: NAVY }}>{hoursMeta.pctUsed}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: SLATE_HEADER }}>
                <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>RECORD UPDATED</span>
                <span>{formatDateShort(project.updatedAt)}</span>
              </div>
            </div>
          </section>

          <section style={{ ...whiteCard, marginBottom: 0 }}>
            <p style={eyebrow}>People</p>
            <h2 style={cardTitle}>Team on record</h2>
            <div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {teamOnProject.length > 0
                ? teamOnProject.slice(0, 5).map((m) => {
                    const assignment = m.projects.find((p) => p.id === projectId);
                    const role = assignment?.functionTitle ?? m.role.replace(/_/g, " ");
                    return (
                      <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "#1e293b",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {initials(m.displayName)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: NAVY }}>{m.displayName}</div>
                          <div style={{ fontSize: "0.78rem", color: SLATE_HEADER, textTransform: "capitalize" }}>{role}</div>
                          <div style={{ fontSize: "0.76rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                        </div>
                      </div>
                    );
                  })
                : project.portfolioLeadName?.trim()
                  ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "#1e293b",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                          }}
                        >
                          {initials(project.portfolioLeadName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: NAVY }}>{project.portfolioLeadName}</div>
                          <div style={{ fontSize: "0.78rem", color: SLATE_HEADER }}>Lead on record</div>
                        </div>
                      </div>
                    )
                  : (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: SLATE_HEADER }}>No named contacts yet.</p>
                    )}
            </div>
            {canAccessTeam(user?.role) ? (
              <Link
                href="/team"
                style={{
                  display: "block",
                  marginTop: "1rem",
                  textAlign: "center",
                  padding: "0.55rem",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  color: NAVY,
                  textDecoration: "none",
                  background: "#fff",
                }}
              >
                View all stakeholders
              </Link>
            ) : null}
          </section>

          <section style={{ ...whiteCard, marginBottom: 0 }}>
            <p style={eyebrow}>Plan</p>
            <h2 style={cardTitle}>Upcoming milestones</h2>
            <div style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {upcomingMilestones.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: SLATE_HEADER }}>
                  No open milestones.{" "}
                  <Link href={`/planning?project=${encodeURIComponent(projectId)}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                    Planning
                  </Link>
                </p>
              ) : (
                upcomingMilestones.map((t) => (
                  <div key={t.id} style={{ borderLeft: "3px solid #ea580c", paddingLeft: "0.65rem" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", color: "#ea580c" }}>
                      {milestoneStatusLabel(t.taskStatus)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: NAVY, marginTop: 4 }}>{t.title}</div>
                    {t.phaseLabel ? (
                      <div style={{ fontSize: "0.78rem", color: SLATE_HEADER, marginTop: 2 }}>{t.phaseLabel}</div>
                    ) : null}
                    <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 6 }}>Due {formatDateShort(t.endsAt)}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Documents */}
        <section style={{ ...whiteCard, marginBottom: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
            <div>
              <p style={eyebrow}>Library</p>
              <h2 style={{ ...cardTitle, marginTop: "0.35rem" }}>Files and reports</h2>
            </div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 10,
                border: "none",
                background: NAVY,
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              Upload file 
            </button>
          </div>
          <p style={{ margin: "0.65rem 0 1rem", fontSize: "0.86rem", color: SLATE_HEADER, lineHeight: 1.55, maxWidth: 720 }}>
            Narratives, contractor uploads, drawings, and photos from Reporting — downloadable for anyone on this project.
          </p>
          {reportsError ? (
            <p style={{ color: "#b91c1c", fontSize: "0.9rem", margin: 0 }}>Could not load documents for this project.</p>
          ) : docRows.length === 0 ? (
            <p style={{ color: SLATE_HEADER, fontSize: "0.92rem", margin: 0 }}>
              No files yet.{" "}
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--accent)",
                  fontWeight: 700,
                  font: "inherit",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Upload a file
              </button>
              {" · "}
              <Link href={`/reporting?project=${encodeURIComponent(projectId)}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                Full reporting workspace
              </Link>
            </p>
          ) : (
            <div style={{ border: "1px solid #dbe4f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #dbe4f0" }}>
                      {(["Type", "File name", "Report", "Updated", "Actions"] as const).map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: "0.75rem 1rem",
                            fontWeight: 700,
                            color: SLATE_HEADER,
                            textAlign: "left",
                            fontSize: "0.68rem",
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            whiteSpace: col === "Updated" ? "nowrap" : undefined,
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docRows.map((row) => (
                      <tr key={row.key} style={{ borderBottom: "1px solid #e8eef7" }}>
                        <td style={{ padding: "0.8rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>{kindLabel(row.kind)}</td>
                        <td style={{ padding: "0.8rem 1rem", fontWeight: row.kind === "narrative" ? 600 : 500, color: NAVY }}>
                          {row.label}
                        </td>
                        <td style={{ padding: "0.8rem 1rem", color: SLATE_HEADER }}>{row.reportTitle}</td>
                        <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap", color: SLATE_HEADER }}>{formatWhen(row.sortAt)}</td>
                        <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap" }}>
                          {row.href ? (
                            row.kind === "narrative" ? (
                              <Link href={row.href} style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.82rem" }}>
                                Open
                              </Link>
                            ) : (
                              <a
                                href={row.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.82rem" }}
                              >
                                Download
                              </a>
                            )
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      <EditProjectModal open={editOpen} projectId={projectId} project={project} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      <UploadReportModal
        open={uploadOpen}
        projectId={projectId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void refreshReports()}
      />
    </DashboardShell>
  );
}
