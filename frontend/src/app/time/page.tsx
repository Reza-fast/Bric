"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { createTimeLog, deleteTimeLog, fetchTimeLogs, type TimeLogRow } from "@/lib/api/timeLogs";
import { isHr } from "@/lib/api/roles";

const SESSION_KEY = "bric_time_tracker_session_v3";

/** Running timer: day-level clock — `loggedAt` on clock-out is session start (no project). */
type ActiveSession = {
  sessionStartedAt: string;
  accumulatedActiveMs: number;
  segmentStartedAt: string | null;
};

function parseStoredSession(raw: string | null): ActiveSession | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof o.sessionStartedAt === "string" &&
      typeof o.accumulatedActiveMs === "number" &&
      (o.segmentStartedAt === null || typeof o.segmentStartedAt === "string")
    ) {
      return {
        sessionStartedAt: o.sessionStartedAt,
        accumulatedActiveMs: o.accumulatedActiveMs,
        segmentStartedAt: o.segmentStartedAt as string | null,
      };
    }
    if (typeof o.startedAt === "string") {
      return {
        sessionStartedAt: o.startedAt,
        accumulatedActiveMs: 0,
        segmentStartedAt: o.startedAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** UTC calendar day containing `loggedAt` — matches server validation. */
function utcDayInterval(loggedAt: Date): { start: Date; end: Date } {
  const startMs = Date.UTC(
    loggedAt.getUTCFullYear(),
    loggedAt.getUTCMonth(),
    loggedAt.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return { start: new Date(startMs), end: new Date(startMs + 86_400_000) };
}

function logInUtcDay(log: TimeLogRow, start: Date, end: Date): boolean {
  const t = new Date(log.loggedAt).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function totalActiveMs(s: ActiveSession, nowMs: number): number {
  let t = s.accumulatedActiveMs;
  if (s.segmentStartedAt) {
    t += nowMs - new Date(s.segmentStartedAt).getTime();
  }
  return t;
}

const WEEK_TARGET_H = 40;
/** Visual scale for weekly bar chart: full bar height = this many hours in a day. */
const DAY_BAR_CAP_H = 8;

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatDurationHours(totalHours: number): string {
  if (!Number.isFinite(totalHours) || totalHours <= 0) return "0m";
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function weekdayLabels(): string[] {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

function IconPause() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

const labelCaps: CSSProperties = {
  fontSize: "0.65rem",
  fontWeight: 800,
  letterSpacing: "0.12em",
  color: "#64748b",
  textTransform: "uppercase",
};

const fieldStyle: CSSProperties = {
  padding: "0.55rem 0.75rem",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: "0.9rem",
  background: "#f8fafc",
  width: "100%",
  boxSizing: "border-box",
};

function logsToCsv(rows: TimeLogRow[]): string {
  const header = ["loggedAt", "project", "durationHours", "note"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const note = (r.note ?? "").replaceAll('"', '""');
    lines.push(
      [`"${r.loggedAt}"`, `"${r.projectName ?? r.projectId}"`, String(r.durationHours), `"${note}"`].join(","),
    );
  }
  return lines.join("\n");
}

export default function TimeTrackerPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<ProjectPortfolioCard[]>([]);
  const [logs, setLogs] = useState<TimeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [tick, setTick] = useState(0);

  const [manualProjectId, setManualProjectId] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualStartTime, setManualStartTime] = useState("09:00");
  const [manualDuration, setManualDuration] = useState("2.5");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMsg, setManualMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const to = addDays(new Date(), 1);
    const from = addDays(new Date(), -21);
    const [pf, list] = await Promise.all([fetchProjectPortfolio(), fetchTimeLogs(from, to)]);
    setProjects(pf ?? []);
    if (list === null) {
      setError("Could not load time logs.");
      setLogs([]);
    } else {
      setLogs(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void meRequest().then((m) => setUser(m?.user ?? null));
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const s = parseStoredSession(raw);
    if (s) {
      setActiveSession(s);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } else if (raw) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!activeSession?.segmentStartedAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeSession?.segmentStartedAt]);

  useEffect(() => {
    if (projects.length === 0) return;
    setManualProjectId((prev) => prev || projects[0]!.id);
  }, [projects]);

  /** HR receives org-wide logs; pool math for *your* entries only. */
  const logsForMyPool = useMemo(() => {
    if (!user?.id) return logs;
    if (isHr(user.role)) return logs.filter((l) => l.userId === user.id);
    return logs;
  }, [logs, user?.id, user?.role]);

  const weekDayClockLogs = useMemo(() => {
    const now = new Date();
    const start = startOfWeekMonday(now);
    const end = addDays(start, 7);
    return logs.filter((l) => {
      if (l.projectId !== null) return false;
      const t = new Date(l.loggedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
  }, [logs]);

  const weeklyTotalHours = useMemo(
    () => weekDayClockLogs.reduce((s, l) => s + l.durationHours, 0),
    [weekDayClockLogs],
  );

  const dailyHours = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    for (const l of weekDayClockLogs) {
      const d = new Date(l.loggedAt);
      let idx = d.getDay() - 1;
      if (idx < 0) idx = 6;
      arr[idx] += l.durationHours;
    }
    return arr;
  }, [weekDayClockLogs]);

  const manualAnchorLoggedAt = useMemo(() => {
    const [hh, mm] = manualStartTime.split(":").map((x) => parseInt(x, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const start = new Date(`${manualDate}T00:00:00`);
    start.setHours(hh, mm, 0, 0);
    return start;
  }, [manualDate, manualStartTime]);

  const dayAllocationHint = useMemo(() => {
    if (!manualAnchorLoggedAt) return { dayPoolHours: 0, allocatedHours: 0, remainingHours: 0 };
    const { start, end } = utcDayInterval(manualAnchorLoggedAt);
    let dayPool = 0;
    let allocated = 0;
    for (const l of logsForMyPool) {
      if (!logInUtcDay(l, start, end)) continue;
      if (l.projectId === null) dayPool += l.durationHours;
      else allocated += l.durationHours;
    }
    return {
      dayPoolHours: dayPool,
      allocatedHours: allocated,
      remainingHours: Math.max(0, dayPool - allocated),
    };
  }, [logsForMyPool, manualAnchorLoggedAt]);

  const recentSorted = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()).slice(0, 20);
  }, [logs]);

  const elapsedSeconds = useMemo(() => {
    if (!activeSession) return 0;
    return totalActiveMs(activeSession, Date.now()) / 1000;
  }, [activeSession, tick]);

  function persistSession(s: ActiveSession | null) {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
    setActiveSession(s);
  }

  function onClockIn() {
    const now = new Date().toISOString();
    persistSession({
      sessionStartedAt: now,
      accumulatedActiveMs: 0,
      segmentStartedAt: now,
    });
  }

  function onPause() {
    if (!activeSession?.segmentStartedAt) return;
    const seg = new Date(activeSession.segmentStartedAt).getTime();
    const add = Date.now() - seg;
    persistSession({
      ...activeSession,
      accumulatedActiveMs: activeSession.accumulatedActiveMs + add,
      segmentStartedAt: null,
    });
  }

  function onResume() {
    if (!activeSession || activeSession.segmentStartedAt !== null) return;
    persistSession({
      ...activeSession,
      segmentStartedAt: new Date().toISOString(),
    });
  }

  async function onClockOut() {
    if (!activeSession) return;
    const totalMs = totalActiveMs(activeSession, Date.now());
    const hours = totalMs / 3600000;
    if (hours < 1 / 120) {
      persistSession(null);
      return;
    }
    const res = await createTimeLog({
      projectId: null,
      durationHours: Math.round(hours * 1000) / 1000,
      loggedAt: activeSession.sessionStartedAt,
      note: "Timer session",
    });
    persistSession(null);
    if (res.ok) await loadData();
  }

  const sessionStatusLabel = !activeSession ? "IDLE" : activeSession.segmentStartedAt ? "ACTIVE" : "PAUSED";

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manualProjectId) return;
    setManualMsg(null);
    setManualSaving(true);
    const [hh, mm] = manualStartTime.split(":").map((x) => parseInt(x, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
      setManualSaving(false);
      setManualMsg("Enter a valid start time.");
      return;
    }
    const dur = Number(manualDuration.replace(",", "."));
    if (!Number.isFinite(dur) || dur <= 0 || dur > 24) {
      setManualSaving(false);
      setManualMsg("Duration must be between 0 and 24 hours.");
      return;
    }
    const start = new Date(`${manualDate}T00:00:00`);
    start.setHours(hh, mm, 0, 0);
    const { remainingHours, dayPoolHours } = dayAllocationHint;
    if (dayPoolHours < 0.0005) {
      setManualSaving(false);
      setManualMsg("Register day hours first (clock in and out) before allocating time to a project.");
      return;
    }
    if (dur > remainingHours + 0.0005) {
      setManualSaving(false);
      setManualMsg(
        `Only ${formatDurationHours(remainingHours)} left to assign to projects for that day (from your registered hours).`,
      );
      return;
    }
    const res = await createTimeLog({
      projectId: manualProjectId,
      durationHours: dur,
      loggedAt: start.toISOString(),
      note: manualNote.trim() || null,
    });
    setManualSaving(false);
    if (!res.ok) {
      if (res.error === "DAY_POOL_EMPTY") {
        setManualMsg("Register day hours first (clock in and out) before allocating time to a project.");
        return;
      }
      if (res.error === "ALLOCATION_EXCEEDS_DAY_POOL") {
        setManualMsg("That duration exceeds the project time left for your registered hours that day.");
        return;
      }
      setManualMsg(res.status === 403 ? "You are not on that project." : "Could not save this entry.");
      return;
    }
    setManualNote("");
    setManualMsg("Entry saved.");
    await loadData();
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this time entry?")) return;
    const ok = await deleteTimeLog(id);
    if (ok) await loadData();
  }

  function onExportCsv() {
    const csv = logsToCsv([...logs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const weekPct = Math.min(100, Math.round((weeklyTotalHours / WEEK_TARGET_H) * 100));

  const pageBg =
    "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0) 0 0/18px 18px, linear-gradient(180deg, #e8f1f9 0%, #eef2f7 50%, #f8fafc 100%)";

  return (
    <DashboardShell user={user} fullBleed>
      <div style={{ flex: 1, minHeight: "100%", background: pageBg, width: "100%", boxSizing: "border-box" }}>
        <div style={{ padding: "1.25rem clamp(1rem, 4vw, 3rem) 2.5rem", width: "100%", maxWidth: "100%" }}>
          <header
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              paddingBottom: "1.15rem",
              marginBottom: "1.5rem",
              borderBottom: "1px solid rgba(148, 163, 184, 0.4)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ ...labelCaps, marginBottom: 4 }}>Schedule</div>
              <div style={{ fontWeight: 800, fontSize: "clamp(1.15rem, 2vw, 1.45rem)", color: "#0f172a", letterSpacing: "-0.02em" }}>
                BRIC Architecture
              </div>
            </div>
            <nav
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.15rem",
              }}
              aria-label="Workspace"
            >
              <Link
                href="/projects"
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  textDecoration: "none",
                }}
              >
                Projects
              </Link>
              <Link
                href="/time"
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#0f172a",
                  textDecoration: "none",
                  borderBottom: "2px solid #0f172a",
                }}
              >
                Schedule
              </Link>
              <Link
                href="/reporting"
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  textDecoration: "none",
                }}
              >
                Reports
              </Link>
            </nav>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
              gap: "clamp(1rem, 2vw, 1.75rem)",
              marginBottom: "1rem",
              alignItems: "stretch",
            }}
          >
            <section
              style={{
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                padding: "clamp(1.25rem, 2.5vw, 2rem) clamp(1.35rem, 3vw, 2.5rem)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                <div>
                  <div style={{ ...labelCaps, marginBottom: 6 }}>Today&apos;s session</div>
                  <div style={{ fontSize: "0.98rem", color: "#334155", fontWeight: 600 }}>{todayLabel}</div>
                </div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    padding: "0.35rem 0.65rem",
                    borderRadius: 999,
                    background:
                      sessionStatusLabel === "ACTIVE"
                        ? "#dbeafe"
                        : sessionStatusLabel === "PAUSED"
                          ? "#ffedd5"
                          : "#f1f5f9",
                    color:
                      sessionStatusLabel === "ACTIVE"
                        ? "#1d4ed8"
                        : sessionStatusLabel === "PAUSED"
                          ? "#c2410c"
                          : "#64748b",
                  }}
                >
                  {sessionStatusLabel}
                </span>
              </div>

              <p style={{ margin: "0.85rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                The timer records your day (no project). Allocate time to projects below from those registered hours.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "clamp(96px, 12vw, 140px)",
                  margin: "0.75rem 0 1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    color: "#0f172a",
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  {formatClock(elapsedSeconds)}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "stretch" }}>
                {!activeSession ? (
                  <button
                    type="button"
                    onClick={() => onClockIn()}
                    style={{
                      flex: "1 1 200px",
                      padding: "0.75rem 1.25rem",
                      borderRadius: 10,
                      border: "none",
                      background: "#0f172a",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                    }}
                  >
                    Clock in
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void onClockOut()}
                      style={{
                        flex: "1 1 180px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "0.75rem 1.25rem",
                        borderRadius: 10,
                        border: "none",
                        background: "#0f172a",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "1rem", opacity: 0.9 }} aria-hidden>
                        ■
                      </span>
                      Clock out
                    </button>
                    {activeSession.segmentStartedAt ? (
                      <button
                        type="button"
                        title="Pause"
                        aria-label="Pause timer"
                        onClick={() => onPause()}
                        style={{
                          width: 48,
                          minHeight: 48,
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          color: "#334155",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconPause />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Resume"
                        aria-label="Resume timer"
                        onClick={() => onResume()}
                        style={{
                          width: 48,
                          minHeight: 48,
                          borderRadius: 10,
                          border: "1px solid #93c5fd",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconPlay />
                      </button>
                    )}
                  </>
                )}
              </div>
              {activeSession ? (
                <p style={{ margin: "0.75rem 0 0", fontSize: "0.76rem", color: "#94a3b8", lineHeight: 1.45 }}>
                  Pause for lunch or breaks; resume to continue. Active time is saved to your day when you clock out.
                </p>
              ) : null}
            </section>

            <section
              style={{
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                padding: "clamp(1.25rem, 2.5vw, 2rem) clamp(1.35rem, 3vw, 2.5rem)",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minHeight: 0,
              }}
            >
              <div style={{ ...labelCaps, marginBottom: 8 }}>Weekly summary</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  {weeklyTotalHours.toFixed(1)}{" "}
                  <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "1.05rem" }}>/ {WEEK_TARGET_H}h</span>
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ea580c" }}>{weekPct}% Complete</div>
              </div>
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "1.5rem",
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  minHeight: "clamp(120px, 18vw, 160px)",
                }}
              >
                {weekdayLabels().map((label, i) => {
                  const h = dailyHours[i] ?? 0;
                  const fillPct = Math.min(100, (h / DAY_BAR_CAP_H) * 100);
                  const isWeekend = i >= 5;
                  const fillGradient = isWeekend
                    ? "linear-gradient(180deg, #fb923c, #ea580c)"
                    : "linear-gradient(180deg, #1e3a8a, #172554)";
                  return (
                    <div
                      key={label}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}
                    >
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 52,
                          height: "clamp(112px, 22vw, 140px)",
                          borderRadius: 10,
                          background: "#e2e8f0",
                          display: "flex",
                          alignItems: "flex-end",
                          overflow: "hidden",
                          alignSelf: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: `${fillPct}%`,
                            minHeight: h > 0 ? 3 : 0,
                            borderRadius: fillPct >= 98 ? 10 : "9px 9px 3px 3px",
                            background: fillGradient,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", color: "#475569" }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
              gap: "clamp(1rem, 2vw, 1.75rem)",
              alignItems: "start",
            }}
          >
            <section
              style={{
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                padding: "clamp(1.25rem, 2.5vw, 2rem) clamp(1.35rem, 3vw, 2.5rem)",
              }}
            >
              <div style={{ ...labelCaps, marginBottom: "1rem" }}>New registration</div>
              <form onSubmit={(e) => void onManualSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <label style={{ display: "block" }}>
                  <span style={{ ...labelCaps, display: "block", marginBottom: 6 }}>Project</span>
                  <select
                    required
                    value={manualProjectId}
                    onChange={(e) => setManualProjectId(e.target.value)}
                    style={{ ...fieldStyle, cursor: "pointer" }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ ...labelCaps, display: "block", marginBottom: 6 }}>Task description</span>
                  <textarea
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    rows={3}
                    placeholder="Describe the architectural phase or task…"
                    style={{
                      ...fieldStyle,
                      resize: "vertical",
                      fontFamily: "inherit",
                      minHeight: "4.5rem",
                    }}
                  />
                </label>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                  Day registered: <strong>{dayAllocationHint.dayPoolHours.toFixed(2)} h</strong> · To projects:{" "}
                  <strong>{dayAllocationHint.allocatedHours.toFixed(2)} h</strong> · Remaining:{" "}
                  <strong style={{ color: dayAllocationHint.remainingHours < 0.01 ? "#b91c1c" : "#0f172a" }}>
                    {dayAllocationHint.remainingHours.toFixed(2)} h
                  </strong>
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <label style={{ display: "block", flex: "1 1 140px" }}>
                    <span style={{ ...labelCaps, display: "block", marginBottom: 6 }}>Date</span>
                    <input
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      style={fieldStyle}
                    />
                  </label>
                  <label style={{ display: "block", flex: "1 1 120px" }}>
                    <span style={{ ...labelCaps, display: "block", marginBottom: 6 }}>Start time</span>
                    <input
                      type="time"
                      required
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      style={fieldStyle}
                    />
                  </label>
                  <label style={{ display: "block", flex: "1 1 120px" }}>
                    <span style={{ ...labelCaps, display: "block", marginBottom: 6 }}>Duration (h)</span>
                    <input
                      type="number"
                      required
                      min={0.05}
                      max={24}
                      step={0.05}
                      value={manualDuration}
                      onChange={(e) => setManualDuration(e.target.value)}
                      style={fieldStyle}
                    />
                  </label>
                </div>
                {manualMsg ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: manualMsg.includes("saved") ? "#047857" : "#b91c1c" }}>{manualMsg}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={manualSaving || projects.length === 0}
                  style={{
                    width: "100%",
                    marginTop: "0.15rem",
                    padding: "0.75rem 1.25rem",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(180deg, #ffedd5, #fed7aa)",
                    color: "#9a3412",
                    fontWeight: 800,
                    fontSize: "0.92rem",
                    letterSpacing: "0.02em",
                    cursor: manualSaving ? "wait" : "pointer",
                    boxShadow: "0 4px 14px rgba(234, 88, 12, 0.2)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span aria-hidden style={{ fontSize: "1.1rem", fontWeight: 700, opacity: 0.85 }}>
                    +
                  </span>
                  {manualSaving ? "Saving…" : "Submit entry"}
                </button>
              </form>
            </section>

            <section
              style={{
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                padding: "clamp(1.25rem, 2.5vw, 2rem) clamp(1.35rem, 3vw, 2.5rem)",
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={labelCaps}>Recent activity</div>
                <button
                  type="button"
                  onClick={() => onExportCsv()}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#2563eb",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    padding: "0.25rem 0",
                  }}
                >
                  Export CSV
                </button>
              </div>
              {loading ? (
                <p style={{ color: "#64748b", margin: 0 }}>Loading…</p>
              ) : error ? (
                <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>
              ) : recentSorted.length === 0 ? (
                <p style={{ color: "#64748b", margin: 0 }}>No entries yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
                  {recentSorted.map((row) => {
                    const proj = row.projectId ? projects.find((p) => p.id === row.projectId) : undefined;
                    const title = row.projectId === null ? "Day worked" : (row.projectName ?? proj?.name ?? "Project");
                    const titleColor = row.projectId === null ? "#475569" : "#ea580c";
                    return (
                      <li
                        key={row.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.65rem",
                          padding: "0.65rem 0",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: "#e0e7ff",
                            flexShrink: 0,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "0.85rem",
                          }}
                          aria-hidden
                        >
                          ⏱
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isHr(user?.role) && row.ownerDisplayName ? (
                            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, marginBottom: 2 }}>
                              {row.ownerDisplayName}
                            </div>
                          ) : null}
                          <div style={{ fontWeight: 800, color: titleColor, fontSize: "0.72rem", letterSpacing: "0.06em" }}>
                            {title.toUpperCase()}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#334155", marginTop: 4, lineHeight: 1.35 }}>{row.note ?? "—"}</div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                            {new Date(row.loggedAt).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: "#334155", fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                          {formatDurationHours(row.durationHours)}
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDelete(row.id)}
                          title="Delete"
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: "#94a3b8",
                            fontSize: "1rem",
                            padding: "0 0.25rem",
                          }}
                        >
                          🗑
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div style={{ marginTop: "auto", paddingTop: "1.25rem" }}>
                <Link
                  href="/reporting"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "0.65rem 1rem",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                  }}
                >
                  View monthly archive
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
