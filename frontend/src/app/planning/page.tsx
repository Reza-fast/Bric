"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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

function statusBarStyle(s: PlannedTaskStatus): { bg: string; fg: string; label: string } {
  switch (s) {
    case "in_progress":
      return { bg: "#a1a1aa", fg: "#18181b", label: "In progress" };
    case "pending_approval":
      return { bg: "#fb923c", fg: "#fff", label: "Pending approval" };
    case "scheduled":
      return { bg: "#7dd3fc", fg: "#0c4a6e", label: "Scheduled" };
    case "completed":
      return { bg: "#86efac", fg: "#14532d", label: "Completed" };
    case "planned":
    default:
      return { bg: "#e4e4e7", fg: "#3f3f46", label: "Planned" };
  }
}

function priorityLabel(p: TaskPriority): { text: string; bg: string; fg: string } {
  switch (p) {
    case "critical":
      return { text: "CRITICAL", bg: "#fef2f2", fg: "#b91c1c" };
    case "high":
      return { text: "HIGH", bg: "#18181b", fg: "#fafafa" };
    case "low":
      return { text: "LOW", bg: "#f4f4f5", fg: "#71717a" };
    default:
      return { text: "NORM", bg: "#f4f4f5", fg: "#52525b" };
  }
}

function formatShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("project");

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
      setError("Could not load planning data.");
      setTasks([]);
      setRange(null);
    } else {
      setTasks(res.tasks);
      setRange(res.range);
    }
    setLoading(false);
  }, [projectId, view]);

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
        label: `WK ${isoWeekNumber(w)}`,
      });
      w = addDays(w, 7);
    }
    return cols;
  }, [rangeStart, rangeEnd]);

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
      return "Add planning items to see schedule insights and coordination notes for this project.";
    }
    const ahead = tasks.filter((t) => t.taskStatus === "completed").length;
    const risk = tasks.filter((t) => t.priority === "critical" || t.taskStatus === "pending_approval").length;
    return `${selectedProject.name}: ${tasks.length} line item(s) on the timeline. ${ahead} completed milestone(s). ${
      risk > 0 ? `${risk} item(s) need attention (critical or pending approval).` : "No critical blockers flagged."
    }`;
  }, [selectedProject, tasks]);

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
      setFormError("End must be after start.");
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
          setFormError("Could not save. Try again.");
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
          setFormError("Could not save. Try again.");
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
              TECHNICAL PLANNING
            </div>
            <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              Technical planning
            </h1>
            <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.95rem" }}>
              {selectedProject ? (
                <>
                  Project: <strong style={{ color: "var(--text)" }}>{selectedProject.name}</strong>
                  {selectedProject.location ? (
                    <span> · {selectedProject.location}</span>
                  ) : null}
                </>
              ) : (
                "Select a project to load the schedule."
              )}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
              Project
              <select
                value={projectId ?? ""}
                onChange={(e) => onSelectProject(e.target.value)}
                style={{
                  padding: "0.45rem 0.65rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: "0.9rem",
                  minWidth: 220,
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
                borderRadius: 10,
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: "var(--surface)",
              }}
            >
              {(
                [
                  ["daily", "Daily"],
                  ["weekly", "Weekly"],
                  ["monthly", "Monthly"],
                ] as const
              ).map(([k, label]) => (
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
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
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
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 10,
                border: "none",
                background: "#ea580c",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              + Add planning
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
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.15rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span aria-hidden>📅</span> Project timeline
              </div>
              {rangeStart && rangeEnd ? (
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {formatShort(rangeStart)} – {formatShort(rangeEnd)}
                </span>
              ) : null}
            </div>
            {loading ? (
              <p style={{ padding: "1.5rem", color: "var(--muted)" }}>Loading timeline…</p>
            ) : (
              <div style={{ overflowX: "auto", width: "100%" }}>
                <div style={{ position: "relative", minWidth: "100%", width: "100%" }}>
                  {nowPercent !== null && clientNow ? (
                    <div
                      aria-hidden
                      title="Now"
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `calc(180px + (100% - 180px) * ${nowPercent / 100})`,
                        width: 2,
                        marginLeft: -1,
                        zIndex: 3,
                        pointerEvents: "none",
                        background: "#ea580c",
                        borderRadius: 1,
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `180px repeat(${Math.max(weekColumns.length, 1)}, minmax(0, 1fr))`,
                      width: "100%",
                      minWidth: weekColumns.length === 0 ? undefined : "100%",
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
                    Phase / task
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
                            This week
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {timelineTasks.map((task) => {
                    const bar = barLayout(task);
                    const st = statusBarStyle(task.taskStatus);
                    const phase = task.phaseLabel?.trim() || "General";
                    return (
                      <Fragment key={task.id}>
                        <button
                          type="button"
                          onClick={() => openEditTask(task)}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderBottom: "1px solid var(--border)",
                            borderRight: "1px solid var(--border)",
                            fontSize: "0.82rem",
                            background: "var(--surface)",
                            textAlign: "left",
                            cursor: "pointer",
                            font: "inherit",
                            borderLeft: "none",
                            borderTop: "none",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{phase}</div>
                          <div style={{ color: "var(--muted)", marginTop: 4 }}>{task.title}</div>
                        </button>
                        <button
                          type="button"
                          title={`${task.title} · ${st.label} — click to edit`}
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
                                {st.label}
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
                No planning items in this window. Use <strong>+ Add planning</strong> to create phases and tasks.
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
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>👷 Resource allocation</span>
              <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>Manage fleet ›</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 12px" }}>
              Placeholder roster for coordination (link members to projects in a future release).
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "0.65rem",
              }}
            >
              {[
                { name: "Elena Vance", role: "Structural lead", load: 78, badge: "ACTIVE", badgeBg: "#dbeafe", badgeFg: "#1d4ed8" },
                { name: "Marcus Thorne", role: "Site supervisor", load: 45, badge: "AVAILABLE", badgeBg: "#ffedd5", badgeFg: "#c2410c" },
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
                  <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--muted)" }}>% LOAD</div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "#e4e4e7",
                      marginTop: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: `${r.load}%`, height: "100%", background: "#2563eb", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--muted)" }}>
              Availability matrix (Mon–Fri) is illustrative.
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
              <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "0.95rem" }}>✓ Priority tasks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {priorityTasks.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>No tasks in range.</p>
                ) : (
                  priorityTasks.map((t) => {
                    const pl = priorityLabel(t.priority);
                    const due = new Date(t.endsAt);
                    const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openEditTask(t)}
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
                          <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{t.title}</div>
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
                            {pl.text}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 6 }}>
                          {days < 0 ? `Ended ${formatShort(due)}` : days === 0 ? "Due today" : `Due in ${days} day(s)`}
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
                View all project tasks →
              </button>
            </section>

            <section
              style={{
                borderRadius: 14,
                padding: "1.35rem 1.5rem",
                background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                color: "#e2e8f0",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "relative", zIndex: 1, maxWidth: "100%" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", color: "#94a3b8" }}>
                  TECHNICAL INSIGHT
                </div>
                <p style={{ margin: "0.65rem 0 0", lineHeight: 1.55, fontSize: "0.95rem" }}>{insightText}</p>
                <div style={{ marginTop: "1.1rem", display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: 8,
                      border: "none",
                      background: "#ea580c",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                    onClick={() => projectId && router.push(`/projects/${projectId}`)}
                  >
                    Edit project
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
                    Refresh data
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
              {modal.kind === "edit" ? "Edit planning item" : "Add planning item"}
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "var(--muted)" }}>
              {modal.kind === "edit"
                ? "Update this row on the timeline. Changes apply to the selected project."
                : "Creates a row on the timeline for the selected project (phase label groups rows in the first column)."}
            </p>
            <form onSubmit={(e) => void onModalSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                Phase / workstream
                <input
                  value={formPhase}
                  onChange={(e) => setFormPhase(e.target.value)}
                  placeholder="e.g. Excavation"
                  style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                Task title *
                <input
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Site inspection"
                  style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  Start *
                  <input
                    required
                    type="datetime-local"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  End *
                  <input
                    required
                    type="datetime-local"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  Status
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PlannedTaskStatus)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="planned">Planned</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In progress</option>
                    <option value="pending_approval">Pending approval</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600 }}>
                  Priority
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    style={{ padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
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
                  Cancel
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
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

export default function PlanningPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell user={null}>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </DashboardShell>
      }
    >
      <PlanningPageContent />
    </Suspense>
  );
}
