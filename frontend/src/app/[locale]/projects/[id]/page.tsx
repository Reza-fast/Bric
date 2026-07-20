"use client";

import { useParams } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { EditProjectModal } from "@/components/projects/EditProjectModal";
import { ProjectLogoThumb } from "@/components/projects/ProjectLogoThumb";
import { TechnicalPlansSection } from "@/components/projects/TechnicalPlansSection";
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
import { formatLaborBudget } from "@/lib/projectFormShared";
import { useIsMobile } from "@/lib/useMediaQuery";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
import { ActionIconLink, IconDownload, IconEye, actionIconStyle } from "@/components/ui/ActionIcons";

const CANVAS_BG = "var(--soft)";
const NAVY = "var(--text)";
const SLATE_HEADER = "var(--muted)";

function formatWhen(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ""}${p[p.length - 1]![0] ?? ""}`.toUpperCase();
}

function splitSiteRegion(location: string | null, emDash: string): { site: string; region: string } {
  const raw = location?.trim();
  if (!raw) return { site: emDash, region: emDash };
  const parts = raw.split(",").map((x) => x.trim());
  if (parts.length >= 2) {
    return { site: parts[0]!, region: parts.slice(1).join(", ") };
  }
  return { site: raw, region: emDash };
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

const whiteCard: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--border)",
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
      ? "var(--text)"
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

function DetailRows({ rows, stacked }: { rows: { label: string; value: ReactNode }[]; stacked?: boolean }) {
  return (
    <div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: stacked ? "1fr" : "minmax(0, 100px) minmax(0, 1fr)",
            gap: stacked ? "0.2rem 0" : "0.65rem 1rem",
            padding: "0.65rem 0",
            borderTop: i === 0 ? "none" : "1px solid #e8eef7",
            alignItems: "baseline",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontWeight: 700, color: SLATE_HEADER, fontSize: "0.72rem", letterSpacing: "0.06em" }}>
            {row.label}
          </span>
          <div style={{ color: NAVY, lineHeight: 1.45, overflowWrap: "anywhere" }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = typeof params.id === "string" ? params.id : "";
  const isMobile = useIsMobile(768);
  const isCompactDesktop = useIsMobile(1280);
  const t = useTranslations("ProjectDetail");
  const tStatus = useTranslations("Status");
  const tNav = useTranslations("Nav");
  const tProjects = useTranslations("Projects");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];

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

  function statusReadable(status: ProjectStatus): string {
    return tStatus(status);
  }

  function phaseFromCompletion(pct: number): string {
    const p = Math.min(100, Math.max(0, Math.round(pct)));
    if (p < 34) return t("phase1");
    if (p < 67) return t("phase2");
    return t("phase3");
  }

  function milestoneStatusLabel(s: PlanningTask["taskStatus"]): string {
    switch (s) {
      case "in_progress":
        return t("inProgress");
      case "completed":
        return t("done");
      case "pending_approval":
        return t("pendingApproval");
      case "planned":
        return t("planned");
      default:
        return t("scheduled");
    }
  }

  function kindLabel(kind: DocRow["kind"]): string {
    switch (kind) {
      case "file":
        return t("file");
      case "narrative":
        return t("digitalReport");
      case "photo":
        return t("sitePhoto");
      default:
        return kind;
    }
  }

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
    const hourlyWage = portfolioCard?.hourlyWage ?? project?.hourlyWage ?? null;
    const pctUsed = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0;
    const laborBudget = formatLaborBudget(budget, hourlyWage, intlLocale);
    return { budget, actual, pctUsed, hourlyWage, laborBudget };
  }, [portfolioCard, project?.budgetedHours, project?.hourlyWage, intlLocale]);

  const upcomingMilestones = useMemo(() => {
    const open = tasks.filter((task) => task.taskStatus !== "completed");
    const sorted = [...open].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
    return sorted.slice(0, 6);
  }, [tasks]);

  const scheduleEnd = useMemo(() => {
    if (tasks.length === 0) return null;
    const ends = tasks.map((task) => new Date(task.endsAt).getTime());
    const max = Math.max(...ends);
    return Number.isFinite(max) ? max : null;
  }, [tasks]);

  const daysLeft = useMemo(() => {
    if (scheduleEnd === null) return null;
    return Math.ceil((scheduleEnd - Date.now()) / 86400000);
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
    padding: "0.55rem 0.15rem",
    marginRight: "1.15rem",
    fontSize: "0.88rem",
    fontWeight: active ? 700 : 500,
    color: active ? NAVY : "var(--muted)",
    background: "transparent",
    textDecoration: "none",
    borderBottom: active ? "2px solid var(--text)" : "2px solid transparent",
    whiteSpace: "nowrap",
  });

  const headerTabs =
    projectId && loadState === "ready" && project ? (
      <>
        <Link href={`/projects/${projectId}`} style={tabStyle(true)}>
          {t("overview")}
        </Link>
        <Link href={`/planning?project=${encodeURIComponent(projectId)}`} prefetch={false} style={tabStyle(false)}>
          {tNav("planning")}
        </Link>
        <Link href={`/documents?project=${encodeURIComponent(projectId)}`} prefetch={false} style={tabStyle(false)}>
          {tNav("documents")}
        </Link>
        <Link href="/time" prefetch={false} style={tabStyle(false)}>
          {t("financials")}
        </Link>
        {canAccessTeam(user?.role) ? (
          <Link href="/team" prefetch={false} style={tabStyle(false)}>
            {tNav("team")}
          </Link>
        ) : null}
      </>
    ) : null;

  if (!projectId) {
    return (
      <DashboardShell user={user}>
        <p style={{ color: "var(--muted)" }}>{t("invalidLink")}</p>
        <Link href="/projects" style={{ color: "var(--accent)" }}>
          {t("backToProjects")}
        </Link>
      </DashboardShell>
    );
  }

  if (loadState === "loading") {
    return (
      <DashboardShell user={user}>
        <p style={{ color: "var(--muted)", padding: "1.5rem" }}>{t("loading")}</p>
      </DashboardShell>
    );
  }

  if (loadState === "error" || !project) {
    return (
      <DashboardShell user={user}>
        <p style={{ color: "var(--muted)" }}>{t("loadError")}</p>
        <Link href="/projects" style={{ color: "var(--accent)", fontWeight: 600 }}>
          {t("backToProjects")}
        </Link>
      </DashboardShell>
    );
  }

  const { site, region } = splitSiteRegion(project.location, tCommon("emDash"));

  const siteRegionRows = [
    { label: t("slugLabel"), value: <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.82rem" }}>{project.slug}</span> },
    { label: t("siteLabel"), value: site },
    { label: t("regionLabel"), value: region },
  ];

  return (
    <DashboardShell user={user} fullBleed headerTabs={headerTabs}>
      <div
        style={{
          background: CANVAS_BG,
          minHeight: "100%",
          flex: 1,
          padding: isMobile ? "1rem 0.85rem 1.75rem" : "1.35rem 1.75rem 2.25rem",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <nav
          style={{
            fontSize: "0.88rem",
            color: "var(--muted)",
            marginBottom: "1rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <Link href="/projects" style={{ color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}>
            {tProjects("breadcrumbsProjects")}
          </Link>
          <span style={{ margin: "0 0.45rem", color: "#cbd5e1" }}>/</span>
          <span style={{ color: NAVY, fontWeight: 700 }}>{project.name}</span>
        </nav>

        <header style={{ marginBottom: isMobile ? "1rem" : "1.35rem" }}>
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
                border: "1px solid var(--border)",
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
                border: "1px solid var(--border)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {project.slug}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: isMobile ? "1rem" : "1.25rem",
              alignItems: isMobile ? "stretch" : "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: isMobile ? "0.85rem" : "1.15rem",
                alignItems: "flex-start",
                flex: "1 1 280px",
                minWidth: 0,
              }}
            >
              <ProjectLogoThumb
                projectId={projectId}
                name={project.name}
                logoStorageKey={project.logoStorageKey}
                updatedAt={project.updatedAt}
                size={isMobile ? 64 : 96}
                borderRadius={isMobile ? 12 : 16}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: isMobile ? "1.45rem" : "clamp(1.65rem, 2.8vw, 2.05rem)",
                    fontWeight: 800,
                    letterSpacing: "-0.038em",
                    lineHeight: 1.12,
                    color: NAVY,
                    overflowWrap: "anywhere",
                  }}
                >
                  {project.name}
                </h1>
                <p
                  style={{
                    margin: "0.75rem 0 0",
                    color: "#475569",
                    fontSize: isMobile ? "0.88rem" : "0.95rem",
                    maxWidth: 560,
                    lineHeight: 1.55,
                  }}
                >
                  {project.description?.trim() ? project.description : t("defaultDescription")}
                </p>
              </div>
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
                  width: isMobile ? "100%" : undefined,
                }}
              >
                {t("projectSettings")}
              </button>
            </div>
          </div>
        </header>

        <section style={{ ...whiteCard, padding: 0, overflow: "hidden", marginBottom: "1.15rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isCompactDesktop ? "1fr" : "repeat(3, minmax(0, 1fr))",
            }}
          >
            {[
              {
                eyebrowLabel: t("delivery"),
                title: t("totalCompletion"),
                value: `${completionPct}%`,
                hint: t("portfolioTarget"),
                tone: "blue" as const,
                progress: completionPct,
              },
              {
                eyebrowLabel: t("laborBudget"),
                title: t("hoursHealth"),
                value: hoursMeta.laborBudget || t("hoursLogged", { actual: hoursMeta.actual.toLocaleString(intlLocale), budget: hoursMeta.budget.toLocaleString(intlLocale) }),
                hint: hoursMeta.hourlyWage != null
                  ? t("totalBudgetLine", {
                      hours: hoursMeta.budget.toLocaleString(intlLocale),
                      rate: new Intl.NumberFormat(intlLocale, { style: "currency", currency: "EUR" }).format(hoursMeta.hourlyWage),
                    })
                  : hoursMeta.budget > 0
                    ? t("pctOfBudget", { pct: hoursMeta.pctUsed })
                    : t("setPlannedHours"),
                tone: "amber" as const,
                progress: hoursMeta.pctUsed,
              },
              {
                eyebrowLabel: t("schedule"),
                title: t("timeline"),
                value: daysLeft !== null ? `${daysLeft}` : "—",
                hint: scheduleEnd ? t("targetWrap", { date: formatDateShort(new Date(scheduleEnd).toISOString(), intlLocale) }) : t("addTasks"),
                suffix: daysLeft !== null ? t("daysLeftShort") : "",
                tone: "blue" as const,
                progress: scheduleEnd ? Math.min(100, completionPct) : 0,
              },
            ].map((metric, index) => (
              <div
                key={metric.title}
                style={{
                  padding: isMobile ? "1rem" : "1.25rem 1.35rem",
                  borderRight: !isCompactDesktop && index < 2 ? "1px solid #e8eef7" : undefined,
                  borderTop: isCompactDesktop && index > 0 ? "1px solid #e8eef7" : undefined,
                }}
              >
                <p style={eyebrow}>{metric.eyebrowLabel}</p>
                <p style={{ ...cardTitle, marginTop: "0.25rem" }}>{metric.title}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", margin: "0.85rem 0 0.45rem" }}>
                  <span style={{ fontSize: isMobile ? "1.9rem" : "2rem", fontWeight: 800, color: NAVY, lineHeight: 1 }}>{metric.value}</span>
                  {metric.suffix ? <span style={{ fontSize: "0.78rem", color: SLATE_HEADER, fontWeight: 700 }}>{metric.suffix}</span> : null}
                </div>
                <ProgressTrack pct={metric.progress} tone={metric.tone} />
                <p style={{ margin: "0.65rem 0 0", fontSize: "0.76rem", color: SLATE_HEADER }}>{metric.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isCompactDesktop ? "1fr" : "minmax(0, 1.7fr) minmax(280px, 0.85fr)",
            gap: "1.15rem",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "1.15rem", minWidth: 0 }}>
            <section style={{ ...whiteCard, padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isCompactDesktop ? "1fr" : "minmax(0, 0.9fr) minmax(0, 1.1fr)",
                  minWidth: 0,
                }}
              >
                <div style={{ padding: "1.25rem 1.35rem", borderRight: !isCompactDesktop ? "1px solid #e8eef7" : undefined, minWidth: 0 }}>
                  <p style={eyebrow}>{t("site")}</p>
                  <h2 style={cardTitle}>{t("identityLocation")}</h2>
                  <DetailRows rows={siteRegionRows} stacked={isMobile} />
                  <div
                    style={{
                      marginTop: "1rem",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      minHeight: 130,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                    }}
                  >
                    {t("siteMapPreview")}
                  </div>
                </div>
                <div style={{ padding: "1.25rem 1.35rem", borderTop: isCompactDesktop ? "1px solid #e8eef7" : undefined, minWidth: 0 }}>
                  <p style={eyebrow}>{t("financials")}</p>
                  <h2 style={cardTitle}>{t("hoursAndBurn")}</h2>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline", margin: "1rem 0 0.85rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", color: SLATE_HEADER }}>{t("laborBurnRate")}</span>
                    <span style={{ fontSize: "1.45rem", fontWeight: 800, color: NAVY }}>
                      {hoursMeta.actual.toLocaleString(intlLocale)}
                      <span style={{ fontSize: "0.82rem", color: SLATE_HEADER, fontWeight: 700 }}> / {hoursMeta.budget.toLocaleString(intlLocale)} h</span>
                    </span>
                  </div>
                  <BurnBars pct={hoursMeta.pctUsed} />
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "0.7rem",
                    }}
                  >
                    <div style={{ border: "1px solid #e8eef7", borderRadius: 12, padding: "0.85rem" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", color: SLATE_HEADER }}>{t("utilization")}</div>
                      <div style={{ marginTop: 6, fontSize: "1.2rem", fontWeight: 800, color: NAVY }}>{hoursMeta.pctUsed}%</div>
                    </div>
                    <div style={{ border: "1px solid #e8eef7", borderRadius: 12, padding: "0.85rem" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", color: SLATE_HEADER }}>{t("totalBudgetCaps")}</div>
                      <div style={{ marginTop: 6, fontSize: "1.2rem", fontWeight: 800, color: NAVY }}>{hoursMeta.laborBudget || tCommon("emDash")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ ...whiteCard, marginBottom: 0, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                <div>
                  <p style={eyebrow}>{t("drawingsSpecs")}</p>
                  <h2 style={{ ...cardTitle, marginTop: "0.35rem" }}>{t("technicalPlans")}</h2>
                </div>
                <Link
                  href={`/documents?project=${encodeURIComponent(projectId)}`}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: NAVY,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    textDecoration: "none",
                  }}
                >
                  {t("allDocuments")}
                </Link>
              </div>
              <p style={{ margin: "0.65rem 0 0", fontSize: "0.86rem", color: SLATE_HEADER, lineHeight: 1.55, maxWidth: 720 }}>
                {t("plansIntro")}
              </p>
              <TechnicalPlansSection projectId={projectId} embedded />
            </section>

            <section style={{ ...whiteCard, marginBottom: 0, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                <div>
                  <p style={eyebrow}>{t("library")}</p>
                  <h2 style={{ ...cardTitle, marginTop: "0.35rem" }}>{t("filesAndReports")}</h2>
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
                  {t("uploadFile")}
                </button>
              </div>
              <p style={{ margin: "0.65rem 0 1rem", fontSize: "0.86rem", color: SLATE_HEADER, lineHeight: 1.55, maxWidth: 720 }}>
                {t("filesIntro")}
              </p>
              {reportsError ? (
                <p style={{ color: "#b91c1c", fontSize: "0.9rem", margin: 0 }}>{t("docsLoadError")}</p>
              ) : docRows.length === 0 ? (
                <p style={{ color: SLATE_HEADER, fontSize: "0.92rem", margin: 0 }}>
                  {t("noFilesYet")}{" "}
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
                    {t("uploadAFile")}
                  </button>
                  {" · "}
                  <Link href={`/reporting?project=${encodeURIComponent(projectId)}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                    {t("fullReporting")}
                  </Link>
                </p>
              ) : (
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                  <div style={{ width: "100%", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", borderBottom: "1px solid var(--border)" }}>
                          {([t("colType"), t("colFileName"), t("colReport"), t("colUpdated"), t("colActions")] as const).map((col) => (
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
                                whiteSpace: col === t("colUpdated") ? "nowrap" : undefined,
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
                            <td style={{ padding: "0.8rem 1rem", fontWeight: row.kind === "narrative" ? 600 : 500, color: NAVY }}>{row.label}</td>
                            <td style={{ padding: "0.8rem 1rem", color: SLATE_HEADER }}>{row.reportTitle}</td>
                            <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap", color: SLATE_HEADER }}>{formatWhen(row.sortAt, intlLocale)}</td>
                            <td style={{ padding: "0.8rem 1rem", whiteSpace: "nowrap" }}>
                              {row.href ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                                  {row.kind === "narrative" ? (
                                    <Link
                                      href={row.href}
                                      aria-label={tCommon("open")}
                                      title={tCommon("open")}
                                      style={actionIconStyle()}
                                    >
                                      <IconEye />
                                    </Link>
                                  ) : (
                                    <>
                                      <ActionIconLink
                                        href={row.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        label={tCommon("open")}
                                      >
                                        <IconEye />
                                      </ActionIconLink>
                                      <ActionIconLink href={row.href} download={row.label} label={tCommon("download")}>
                                        <IconDownload />
                                      </ActionIconLink>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#cbd5e1" }}>{tCommon("emDash")}</span>
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

          <aside style={{ display: "grid", gap: "1.15rem", minWidth: 0 }}>
            <section style={{ ...whiteCard, minWidth: 0 }}>
              <p style={eyebrow}>{t("people")}</p>
              <h2 style={cardTitle}>{t("teamOnRecord")}</h2>
              <div style={{ marginTop: "0.95rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {teamOnProject.length > 0
                  ? teamOnProject.slice(0, 4).map((m) => {
                      const assignment = m.projects.find((p) => p.id === projectId);
                      const role = assignment?.functionTitle ?? m.role.replace(/_/g, " ");
                      return (
                        <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: "50%",
                              background: "var(--text)",
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
                            <div style={{ fontSize: "0.76rem", color: SLATE_HEADER, textTransform: "capitalize" }}>{role}</div>
                          </div>
                        </div>
                      );
                    })
                  : project.portfolioLeadName?.trim()
                    ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: "50%",
                              background: "var(--text)",
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
                            <div style={{ fontSize: "0.76rem", color: SLATE_HEADER }}>{t("leadOnRecord")}</div>
                          </div>
                        </div>
                      )
                    : (
                        <p style={{ margin: 0, fontSize: "0.85rem", color: SLATE_HEADER }}>{t("noContacts")}</p>
                      )}
              </div>
              {canAccessTeam(user?.role) ? (
                <Link
                  href="/team"
                  style={{
                    display: "block",
                    marginTop: "1rem",
                    textAlign: "center",
                    padding: "0.6rem",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    color: NAVY,
                    textDecoration: "none",
                    background: "#fff",
                  }}
                >
                  {t("viewStakeholders")}
                </Link>
              ) : null}
            </section>

            <section style={{ ...whiteCard, minWidth: 0 }}>
              <p style={eyebrow}>{t("plan")}</p>
              <h2 style={cardTitle}>{t("upcomingMilestones")}</h2>
              <div style={{ marginTop: "0.95rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {upcomingMilestones.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: SLATE_HEADER }}>
                    {t("noOpenMilestones")}{" "}
                    <Link href={`/planning?project=${encodeURIComponent(projectId)}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                      {tNav("planning")}
                    </Link>
                  </p>
                ) : (
                  upcomingMilestones.slice(0, 4).map((task) => (
                    <div key={task.id} style={{ borderLeft: "2px solid #f97316", paddingLeft: "0.7rem" }}>
                      <div style={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--text)" }}>
                        {milestoneStatusLabel(task.taskStatus)}
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 700, fontSize: "0.88rem", color: NAVY }}>{task.title}</div>
                      <div style={{ marginTop: 4, fontSize: "0.76rem", color: SLATE_HEADER }}>
                        {task.phaseLabel || t("timeline")}
                      </div>
                      <div style={{ marginTop: 4, fontSize: "0.76rem", color: "#94a3b8" }}>{t("due", { date: formatDateShort(task.endsAt, intlLocale) })}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
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
