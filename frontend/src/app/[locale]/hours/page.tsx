"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { IconDownload } from "@/components/ui/ActionIcons";
import "@/components/hours/hours.css";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import {
  fetchPersonnelAnalysis,
  formatMonthKey,
  initialsFromName,
  personnelAnalysisToCsv,
  type PersonnelAnalysisPerson,
} from "@/lib/api/personnelAnalysis";
import { isHr } from "@/lib/api/roles";

export default function HoursOverviewPage() {
  const t = useTranslations("Hours");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [people, setPeople] = useState<PersonnelAnalysisPerson[]>([]);
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

      const payload = await fetchPersonnelAnalysis();
      if (cancelled) return;
      if (!payload) {
        setError(t("loadError"));
        setPeople([]);
      } else {
        setPeople(payload.people);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const onExport = useCallback(() => {
    const csv = personnelAnalysisToCsv(people);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personeelanalyse-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [people]);

  return (
    <DashboardShell user={user} fullBleed>
      <div className="hours-page">
        <div className="hours-page-inner">
          <header className="hours-header">
            <div>
              <h1 className="hours-title">{t("title")}</h1>
              <p className="hours-sub">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              className="app-btn app-btn-outline app-btn-sm hours-export"
              onClick={onExport}
              disabled={people.length === 0}
            >
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
          ) : people.length === 0 ? (
            <p className="hours-empty">{t("empty")}</p>
          ) : (
            <ul className="hours-roster">
              {people.map((person) => (
                <li key={person.userId} className="hours-card">
                  <div className="hours-card-head">
                    <div className="hours-person">
                      <div className="hours-avatar" aria-hidden>
                        {initialsFromName(person.name)}
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

                  {person.projects.length > 0 || person.months.length > 0 ? (
                    <div className="hours-breakdown-grid">
                      <div className="hours-breakdown">
                        <div className="hours-breakdown-title">{t("byProject")}</div>
                        {person.projects.length > 0 ? (
                          person.projects.map((proj) => (
                            <div key={proj.projectId} className="hours-breakdown-row">
                              <span className="hours-breakdown-name">{proj.name}</span>
                              <span className="hours-breakdown-hours">{proj.hours.toFixed(1)}h</span>
                            </div>
                          ))
                        ) : (
                          <div className="hours-breakdown-row" style={{ color: "var(--muted)" }}>
                            {t("noProjects")}
                          </div>
                        )}
                      </div>
                      {person.months.length > 0 ? (
                        <div className="hours-breakdown">
                          <div className="hours-breakdown-title">{t("byMonth")}</div>
                          {person.months.map((month) => (
                            <div key={month.monthKey} className="hours-breakdown-row">
                              <span className="hours-breakdown-name">
                                {formatMonthKey(month.monthKey, intlLocale)}
                              </span>
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
