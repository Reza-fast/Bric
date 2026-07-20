"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { meRequest } from "@/lib/api/auth";
import type { AuthUser } from "@/lib/api/auth";
import type { DashboardActivity, DashboardPayload, PlannedTask, ProjectHoursSummary } from "@/lib/api/dashboard";
import { fetchDashboard } from "@/lib/api/dashboard";
import { useIsMobile } from "@/lib/useMediaQuery";

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function statusTone(status?: string): { bg: string; fg: string } {
  switch (status) {
    case "completed":
      return { bg: "#dcfce7", fg: "#166534" };
    case "in_progress":
      return { bg: "#dbeafe", fg: "#1d4ed8" };
    case "pending_approval":
      return { bg: "#ffedd5", fg: "#c2410c" };
    case "scheduled":
      return { bg: "#e0f2fe", fg: "#0f766e" };
    default:
      return { bg: "#f1f5f9", fg: "#475569" };
  }
}

function priorityTone(priority?: string): { bg: string; fg: string } {
  switch (priority) {
    case "critical":
      return { bg: "#111827", fg: "#ffffff" };
    case "high":
      return { bg: "#fee2e2", fg: "#b91c1c" };
    case "low":
      return { bg: "#f8fafc", fg: "#64748b" };
    default:
      return { bg: "#eef2ff", fg: "#4338ca" };
  }
}

function getOverBudgetRows(rows: ProjectHoursSummary[]) {
  return rows.filter((row) => row.isOverBudget);
}

