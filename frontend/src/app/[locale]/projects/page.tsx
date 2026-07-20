"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import type { ProjectPortfolioCard, ProjectStatus } from "@/lib/api/projects";
import { fetchProjectPortfolio } from "@/lib/api/projects";
import { ProjectLogoThumb } from "@/components/projects/ProjectLogoThumb";
import { useIsMobile } from "@/lib/useMediaQuery";
import "@/components/projects/projects.css";

type FilterTab = "all" | "active" | "planning" | "completed";

const PAGE_SIZE = 6;

function statusPillStyle(status: ProjectStatus): { bg: string; color: string } {
  switch (status) {
    case "active":
      return { bg: "#dbeafe", color: "#1d4ed8" };
    case "critical":
      return { bg: "#ffedd5", color: "#c2410c" };
    case "planning":
      return { bg: "#e0f2fe", color: "#0369a1" };
    case "completed":
      return { bg: "#e4e4e7", color: "#3f3f46" };
    default:
      return { bg: "#f4f4f5", color: "#52525b" };
  }
}

function filterProjects(list: ProjectPortfolioCard[], tab: FilterTab): ProjectPortfolioCard[] {
  if (tab === "all") return list;
  if (tab === "active") return list.filter((p) => p.status === "active" || p.status === "critical");
  if (tab === "planning") return list.filter((p) => p.status === "planning");
  if (tab === "completed") return list.filter((p) => p.status === "completed");
  return list;
}

function leadInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export default function ProjectsPage() {
  const t = useTranslations("Projects");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const isMobile = useIsMobile(768);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<ProjectPortfolioCard[] | null | undefined>(undefined);
  const [tab, setTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(0);
  const [createdFlash, setCreatedFlash] = useState<string | null>(null);
  const [updatedFlash, setUpdatedFlash] = useState<string | null>(null);

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: t("tabAll") },
    { id: "active", label: t("tabActive") },
    { id: "planning", label: t("tabPlanning") },
    { id: "completed", label: t("tabCompleted") },
  ];

  useEffect(() => {
    try {
      const created = sessionStorage.getItem("bric_project_created");
      if (created) {
        setCreatedFlash(created);
        sessionStorage.removeItem("bric_project_created");
      }
      const updated = sessionStorage.getItem("bric_project_updated");
      if (updated) {
        setUpdatedFlash(updated);
        sessionStorage.removeItem("bric_project_updated");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [me, projects] = await Promise.all([meRequest(), fetchProjectPortfolio()]);
      if (cancelled) return;
      setUser(me?.user ?? null);
      setData(projects);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterProjects(data, tab);
  }, [data, tab]);

  useEffect(() => {
    setPage(0);
  }, [tab]);

  useEffect(() => {
    setPage((p) => {
      const tp = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      return Math.min(Math.max(0, p), tp - 1);
    });
  }, [filtered.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = filtered.length === 0 ? 0 : Math.min(filtered.length, safePage * PAGE_SIZE + pageSlice.length);

  function cardBudgetLabel(card: ProjectPortfolioCard): string {
    if (card.status === "completed") return t("finalized");
    if (card.status === "planning") return t("pending");
    if (card.status === "critical" || card.isOverBudget) return t("overBudget");
    return t("onTrack");
  }

  function budgetValue(card: ProjectPortfolioCard): string {
    const actual = card.actualHours;
    const budget = card.budgetedHours;
    if (budget <= 0 && actual <= 0) return tCommon("emDash");
    if (card.hourlyWage != null && card.hourlyWage > 0) {
      const money = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
        notation: "compact",
        maximumFractionDigits: 1,
      });
      return `${money.format(actual * card.hourlyWage)} / ${money.format(budget * card.hourlyWage)}`;
    }
    return `${actual.toLocaleString()} / ${budget.toLocaleString()} h`;
  }

  function renderProgress(card: ProjectPortfolioCard) {
    const pct = Math.min(100, Math.max(0, Math.round(card.completionPercent)));
    return (
      <>
        <div className="projects-progress-label">{tStatus(card.status)}</div>
        <div className="projects-progress-track">
          <div className="projects-progress-bar">
            <div className="projects-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: "0.74rem", color: "var(--muted)", fontWeight: 700 }}>{pct}%</span>
        </div>
      </>
    );
  }

  function renderBudget(card: ProjectPortfolioCard) {
    const pill = statusPillStyle(card.status);
    return (
      <>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.18rem 0.42rem",
            borderRadius: 999,
            background: pill.bg,
            color: pill.color,
            fontSize: "0.64rem",
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {cardBudgetLabel(card)}
        </span>
        <div className={`projects-budget-value${card.isOverBudget ? " over" : ""}`}>{budgetValue(card)}</div>
      </>
    );
  }

  function renderLead(card: ProjectPortfolioCard) {
    const name = card.portfolioLeadName ?? tCommon("emDash");
    return (
      <div className="projects-lead">
        <div className="projects-lead-avatar">{leadInitials(name)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text)", overflowWrap: "anywhere" }}>{name}</div>
          <div style={{ marginTop: 2, fontSize: "0.72rem", color: "var(--muted)" }}>{t("leadRole")}</div>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell user={user}>
      {createdFlash ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: "0.9rem",
          }}
          role="status"
        >
          {t("createdFlash", { name: createdFlash })}
        </div>
      ) : null}
      {updatedFlash ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 10,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "0.9rem",
          }}
          role="status"
        >
          {t("updatedFlash", { name: updatedFlash })}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>
            {t("eyebrow")}
          </div>
          <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {t("title")}
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", maxWidth: 520, fontSize: "0.9rem", lineHeight: 1.5 }}>
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="app-btn app-btn-primary"
          style={{
            whiteSpace: "nowrap",
            width: isMobile ? "100%" : undefined,
          }}
        >
          {t("newProject")}
        </Link>
      </div>

      <section className="projects-sheet">
        <div className="projects-toolbar">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`app-tab${tab === tabItem.id ? " app-tab-active" : ""}`}
            >
              {tabItem.label}
            </button>
          ))}
          <div className="projects-toolbar-meta">
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>
              {data === undefined ? tCommon("emDash") : t("showingProjects", { count: filtered.length })}
            </span>
          </div>
        </div>

        {data === undefined ? (
          <p style={{ color: "var(--muted)" }}>{t("loading")}</p>
        ) : !data ? (
          <p style={{ color: "var(--muted)" }}>{t("loadError")}</p>
        ) : data.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>{t("empty")}</p>
        ) : (
          <>
            <div className="projects-table-wrap">
              {isMobile ? (
                <div className="projects-mobile-list">
                  {pageSlice.map((card) => (
                    <Link
                      key={card.id}
                      href={`/projects/${card.id}`}
                      aria-label={t("viewProject", { name: card.name })}
                      className="projects-mobile-card"
                    >
                      <div className="projects-identity">
                        <ProjectLogoThumb
                          projectId={card.id}
                          name={card.name}
                          logoStorageKey={card.logoStorageKey}
                          updatedAt={card.updatedAt}
                          size={48}
                          borderRadius={12}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="projects-name">{card.name}</div>
                          <div className="projects-location">{card.location ?? tCommon("emDash")}</div>
                        </div>
                      </div>
                      <div className="projects-mobile-grid">
                        <div>
                          <div className="projects-mobile-field-label">{t("thProgress")}</div>
                          {renderProgress(card)}
                        </div>
                        <div>
                          <div className="projects-mobile-field-label">{t("thBudget")}</div>
                          {renderBudget(card)}
                        </div>
                        <div>
                          <div className="projects-mobile-field-label">{t("thLead")}</div>
                          {renderLead(card)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="projects-table-scroll">
                  <div className="projects-table">
                    <div className="projects-table-head">
                      <div>{t("thProject")}</div>
                      <div>{t("thProgress")}</div>
                      <div>{t("thBudget")}</div>
                      <div>{t("thLead")}</div>
                      <div aria-hidden>→</div>
                    </div>
                    {pageSlice.map((card) => (
                      <Link
                        key={card.id}
                        href={`/projects/${card.id}`}
                        aria-label={t("viewProject", { name: card.name })}
                        className="projects-table-row"
                      >
                        <div className="projects-identity">
                          <ProjectLogoThumb
                            projectId={card.id}
                            name={card.name}
                            logoStorageKey={card.logoStorageKey}
                            updatedAt={card.updatedAt}
                            size={48}
                            borderRadius={12}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div className="projects-name">{card.name}</div>
                            <div className="projects-location">{card.location ?? tCommon("emDash")}</div>
                          </div>
                        </div>
                        <div>{renderProgress(card)}</div>
                        <div>{renderBudget(card)}</div>
                        <div>{renderLead(card)}</div>
                        <div className="projects-action" aria-hidden>
                          →
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "1.75rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                fontSize: "0.88rem",
                color: "var(--muted)",
              }}
            >
              <span>
                {t("totalRegistered", { count: data.length })}
                {filtered.length > 0
                  ? t("showingRange", {
                      start: rangeStart,
                      end: rangeEnd,
                      total: filtered.length,
                      page: safePage + 1,
                      pages: totalPages,
                    })
                  : null}
              </span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: safePage <= 0 ? "var(--muted)" : "var(--text)",
                    cursor: safePage <= 0 ? "not-allowed" : "pointer",
                    fontSize: "0.88rem",
                    fontWeight: 500,
                  }}
                >
                  {tCommon("previous")}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: safePage >= totalPages - 1 ? "var(--muted)" : "var(--text)",
                    cursor: safePage >= totalPages - 1 ? "not-allowed" : "pointer",
                    fontSize: "0.88rem",
                    fontWeight: 500,
                  }}
                >
                  {tCommon("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </DashboardShell>
  );
}
