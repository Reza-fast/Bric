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

function budgetDotColor(card: ProjectPortfolioCard): string {
  if (card.status === "completed") return "#71717a";
  if (card.status === "planning") return "#a1a1aa";
  if (card.status === "critical" || card.isOverBudget) return "#dc2626";
  return "#22c55e";
}

function filterProjects(list: ProjectPortfolioCard[], tab: FilterTab): ProjectPortfolioCard[] {
  if (tab === "all") return list;
  if (tab === "active") return list.filter((p) => p.status === "active" || p.status === "critical");
  if (tab === "planning") return list.filter((p) => p.status === "planning");
  if (tab === "completed") return list.filter((p) => p.status === "completed");
  return list;
}

function ProjectCard({
  card,
  completionLabel,
  budgetStatusLabel,
  architectLabel,
  statusLabel,
  budgetLabel,
  emDash,
}: {
  card: ProjectPortfolioCard;
  completionLabel: string;
  budgetStatusLabel: string;
  architectLabel: string;
  statusLabel: string;
  budgetLabel: string;
  emDash: string;
}) {
  const pill = statusPillStyle(card.status);
  const pct = Math.min(100, Math.max(0, Math.round(card.completionPercent)));

  return (
    <article
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--border)",
        padding: "1.25rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.1rem",
        minHeight: 260,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        height: "100%",
        cursor: "pointer",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", gap: "0.9rem", alignItems: "flex-start", minWidth: 0 }}>
        <ProjectLogoThumb
          projectId={card.id}
          name={card.name}
          logoStorageKey={card.logoStorageKey}
          updatedAt={card.updatedAt}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                overflowWrap: "anywhere",
              }}
            >
              {card.name}
            </h2>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.07em",
                padding: "0.35rem 0.55rem",
                borderRadius: 8,
                background: pill.bg,
                color: pill.color,
                flexShrink: 0,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.45 }}>
            {card.location ?? emDash}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
            fontSize: "0.78rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "var(--muted)",
          }}
        >
          <span>{completionLabel}</span>
          <span style={{ color: "var(--text)", fontSize: "0.95rem", fontWeight: 700 }}>{pct}%</span>
        </div>
        <div
          style={{
            height: 14,
            borderRadius: 999,
            background: "#e4e4e7",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, #2563eb, #3b82f6)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          paddingTop: "0.35rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", color: "var(--muted)" }}>
            {budgetStatusLabel}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: budgetDotColor(card) }} />
            {budgetLabel}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", color: "var(--muted)" }}>
            {architectLabel}
          </div>
          <div style={{ marginTop: 10, fontSize: "1rem", fontWeight: 600 }}>{card.portfolioLeadName ?? emDash}</div>
        </div>
      </div>
    </article>
  );
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
          style={{
            display: "inline-block",
            padding: "0.65rem 1.1rem",
            borderRadius: 10,
            border: "none",
            background: "var(--text)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            textDecoration: "none",
            width: isMobile ? "100%" : undefined,
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          {t("newProject")}
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1.25rem",
        }}
      >
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: 999,
              border: tab === tabItem.id ? "1px solid var(--text)" : "1px solid var(--border)",
              background: tab === tabItem.id ? "var(--text)" : "var(--surface)",
              color: tab === tabItem.id ? "#fff" : "var(--text)",
              fontSize: "0.82rem",
              fontWeight: tab === tabItem.id ? 600 : 500,
              cursor: "pointer",
            }}
          >
            {tabItem.label}
          </button>
        ))}
        <span style={{ marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : undefined, fontSize: "0.8rem", color: "var(--muted)" }}>
          {data === undefined
            ? tCommon("emDash")
            : t("filterCount", { count: filtered.length, pageSize: PAGE_SIZE })}
        </span>
      </div>

      {data === undefined ? (
        <p style={{ color: "var(--muted)" }}>{t("loading")}</p>
      ) : !data ? (
        <p style={{ color: "var(--muted)" }}>{t("loadError")}</p>
      ) : data.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>{t("empty")}</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
              gap: isMobile ? "1rem" : "1.5rem",
            }}
          >
            {pageSlice.map((card) => (
              <Link
                key={card.id}
                href={`/projects/${card.id}`}
                aria-label={t("viewProject", { name: card.name })}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  borderRadius: 18,
                  minWidth: 0,
                }}
              >
                <ProjectCard
                  card={card}
                  completionLabel={t("completion")}
                  budgetStatusLabel={t("budgetStatus")}
                  architectLabel={t("primaryArchitect")}
                  statusLabel={tStatus(card.status).toUpperCase()}
                  budgetLabel={cardBudgetLabel(card)}
                  emDash={tCommon("emDash")}
                />
              </Link>
            ))}
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
    </DashboardShell>
  );
}
