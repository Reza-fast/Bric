"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActionIconButton, IconTrash } from "@/components/ui/ActionIcons";
import "@/components/time/time.css";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
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

function weekdayLabels(t: (key: string) => string): string[] {
  return [t("weekdayMon"), t("weekdayTue"), t("weekdayWed"), t("weekdayThu"), t("weekdayFri"), t("weekdaySat"), t("weekdaySun")];
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

function IconStop() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function projectCode(name: string, projectId: string | null): string {
  if (!projectId) return "INT";
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 4);
  }
  return (cleaned.slice(0, 4) || "PRJ").toUpperCase();
}

function todayWeekIndex(): number {
  const idx = new Date().getDay() - 1;
  return idx < 0 ? 6 : idx;
}

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
  const t = useTranslations("Time");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];
  const [user, setUser] = useState<AuthUser | null>(null);
  const [manualMsgOk, setManualMsgOk] = useState(false);
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
  const [showAllHistory, setShowAllHistory] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const to = addDays(new Date(), 1);
    const from = addDays(new Date(), -21);
    const [pf, list] = await Promise.all([fetchProjectPortfolio(), fetchTimeLogs(from, to)]);
    setProjects(pf ?? []);
    if (list === null) {
      setError(t("loadError"));
      setLogs([]);
    } else {
      setLogs(list);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void meRequest().then((m) => setUser(m?.user ?? null));
  }, [t]);

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

  const allSorted = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  }, [logs]);

  const displayedLogs = useMemo(() => {
    return showAllHistory ? allSorted : allSorted.slice(0, 6);
  }, [allSorted, showAllHistory]);

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
      note: t("timerNote"),
    });
    persistSession(null);
    if (res.ok) await loadData();
  }

  const sessionStatusLabel = !activeSession
    ? t("statusIdle")
    : activeSession.segmentStartedAt
      ? t("statusActive")
      : t("statusPaused");
  const sessionStatusKind = !activeSession ? "idle" : activeSession.segmentStartedAt ? "active" : "paused";

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manualProjectId) return;
    setManualMsg(null);
    setManualMsgOk(false);
    setManualSaving(true);
    const [hh, mm] = manualStartTime.split(":").map((x) => parseInt(x, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
      setManualSaving(false);
      setManualMsg(t("invalidStart"));
      return;
    }
    const dur = Number(manualDuration.replace(",", "."));
    if (!Number.isFinite(dur) || dur <= 0 || dur > 24) {
      setManualSaving(false);
      setManualMsg(t("invalidDuration"));
      return;
    }
    const start = new Date(`${manualDate}T00:00:00`);
    start.setHours(hh, mm, 0, 0);
    const { remainingHours, dayPoolHours } = dayAllocationHint;
    if (dayPoolHours < 0.0005) {
      setManualSaving(false);
      setManualMsg(t("registerDayFirst"));
      return;
    }
    if (dur > remainingHours + 0.0005) {
      setManualSaving(false);
      setManualMsg(t("onlyLeft", { left: formatDurationHours(remainingHours) }));
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
        setManualMsg(t("registerDayFirst"));
        return;
      }
      if (res.error === "ALLOCATION_EXCEEDS_DAY_POOL") {
        setManualMsg(t("exceedsPool"));
        return;
      }
      setManualMsg(res.status === 403 ? t("notOnProject") : t("saveEntryFailed"));
      return;
    }
    setManualNote("");
    setManualMsgOk(true);
    setManualMsg(t("entrySaved"));
    await loadData();
  }

  async function onDelete(id: string) {
    if (!confirm(t("removeConfirm"))) return;
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

  const todayLabel = new Date().toLocaleDateString(intlLocale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).toUpperCase();
  const todayIdx = todayWeekIndex();

  return (
    <DashboardShell user={user} fullBleed>
      <div className="time-page">
        <div className="time-page-inner">
          <div className="time-layout">
            {/* Left column: session + log entry */}
            <div className="time-main">
              <section className="time-card">
                <div className="time-session-head">
                  <div>
                    <span
                      className={`time-session-badge ${
                        sessionStatusKind === "active"
                          ? "time-session-badge--active"
                          : sessionStatusKind === "paused"
                            ? "time-session-badge--paused"
                            : "time-session-badge--idle"
                      }`}
                    >
                      {sessionStatusLabel}
                    </span>
                    <div className="time-session-date">{todayLabel}</div>
                  </div>
                </div>

                <div className="time-clock-wrap">
                  <div className="time-clock">{formatClock(elapsedSeconds)}</div>
                </div>

                <div className="time-session-actions">
                  {!activeSession ? (
                    <button type="button" onClick={() => onClockIn()} className="app-btn app-btn-primary time-btn-clockin">
                      {t("clockIn")}
                    </button>
                  ) : (
                    <>
                      {activeSession.segmentStartedAt ? (
                        <button type="button" className="time-btn-pause" onClick={() => onPause()} aria-label={t("pauseAria")}>
                          <IconPause />
                          {t("pause")}
                        </button>
                      ) : (
                        <button type="button" className="time-btn-pause" onClick={() => onResume()} aria-label={t("resumeAria")}>
                          <IconPlay />
                          {t("resume")}
                        </button>
                      )}
                      <button type="button" className="time-btn-clockout" onClick={() => void onClockOut()}>
                        <IconStop />
                        {t("clockOut")}
                      </button>
                    </>
                  )}
                </div>

                {activeSession ? <p className="time-session-hint">{t("pauseHint")}</p> : <p className="time-session-hint">{t("timerHint")}</p>}
              </section>

              <section className="time-card">
                <h2 className="time-log-title">{t("logEntry")}</h2>
                <p className="time-log-sub">{t("allocateHours")}</p>

                <form className="time-form" onSubmit={(e) => void onManualSubmit(e)}>
                  <label>
                    <span className="time-field-label">{t("project")}</span>
                    <select
                      required
                      className="time-select"
                      value={manualProjectId}
                      onChange={(e) => setManualProjectId(e.target.value)}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="time-field-label">{t("taskDescription")}</span>
                    <textarea
                      className="time-textarea"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      rows={3}
                      placeholder={t("taskPlaceholder")}
                    />
                  </label>

                  <p className="time-pool-hint">
                    {t("dayPool")}: <strong>{dayAllocationHint.dayPoolHours.toFixed(2)} h</strong> · {t("toProjects")}:{" "}
                    <strong>{dayAllocationHint.allocatedHours.toFixed(2)} h</strong> · {t("remaining")}:{" "}
                    <strong style={{ color: dayAllocationHint.remainingHours < 0.01 ? "#b91c1c" : undefined }}>
                      {dayAllocationHint.remainingHours.toFixed(2)} h
                    </strong>
                  </p>

                  <div className="time-form-row time-form-row--3">
                    <label>
                      <span className="time-field-label">{t("date")}</span>
                      <input
                        type="date"
                        required
                        className="time-input"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="time-field-label">{t("startTime")}</span>
                      <input
                        type="time"
                        required
                        className="time-input"
                        value={manualStartTime}
                        onChange={(e) => setManualStartTime(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="time-field-label">{t("durationH")}</span>
                      <input
                        type="number"
                        required
                        min={0.05}
                        max={24}
                        step={0.05}
                        className="time-input"
                        value={manualDuration}
                        onChange={(e) => setManualDuration(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="time-form-footer">
                    {manualMsg ? (
                      <p className={`time-msg ${manualMsgOk ? "time-msg--ok" : "time-msg--err"}`}>{manualMsg}</p>
                    ) : (
                      <span />
                    )}
                    <button type="submit" className="time-btn-submit" disabled={manualSaving || projects.length === 0}>
                      <IconPlus />
                      {manualSaving ? t("saving") : t("submitEntry")}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            {/* Right column: metrics + activity */}
            <div className="time-sidebar">
              <section className="time-card">
                <p className="time-eyebrow">{t("weeklyMetrics")}</p>
                <div className="time-metrics-total">
                  {weeklyTotalHours.toFixed(1)} <span>/ {WEEK_TARGET_H}h</span>
                </div>

                <div className="time-chart">
                  {weekdayLabels(t).map((label, i) => {
                    const h = dailyHours[i] ?? 0;
                    const fillPct = Math.min(100, (h / DAY_BAR_CAP_H) * 100);
                    const isToday = i === todayIdx;
                    const isWeekend = i >= 5;
                    let fillClass = "time-chart-fill";
                    if (isToday) fillClass += " time-chart-fill--today";
                    else if (isWeekend) fillClass += " time-chart-fill--weekend";

                    return (
                      <div key={label} className="time-chart-col">
                        <div className="time-chart-track">
                          <div className={fillClass} style={{ height: `${fillPct}%`, minHeight: h > 0 ? 3 : 0 }} />
                        </div>
                        <div className="time-chart-label">{label}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="time-card">
                <div className="time-activity-head">
                  <p className="time-eyebrow">{t("activityLog")}</p>
                  <button type="button" className="time-export-btn" onClick={() => onExportCsv()}>
                    {t("exportCsv")}
                  </button>
                </div>

                {loading ? (
                  <p style={{ color: "var(--muted)", margin: 0 }}>{t("loading")}</p>
                ) : error ? (
                  <p className="time-msg time-msg--err">{error}</p>
                ) : displayedLogs.length === 0 ? (
                  <p style={{ color: "var(--muted)", margin: 0 }}>{t("noEntries")}</p>
                ) : (
                  <ul className="time-activity-list">
                    {displayedLogs.map((row) => {
                      const proj = row.projectId ? projects.find((p) => p.id === row.projectId) : undefined;
                      const title = row.projectId === null ? t("dayWorked") : (row.projectName ?? proj?.name ?? t("projectFallback"));
                      const code = projectCode(title, row.projectId);
                      const dateLabel = new Date(row.loggedAt)
                        .toLocaleDateString(intlLocale, { month: "short", day: "numeric" })
                        .toUpperCase();

                      return (
                        <li key={row.id} className="time-activity-item">
                          <div className="time-activity-body">
                            {isHr(user?.role) && row.ownerDisplayName ? (
                              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>
                                {row.ownerDisplayName}
                              </div>
                            ) : null}
                            <span className="time-activity-tag">{code}</span>
                            <div className="time-activity-desc">{row.note?.trim() || title}</div>
                            <div className="time-activity-date">{dateLabel}</div>
                          </div>
                          <div className="time-activity-hours">{row.durationHours.toFixed(2)}h</div>
                          <div className="time-activity-delete">
                            <ActionIconButton
                              label={t("deleteEntry")}
                              variant="danger"
                              onClick={() => void onDelete(row.id)}
                            >
                              <IconTrash />
                            </ActionIconButton>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {allSorted.length > 6 ? (
                  <button
                    type="button"
                    className="time-view-history"
                    onClick={() => setShowAllHistory((v) => !v)}
                  >
                    {showAllHistory ? t("showLess") : t("viewFullHistory")}
                  </button>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