function getNextTasks(tasks: PlannedTask[]) {
  return [...tasks]
    .filter((task) => new Date(task.endsAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 4);
}

function getRecentInsights(items: DashboardActivity[]) {
  return [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
}

function Surface({
  title,
  eyebrow,
  aside,
  children,
}: {
  title: string;
  eyebrow?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: "1.2rem",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          {eyebrow ? (
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
              {eyebrow}
            </div>
          ) : null}
          <h2 style={{ margin: eyebrow ? "0.3rem 0 0" : 0, fontSize: "1rem", color: "#0f172a" }}>{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];
  const isMobile = useIsMobile(768);
  const [data, setData] = useState<DashboardPayload | null | undefined>(undefined);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [dash, me] = await Promise.all([fetchDashboard(), meRequest()]);
      if (cancelled) return;
      setUser(me?.user ?? null);
      setData(dash);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overBudgetRows = useMemo(() => (data ? getOverBudgetRows(data.projectHours) : []), [data]);
  const nextTasks = useMemo(() => (data ? getNextTasks(data.weekTasks) : []), [data]);
  const recentInsights = useMemo(() => (data ? getRecentInsights(data.activities) : []), [data]);
  const avgCompletion = useMemo(() => {
    if (!data || data.projectHours.length === 0) return 0;
    const pct = data.projectHours.reduce((sum, row) => sum + Math.min(row.percentUsed, 100), 0) / data.projectHours.length;
    return Math.round(pct);
  }, [data]);
  const completionTrend = avgCompletion >= 80 ? "↑" : avgCompletion >= 55 ? "↗" : "→";
  const refreshedAt = useMemo(() => new Date().toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" }), [intlLocale, data]);

  return (
    <DashboardShell user={user}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.4rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
            {t("eyebrow")}
          </div>
          <h1 style={{ margin: "0.3rem 0 0.35rem", fontSize: isMobile ? "1.7rem" : "2rem", letterSpacing: "-0.03em", color: "#0f172a" }}>
            {t("title")}
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", maxWidth: 560 }}>{t("subtitle")}</p>
        </div>
        <div
          style={{
            padding: "0.7rem 0.9rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--muted)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {t("lastUpdated", { time: refreshedAt })}
        </div>
      </div>
      {data === undefined ? (
        <p style={{ color: "var(--muted)" }}>{t("loading")}</p>
      ) : !data ? (
        <p style={{ color: "var(--muted)" }}>{t("loadError")}</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.55fr) minmax(280px, 0.9fr)",
              gap: "1rem",
              marginBottom: "1rem",
              alignItems: "stretch",
            }}
          >
            <Surface
              eyebrow={t("portfolioHealth")}
              title={t("overviewTitle")}
              aside={
                <span
                  style={{
                    padding: "0.35rem 0.55rem",
                    borderRadius: 999,
                    background: "#e0f2fe",
                    color: "#0f766e",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {t("quarterOverview")}
                </span>
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                  gap: "1rem",
                }}
              >
                {[
                  { label: t("activeProjects"), value: data.metrics.activeProjects, hint: t("liveProjects") },
                  { label: t("avgCompletion"), value: `${avgCompletion}% ${completionTrend}`, hint: t("deliveryMomentum") },
                  { label: t("totalHours"), value: data.metrics.totalHoursThisWeek.toLocaleString(intlLocale), hint: data.metrics.weekLabel },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: "0.3rem", fontSize: isMobile ? "1.8rem" : "2.2rem", fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
                    <div style={{ marginTop: "0.2rem", fontSize: "0.78rem", color: "var(--muted)" }}>{item.hint}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "1.2rem",
                  height: 58,
                  borderRadius: 14,
                  background: "#eef5fb",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.max(data.projectHours.length, 1)}, minmax(0, 1fr))`,
                  gap: 6,
                  padding: 8,
                  alignItems: "end",
                }}
              >
                {data.projectHours.length === 0 ? (
                  <div style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: "0.85rem", gridColumn: "1 / -1" }}>
                    {t("noProjectsYet")}
                  </div>
                ) : (
                  data.projectHours.map((row) => (
                    <div
                      key={row.projectId}
                      title={`${row.name}: ${row.actualHours}/${row.budgetedHours} h`}
                      style={{
                        height: `${Math.max(28, Math.min(row.percentUsed, 100))}%`,
                        borderRadius: 8,
                        background: row.isOverBudget ? "#334155" : "#cbdced",
                        minHeight: 20,
                      }}
                    />
                  ))
                )}
              </div>
            </Surface>

            <Surface eyebrow={t("criticalMilestones")} title={t("weekSchedule")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {nextTasks.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t("noTasksThisWeek")}</div>
                ) : (
                  nextTasks.map((task) => {
                    const tone = statusTone(task.taskStatus);
                    return (
                      <div
                        key={task.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "32px minmax(0, 1fr)",
                          gap: "0.8rem",
                          alignItems: "start",
                          padding: "0.8rem",
                          borderRadius: 14,
                          border: "1px solid #e2e8f0",
                          background: "#fafafa",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            display: "grid",
                            placeItems: "center",
                            background: tone.bg,
                            color: tone.fg,
                            fontSize: "0.8rem",
                            fontWeight: 800,
                          }}
                        >
                          {new Date(task.startsAt).toLocaleDateString(intlLocale, { day: "2-digit" })}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.92rem" }}>{task.title}</div>
                          <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 2 }}>
                            {task.location || t("siteWide")} · {formatDate(task.startsAt, intlLocale)}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.45rem" }}>
                            {task.taskStatus ? (
                              <span style={{ padding: "0.22rem 0.45rem", borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: "0.74rem", fontWeight: 700 }}>
                                {task.taskStatus.replaceAll("_", " ")}
                              </span>
                            ) : null}
                            {task.priority ? (
                              <span
                                style={{
                                  padding: "0.22rem 0.45rem",
                                  borderRadius: 999,
                                  background: priorityTone(task.priority).bg,
                                  color: priorityTone(task.priority).fg,
                                  fontSize: "0.74rem",
                                  fontWeight: 700,
                                }}
                              >
                                {task.priority}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <Link href="/planning" style={{ color: "#0f172a", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>
                  {t("viewFullSchedule")} →
                </Link>
              </div>
            </Surface>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.45fr) minmax(250px, 0.8fr) minmax(250px, 0.9fr)",
              gap: isMobile ? "1rem" : "1rem",
              alignItems: "start",
            }}
          >
            <Surface eyebrow={t("laborAnalytics")} title={t("hoursVsBudget")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                {data.projectHours.map((row) => {
                  const width = Math.min(row.percentUsed, 100);
                  return (
                    <div key={row.projectId}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", fontSize: "0.85rem", marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{row.name}</span>
                        <span style={{ color: row.isOverBudget ? "#c2410c" : "var(--muted)", whiteSpace: "nowrap" }}>
                          {row.actualHours} / {row.budgetedHours} h
                          {row.isOverBudget ? ` ${t("overBudgetShort")}` : ""}
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${width}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: row.isOverBudget ? "#f97316" : "#0f172a",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  <span>{t("legendOnTrack")}</span>
                  <span>{t("legendOverBudget")}</span>
                </div>
              </div>
            </Surface>

            <Surface eyebrow={t("recentInsights")} title={t("activityFeed")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {recentInsights.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t("noRecentActivity")}</div>
                ) : (
                  recentInsights.map((item) => (
                    <div key={item.id} style={{ paddingBottom: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{item.title}</div>
                      {item.body ? <div style={{ marginTop: 4, color: "var(--muted)", fontSize: "0.8rem" }}>{item.body}</div> : null}
                      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: "0.75rem" }}>{formatDateTime(item.createdAt, intlLocale)}</div>
                    </div>
                  ))
                )}
              </div>
            </Surface>

            <Surface eyebrow={t("keySignals")} title={t("actionPanel")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {t("reportsWaiting")}
                  </div>
                  <div style={{ marginTop: 6, fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>
                    {data.metrics.pendingReportsActionRequired}
                  </div>
                  <div style={{ marginTop: 4, color: "var(--muted)", fontSize: "0.8rem" }}>{t("reportsWaitingHint")}</div>
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {t("budgetRisk")}
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700, color: "#0f172a", fontSize: "0.96rem" }}>
                    {overBudgetRows[0]?.name || t("allProjectsHealthy")}
                  </div>
                  <div style={{ marginTop: 4, color: "var(--muted)", fontSize: "0.8rem" }}>
                    {overBudgetRows[0]
                      ? t("budgetRiskHint", { count: overBudgetRows.length })
                      : t("budgetHealthyHint")}
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {t("nextDelivery")}
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700, color: "#0f172a", fontSize: "0.96rem" }}>
                    {nextTasks[0]?.title || t("noTasksPlanned")}
                  </div>
                  <div style={{ marginTop: 4, color: "var(--muted)", fontSize: "0.8rem" }}>
                    {nextTasks[0] ? formatDateTime(nextTasks[0].startsAt, intlLocale) : t("planningBoardHint")}
                  </div>
                </div>
              </div>
            </Surface>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
