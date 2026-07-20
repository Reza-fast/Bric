"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { IconDownload } from "@/components/ui/ActionIcons";
import "@/components/hours/hours.css";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { isHr } from "@/lib/api/roles";
import { fetchTimeLogs, type TimeLogRow } from "@/lib/api/timeLogs";

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

type ProjectBreakdown = { projectId: string; name: string; hours: number };
type MonthBreakdown = { key: string; label: string; hours: number };
type PersonRow = {
  userId: string;
  name: string;
  email: string;
  totalHours: number;
  projects: ProjectBreakdown[];
  months: MonthBreakdown[];
};

function buildRoster(
  logs: TimeLogRow[],
  projects: ProjectPortfolioCard[],
  intlLocale: string,
  fallbackProject: string,
): PersonRow[] {
  const map = new Map<
    string,
    {
      userId: string;
      name: string;
      email: string;
      clockHours: number;
      projects: Map<string, ProjectBreakdown>;
      months: Map<string, number>;
    }
  >();

  for (const log of logs) {
    const key = log.userId;
    const existing = map.get(key) ?? {
      userId: key,
      name: log.ownerDisplayName ?? fallbackProject,
      email: log.ownerEmail ?? "",
      clockHours: 0,
      projects: new Map(),
      months: new Map(),
    };
    if (log.ownerDisplayName) existing.name = log.ownerDisplayName;
    if (log.ownerEmail) existing.email = log.ownerEmail;

    const logged = new Date(log.loggedAt);
    if (!Number.isNaN(logged.getTime())) {
      const monthKey = `${logged.getFullYear()}-${String(logged.getMonth() + 1).padStart(2, "0")}`;
      existing.months.set(monthKey, (existing.months.get(monthKey) ?? 0) + log.durationHours);
    }

    if (log.projectId === null) {
      existing.clockHours += log.durationHours;
    } else {
      const proj = existing.projects.get(log.projectId) ?? {
        projectId: log.projectId,
        name: log.projectName ?? projects.find((p) => p.id === log.projectId)?.name ?? fallbackProject,
        hours: 0,
      };
      proj.hours += log.durationHours;
      if (log.projectName) proj.name = log.projectName;
      existing.projects.set(log.projectId, proj);
    }
    map.set(key, existing);
  }

  return [...map.values()]
    .map((row): PersonRow => {
      const projectList = [...row.projects.values()].sort((a, b) => b.hours - a.hours);
      const projectHours = projectList.reduce((s, p) => s + p.hours, 0);
      const monthList = [...row.months.entries()]
        .map(([key, hours]) => {
          const [y, m] = key.split("-").map(Number);
          const label = new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(intlLocale, {
            month: "long",
            year: "numeric",
          });
          return { key, label, hours };
        })
        .sort((a, b) => b.key.localeCompare(a.key));
      return {
        userId: row.userId,
        name: row.name,
        email: row.email,
        totalHours: row.clockHours + projectHours,
        projects: projectList,
        months: monthList,
      };
    })
    .filter((row) => row.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);
}

function rosterToCsv(rows: PersonRow[]): string {
  const header = ["name", "email", "totalHours", "project", "projectHours", "month", "monthHours"];
  const lines = [header.join(",")];
  for (const person of rows) {
    const name = `"${person.name.replaceAll('"', '""')}"`;
    const email = `"${person.email.replaceAll('"', '""')}"`;
    if (person.projects.length === 0 && person.months.length === 0) {
      lines.push([name, email, String(person.totalHours), "", "", "", ""].join(","));
      continue;
    }
    const max = Math.max(person.projects.length, person.months.length, 1);
    for (let i = 0; i < max; i++) {
      const proj = person.projects[i];
      const month = person.months[i];
      lines.push(
        [
          name,
          email,
          i === 0 ? String(person.totalHours) : "",
          proj ? `"${proj.name.replaceAll('"', '""')}"` : "",
          proj ? String(proj.hours) : "",
          month ? `"${month.label.replaceAll('"', '""')}"` : "",
          month ? String(month.hours) : "",
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

export default function HoursOverviewPage() {
  const t = useTranslations("Hours");
  const tTime = useTranslations("Time");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<ProjectPortfolioCard[]>([]);
  const [logs, setLogs] = useState<TimeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await meRequest();
      if (cancelled) return;
      const u = me?.user ?? null;
      setUser(u);
      if (!u || !isHr(u.role)) {
        router.replace("/dashboard");
        return;
      }

      const to = addDays(new Date(), 1);
      const from = addDays(new Date(), -180);
      const [pf, list] = await Promise.all([fetchProjectPortfolio(), fetchTimeLogs(from, to)]);
      if (cancelled) return;
      setProjects(pf ?? []);
      if (list === null) {
        setError(t("loadError"));
        setLogs([]);
      } else {
        setLogs(list);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const roster = useMemo(
    () => buildRoster(logs, projects, intlLocale, tTime("projectFallback")),
    [intlLocale, logs, projects, tTime],
  );

  const onExport = useCallback(() => {
    const csv = rosterToCsv(roster);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `urenoverzicht-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [roster]);

  return (
    <DashboardShell user={user} fullBleed>
      <div className="hours-page">
        <div className="hours-page-inner">
          <header className="hours-header">
            <div>
              <h1 className="hours-title">{t("title")}</h1>
              <p className="hours-sub">{t("subtitle")}</p>
            </div>
            <button type="button" className="app-btn app-btn-outline app-btn-sm hours-export" onClick={onExport} disabled={roster.length === 0}>
              <IconDownload size={16} />
              {t("exportLedger")}
            </button>
          </header>

          {loading ? (
            <p className="hours-empty">{t("loading")}</p>
          ) : error ? (
            <p className="hours-empty" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          ) : roster.length === 0 ? (
            <p className="hours-empty">{t("empty")}</p>
          ) : (
            <ul className="hours-roster">
              {roster.map((person) => (
                <li key={person.userId} className="hours-card">
                  <div className="hours-card-head">
                    <div className="hours-person">
                      <div className="hours-avatar" aria-hidden>
                        {initials(person.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="hours-person-name">{person.name}</div>
                        {person.email ? <div className="hours-person-email">{person.email}</div> : null}
                      </div>
                    </div>
                    <div className="hours-total">
                      <span className="hours-total-value">{person.totalHours.toFixed(1)}h</span>
                      <span className="hours-total-label">{t("totalLogged")}</span>
                    </div>
                  </div>

                  {(person.projects.length > 0 || person.months.length > 0) ? (
                    <div className="hours-breakdown-grid">
                      {person.projects.length > 0 ? (
                        <div className="hours-breakdown">
                          <div className="hours-breakdown-title">{t("byProject")}</div>
                          {person.projects.map((proj) => (
                            <div key={proj.projectId} className="hours-breakdown-row">
                              <span className="hours-breakdown-name">{proj.name}</span>
                              <span className="hours-breakdown-hours">{proj.hours.toFixed(1)}h</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="hours-breakdown">
                          <div className="hours-breakdown-title">{t("byProject")}</div>
                          <div className="hours-breakdown-row" style={{ color: "var(--muted)" }}>
                            {t("noProjects")}
                          </div>
                        </div>
                      )}
                      {person.months.length > 0 ? (
                        <div className="hours-breakdown">
                          <div className="hours-breakdown-title">{t("byMonth")}</div>
                          {person.months.map((month) => (
                            <div key={month.key} className="hours-breakdown-row">
                              <span className="hours-breakdown-name">{month.label}</span>
                              <span className="hours-breakdown-hours">{month.hours.toFixed(1)}h</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
