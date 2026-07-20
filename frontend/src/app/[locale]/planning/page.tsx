"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRouter } from "@/i18n/navigation";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import {
  createPlanningTask,
  fetchPlanningTasks,
  updatePlanningTask,
  type PlanningTask,
  type PlannedTaskStatus,
  type TaskPriority,
} from "@/lib/api/plannedTasks";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { useIsMobile } from "@/lib/useMediaQuery";

type ViewMode = "daily" | "weekly" | "monthly";

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekMonday(ref: Date): Date {
  const x = new Date(ref);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function viewRange(mode: ViewMode): { start: Date; end: Date } {
  const start = startOfWeekMonday(new Date());
  const days = mode === "daily" ? 14 : mode === "weekly" ? 56 : 126;
  return { start, end: addDays(start, days) };
}

function statusBarStyle(s: PlannedTaskStatus): { bg: string; fg: string; statusKey: "statusInProgress" | "statusPendingApproval" | "statusScheduled" | "statusCompleted" | "statusPlanned" } {
  switch (s) {
    case "in_progress":
      return { bg: "#a1a1aa", fg: "#18181b", statusKey: "statusInProgress" };
    case "pending_approval":
      return { bg: "#fb923c", fg: "#fff", statusKey: "statusPendingApproval" };
    case "scheduled":
      return { bg: "#7dd3fc", fg: "#0c4a6e", statusKey: "statusScheduled" };
    case "completed":
      return { bg: "#86efac", fg: "#14532d", statusKey: "statusCompleted" };
    case "planned":
    default:
      return { bg: "#e4e4e7", fg: "#3f3f46", statusKey: "statusPlanned" };
  }
}

function priorityLabel(p: TaskPriority): { priorityKey: "priorityCritical" | "priorityHigh" | "priorityLow" | "priorityNormal"; bg: string; fg: string } {
  switch (p) {
    case "critical":
      return { priorityKey: "priorityCritical", bg: "#fef2f2", fg: "#b91c1c" };
    case "high":
      return { priorityKey: "priorityHigh", bg: "#18181b", fg: "#fafafa" };
    case "low":
      return { priorityKey: "priorityLow", bg: "#f4f4f5", fg: "#71717a" };
    default:
      return { priorityKey: "priorityNormal", bg: "#f4f4f5", fg: "#52525b" };
  }
}

function formatShort(d: Date, intlLocale: string): string {
  return d.toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Column index of the week that contains `ref`, or null if outside `cols`. */
function findCurrentWeekIndex(cols: { start: Date }[], ref: Date): number | null {
  const t = ref.getTime();
  for (let i = 0; i < cols.length; i++) {
    const a = cols[i].start.getTime();
    const b = addDays(cols[i].start, 7).getTime();
    if (t >= a && t < b) return i;
  }
  return null;
}

type PlannerModal = null | { kind: "add" } | { kind: "edit"; taskId: string };

function PlanningPageContent() {
  const t = useTranslations("Planning");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("project");
  const isMobile = useIsMobile(768);
  const labelCol = isMobile ? 112 : 180;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [portfolio, setPortfolio] = useState<ProjectPortfolioCard[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(projectIdFromUrl);
  const [view, setView] = useState<ViewMode>("weekly");
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<PlannerModal>(null);
  const [saving, setSaving] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formPhase, setFormPhase] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formStatus, setFormStatus] = useState<PlannedTaskStatus>("scheduled");
  const [formPriority, setFormPriority] = useState<TaskPriority>("normal");
  const [formError, setFormError] = useState<string | null>(null);

  /** Client-only clock so timeline “now” / current week match the browser and avoid SSR mismatch. */
  const [clientNow, setClientNow] = useState<Date | null>(null);
  useEffect(() => {
    setClientNow(new Date());
    const id = setInterval(() => setClientNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void meRequest().then((m) => setUser(m?.user ?? null));
  }, []);

  useEffect(() => {
    void fetchProjectPortfolio().then((list) => {
      setPortfolio(list ?? []);
    });
  }, []);

  useEffect(() => {
    setProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!portfolio || portfolio.length === 0) return;
    if (projectIdFromUrl) return;
    const first = portfolio[0]!.id;
    router.replace(`/planning?project=${encodeURIComponent(first)}`, { scroll: false });
  }, [portfolio, projectIdFromUrl, router]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const { start, end } = viewRange(view);
    const res = await fetchPlanningTasks(projectId, start, end);
    if (!res) {
      setError(t("loadError"));
      setTasks([]);
      setRange(null);
    } else {
      setTasks(res.tasks);
      setRange(res.range);
    }
    setLoading(false);
  }, [projectId, view, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProject = useMemo(
    () => portfolio?.find((p) => p.id === projectId) ?? null,
    [portfolio, projectId],
  );

  const rangeStart = range ? new Date(range.start) : null;
  const rangeEnd = range ? new Date(range.end) : null;

  const weekColumns = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    const cols: { start: Date; label: string }[] = [];
    let w = new Date(rangeStart);
    while (w < rangeEnd) {
      cols.push({
        start: new Date(w),
        label: t("weekShort", { n: isoWeekNumber(w) }),
      });
      w = addDays(w, 7);
    }
    return cols;
  }, [rangeStart, rangeEnd, t]);

  const timelineTasks = useMemo(() => {
    return [...tasks].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  }, [tasks]);

  const currentWeekIndex = useMemo(() => {
    if (!clientNow || weekColumns.length === 0) return null;
    return findCurrentWeekIndex(weekColumns, clientNow);
  }, [weekColumns, clientNow]);

  const nowPercent = useMemo(() => {
    if (!clientNow || !rangeStart || !rangeEnd) return null;
    const rs = rangeStart.getTime();
    const re = rangeEnd.getTime();
    const t = clientNow.getTime();
    if (t < rs || t > re) return null;
    return ((t - rs) / (re - rs)) * 100;
  }, [clientNow, rangeStart, rangeEnd]);

  const priorityTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
      .slice(0, 8);
  }, [tasks]);

  const insightText = useMemo(() => {
    if (!selectedProject || tasks.length === 0) {
      return t("insightEmpty");
    }
    const ahead = tasks.filter((x) => x.taskStatus === "completed").length;
    const risk = tasks.filter((x) => x.priority === "critical" || x.taskStatus === "pending_approval").length;
    const attention = risk > 0 ? t("insightRisk", { risk }) : t("insightOk");
    return t("insightSummary", {
      name: selectedProject.name,
      count: tasks.length,
      completed: ahead,
      attention,
    });
  }, [selectedProject, tasks, t]);

  function onSelectProject(id: string) {
    router.push(`/planning?project=${encodeURIComponent(id)}`);
  }

  function openEditTask(task: PlanningTask) {
    setFormError(null);
    setFormTitle(task.title);
    setFormPhase(task.phaseLabel ?? "");
    setFormStart(toDatetimeLocalValue(task.startsAt));
    setFormEnd(toDatetimeLocalValue(task.endsAt));
    setFormStatus(task.taskStatus);
    setFormPriority(task.priority);
    setModal({ kind: "edit", taskId: task.id });
  }

  async function onModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !modal) return;
    setFormError(null);
    const starts = new Date(formStart);
    const ends = new Date(formEnd);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      setFormError(t("endAfterStart"));
      return;
    }
    setSaving(true);
    try {
      if (modal.kind === "edit") {
        const existing = tasks.find((t) => t.id === modal.taskId);
        const res = await updatePlanningTask(projectId, modal.taskId, {
          title: formTitle.trim(),
          phaseLabel: formPhase.trim() || null,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          taskStatus: formStatus,
          priority: formPriority,
          sortOrder: existing?.sortOrder ?? 0,
        });
        if (!res.ok) {
          setFormError(t("saveFailed"));
          return;
        }
      } else {
        const res = await createPlanningTask(projectId, {
          title: formTitle.trim(),
          phaseLabel: formPhase.trim() || null,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          taskStatus: formStatus,
          priority: formPriority,
        });
        if (!res.ok) {
          setFormError(t("saveFailed"));
          return;
        }
      }
      setModal(null);
      setFormTitle("");
      setFormPhase("");
      setFormStart("");
      setFormEnd("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function barLayout(task: PlanningTask): { left: number; width: number } | null {
    if (!rangeStart || !rangeEnd) return null;
    const rs = rangeStart.getTime();
    const re = rangeEnd.getTime();
    const ts = new Date(task.startsAt).getTime();
    const te = new Date(task.endsAt).getTime();
    const o0 = Math.max(ts, rs);
    const o1 = Math.min(te, re);
    if (o1 <= o0) return { left: 0, width: 0 };
    const total = re - rs;
    return {
      left: ((o0 - rs) / total) * 100,
      width: ((o1 - o0) / total) * 100,
    };
  }

  return (
    <DashboardShell user={user}>
      <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)" }}>
              {t("eyebrow")}
            </div>
            <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              {t("title")}
            </h1>
            <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.95rem" }}>
              {selectedProject ? (
                <>
                  {t.rich("projectLine", {
                    name: selectedProject.name,
                    strong: (chunks) => <strong style={{ color: "var(--text)" }}>{chunks}</strong>,
                  })}
                  {selectedProject.location ? (
                    <span> · {selectedProject.location}</span>
                  ) : null}
                </>
              ) : (
                t("selectProject")
              )}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", width: isMobile ? "100%" : undefined }}>
            <label
              style={{
                fontSize: "0.85rem",
                color: "var(--muted)",
                display: "flex",
                alignItems: isMobile ? "stretch" : "center",
                flexDirection: isMobile ? "column" : "row",
                gap: 8,
                flex: isMobile ? "1 1 100%" : undefined,
                minWidth: 0,
              }}
            >
              {t("projectLabel")}
              <select
                value={projectId ?? ""}
                onChange={(e) => onSelectProject(e.target.value)}
                style={{
                  padding: "0.45rem 0.65rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: "0.9rem",
                  minWidth: isMobile ? 0 : 220,
                  width: isMobile ? "100%" : undefined,
                }}
              >
                {(portfolio ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div
              style={{
                display: "inline-flex",
                borderRadius: 999,
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: "var(--surface)",
              }}
            >
              {(
                [
                  ["daily", "daily"],
                  ["weekly", "weekly"],
                  ["monthly", "monthly"],
                ] as const
              ).map(([k, labelKey]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    border: "none",
                    background: view === k ? "var(--text)" : "transparent",
                    color: view === k ? "#fff" : "var(--text)",
                    fontWeight: view === k ? 700 : 500,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="app-btn app-btn-primary app-btn-sm"
              onClick={() => {
                setFormError(null);
                setModal({ kind: "add" });
                const d = new Date();
                d.setMinutes(0, 0, 0);
                const e = new Date(d);
                e.setDate(e.getDate() + 7);
                setFormTitle("");
                setFormPhase("");
                setFormStart(toDatetimeLocalValue(d.toISOString()));
                setFormEnd(toDatetimeLocalValue(e.toISOString()));
                setFormStatus("scheduled");
                setFormPriority("normal");
              }}
            >
              {t("addPlanning")}
            </button>
          </div>
        </header>

        {error ? (
          <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{error}</p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%" }}>
          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              background: "var(--surface)",
              overflow: "hidden",
              width: "100%",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.65rem",
                padding: isMobile ? "0.85rem 0.9rem" : "1rem 1.15rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span aria-hidden>📅</span> {t("timeline")}
              </div>
              {rangeStart && rangeEnd ? (
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {formatShort(rangeStart, intlLocale)} – {formatShort(rangeEnd, intlLocale)}
                </span>
              ) : null}
            </div>
            {loading ? (
              <p style={{ padding: "1.5rem", color: "var(--muted)" }}>{t("loading")}</p>
            ) : (
              <div style={{ overflowX: "auto", width: "100%" }}>
                <div style={{ position: "relative", minWidth: "100%", width: "100%" }}>
                  {nowPercent !== null && clientNow ? (
                    <div
                      aria-hidden
                      title={t("now")}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${nowPercent / 100})`,
                        width: 2,
                        marginLeft: -1,
                        zIndex: 3,
                        pointerEvents: "none",
                        background: "var(--text)",
                        borderRadius: 1,
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `${labelCol}px repeat(${Math.max(weekColumns.length, 1)}, minmax(${isMobile ? 72 : 0}px, 1fr))`,
                      width: "100%",
                      minWidth: weekColumns.length === 0 ? undefined : isMobile ? labelCol + weekColumns.length * 72 : "100%",
                      position: "relative",
                      zIndex: 2,
                    }}
                  >
                  <div
                    style={{
                      padding: "0.5rem",
                      borderBottom: "1px solid var(--border)",
                      borderRight: "1px solid var(--border)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "var(--muted)",
                    }}
                  >
                    {t("phaseTask")}
                  </div>
                  {weekColumns.map((w, wi) => {
                    const isThisWeek = currentWeekIndex !== null && wi === currentWeekIndex;
                    return (
                      <div
                        key={w.label + w.start.getTime()}
                        style={{
                          padding: "0.5rem",
                          textAlign: "center",
                          borderBottom: "1px solid var(--border)",
                          borderRight: "1px solid #f4f4f5",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--muted)",
                        }}
                      >
                        <div>{w.label}</div>
                        {isThisWeek ? (
                          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>
                            {t("thisWeek")}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {timelineTasks.map((task) => {
                    const bar = barLayout(task);
                    const st = statusBarStyle(task.taskStatus);
                    const phase = task.phaseLabel?.trim() || t("generalPhase");
                    return (
                      <Fragment key={task.id}>
                        <button
                          type="button"
                          onClick={() => openEditTask(task)}
                          style={{
                            padding: isMobile ? "0.55rem 0.5rem" : "0.65rem 0.75rem",
                            borderBottom: "1px solid var(--border)",
                            borderRight: "1px solid var(--border)",
                            fontSize: isMobile ? "0.72rem" : "0.82rem",
                            background: "var(--surface)",
                            textAlign: "left",
                            cursor: "pointer",
                            font: "inherit",
                            borderLeft: "none",
                            borderTop: "none",
                            minWidth: 0,
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phase}</div>
                          <div style={{ color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                        </button>
                        <button
                          type="button"
                          title={t("barEditTitle", { title: task.title, status: t(st.statusKey) })}
                          onClick={() => openEditTask(task)}
                          style={{
                            gridColumn: "2 / -1",
                            padding: 0,
                            borderBottom: "1px solid var(--border)",
                            position: "relative",
                            minHeight: 56,
                            cursor: "pointer",
                            background: "transparent",
                            borderLeft: "none",
                            borderTop: "none",
                            borderRight: "none",
                            font: "inherit",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                weekColumns.length > 0
                                  ? `repeat(${weekColumns.length}, minmax(0, 1fr))`
                                  : "minmax(0, 1fr)",
                              minHeight: 56,
                              width: "100%",
                              position: "relative",
                            }}
                          >
                            {weekColumns.map((_, wi) => (
                              <div
                                key={wi}
                                aria-hidden
                                style={{
                                  borderRight: wi < weekColumns.length - 1 ? "1px solid #f4f4f5" : undefined,
                                  background: "var(--surface)",
                                }}
                              />
                            ))}
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                zIndex: 1,
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  left: `${bar?.left ?? 0}%`,
                                  width: `${Math.max(bar?.width ?? 0, 2)}%`,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  height: 28,
                                  borderRadius: 8,
                                  background: st.bg,
                                  color: st.fg,
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "0 6px",
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                                  zIndex: 1,
                                }}
                              >
                                {t(st.statusKey)}
                              </div>
                            </div>
                          </div>
                        </button>
                      </Fragment>
                    );
                  })}
                </div>
                </div>
              </div>
            )}
            {!loading && timelineTasks.length === 0 ? (
              <p style={{ padding: "1.25rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                {t.rich("emptyWindow", { strong: (chunks) => <strong>{chunks}</strong> })}
              </p>
            ) : null}
          </section>

          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              background: "var(--surface)",
              padding: "1rem",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{t("resourceTitle")}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>{t("manageFleet")}</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 12px" }}>
{t("resourceDesc")}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "0.65rem",
              }}
            >
              {[
                { name: "Elena Vance", role: t("roleStructural"), load: 78, badge: t("badgeActive"), badgeBg: "#dbeafe", badgeFg: "#1d4ed8" },
                { name: "Marcus Thorne", role: t("roleSite"), load: 45, badge: t("badgeAvailable"), badgeBg: "#ffedd5", badgeFg: "#c2410c" },
              ].map((r) => (
                <div
                  key={r.name}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "0.65rem 0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{r.name}</div>
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        padding: "0.2rem 0.4rem",
                        borderRadius: 6,
                        background: r.badgeBg,
                        color: r.badgeFg,
                      }}
                    >
                      {r.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{r.role}</div>
                  <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--muted)" }}>{t("loadPct")}</div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "#e4e4e7",
                      marginTop: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: `${r.load}%`, height: "100%", background: "var(--text)", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--muted)" }}>
{t("availabilityNote")}
            </div>
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "1.25rem",
              alignItems: "start",
            }}
          >
            <section
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                background: "var(--surface)",
                padding: "1rem",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "0.95rem" }}>{t("priorityTasks")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {priorityTasks.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{t("noTasksInRange")}</p>
                ) : (
                  priorityTasks.map((taskRow) => {
                    const pl = priorityLabel(taskRow.priority);
                    const due = new Date(taskRow.endsAt);
                    const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                    return (
                      <button
                        key={taskRow.id}
                        type="button"
                        onClick={() => openEditTask(taskRow)}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: "0.65rem 0.75rem",
                          textAlign: "left",
                          cursor: "pointer",
                          background: "var(--surface)",
                          font: "inherit",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{taskRow.title}</div>
                          <span
                            style={{
                              fontSize: "0.62rem",
                              fontWeight: 800,
                              letterSpacing: "0.05em",
                              padding: "0.2rem 0.45rem",
                              borderRadius: 6,
                              background: pl.bg,
                              color: pl.fg,
                              flexShrink: 0,
                            }}
                          >
                            {t(pl.priorityKey)}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 6 }}>
                          {days < 0 ? t("endedOn", { date: formatShort(due, intlLocale) }) : days === 0 ? t("dueToday") : t("dueInDays", { days })}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => projectId && router.push(`/projects/${projectId}`)}
                style={{
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--accent)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {t("viewAllTasks")}
              </button>
            </section>

            <section
              style={{
                borderRadius: 14,
                padding: "1.35rem 1.5rem",
                background: "var(--text)",
                color: "#e2e8f0",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "relative", zIndex: 1, maxWidth: "100%" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", color: "#94a3b8" }}>
                  {t("technicalInsight")}
                </div>
                <p style={{ margin: "0.65rem 0 0", lineHeight: 1.55, fontSize: "0.95rem" }}>{insightText}</p>
                <div style={{ marginTop: "1.1rem", display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--text)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                    onClick={() => projectId && router.push(`/projects/${projectId}`)}
                  >
                    {t("editProject")}
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: 8,
                      border: "1px solid #475569",
                      background: "transparent",
                      color: "#e2e8f0",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                    onClick={() => void load()}
                  >
                    {t("refreshData")}
                  </button>
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 8,
                  fontSize: "4.5rem",
                  opacity: 0.12,
                  userSelect: "none",
                }}
                aria-hidden
              >
                ◎
              </div>
            </section>
          </div>
        </div>
      </div>

      {modal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          role="dialog"
          aria-modal
          aria-labelledby="planning-modal-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: "1.35rem",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <h2 id="planning-modal-title" style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>
              {modal.kind === "edit" ? t("editItem") : t("addItem")}
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "var(--muted)" }}>
              {modal.kind === "edit"
                ? t("editSubtitle")
                : t("addSubtitle")}
            </p>
            <form onSubmit={(e) => void onModalSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                {t("phase")}
                <input
                  value={formPhase}
                  onChange={(e) => setFormPhase(e.target.value)}
                  placeholder={t("phasePlaceholder")}
                  style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                {t("taskTitle")} *
                <input
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t("taskPlaceholder")}
                  style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.65rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  {t("start")} *
                  <input
                    required
                    type="datetime-local"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  {t("end")} *
                  <input
                    required
                    type="datetime-local"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.65rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  {t("status")}
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PlannedTaskStatus)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="planned">{t("statusPlanned")}</option>
                    <option value="scheduled">{t("statusScheduled")}</option>
                    <option value="in_progress">{t("statusInProgress")}</option>
                    <option value="pending_approval">{t("statusPendingApproval")}</option>
                    <option value="completed">{t("statusCompleted")}</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  {t("priority")}
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="low">{t("priorityLowOpt")}</option>
                    <option value="normal">{t("priorityNormalOpt")}</option>
                    <option value="high">{t("priorityHighOpt")}</option>
                    <option value="critical">{t("priorityCriticalOpt")}</option>
                  </select>
                </label>
              </div>
              {formError ? (
                <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: 0 }}>{formError}</p>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "0.55rem 1.1rem",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--text)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: saving ? "wait" : "pointer",
                  }}
                >
                  {saving ? tCommon("saving") : tCommon("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function PlanningSuspenseFallback() {
  const t = useTranslations("Planning");
  return (
    <DashboardShell user={null}>
      <p style={{ color: "var(--muted)" }}>{t("loadingPage")}</p>
    </DashboardShell>
  );
}

export default function PlanningPage() {
  return (
    <Suspense fallback={<PlanningSuspenseFallback />}>
      <PlanningPageContent />
    </Suspense>
  );
}
