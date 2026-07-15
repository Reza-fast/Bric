"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { TechnicalPlansSection } from "@/components/projects/TechnicalPlansSection";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { useIsMobile } from "@/lib/useMediaQuery";

function DocumentsPageContent() {
  const t = useTranslations("Documents");
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectFromUrl = searchParams.get("project");
  const isMobile = useIsMobile(768);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [portfolio, setPortfolio] = useState<ProjectPortfolioCard[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void meRequest().then((m) => setUser(m?.user ?? null));
  }, []);

  useEffect(() => {
    void fetchProjectPortfolio().then((list) => {
      setPortfolio(list ?? []);
      setLoading(false);
    });
  }, []);

  const selectedProjectId = useMemo(() => {
    if (!projectFromUrl) return undefined;
    if (!portfolio?.some((p) => p.id === projectFromUrl)) return undefined;
    return projectFromUrl;
  }, [projectFromUrl, portfolio]);

  function selectProject(id: string | null) {
    if (!id) router.push("/documents");
    else router.push(`/documents?project=${encodeURIComponent(id)}`);
  }

  const pagePad = isMobile ? "0.85rem" : "clamp(1rem, 3vw, 2rem)";

  const filterNav = (
    <>
      <button
        type="button"
        onClick={() => selectProject(null)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "0.55rem 0.75rem",
          marginBottom: 4,
          borderRadius: 8,
          border: "none",
          background: !selectedProjectId ? "#eff6ff" : "transparent",
          color: !selectedProjectId ? "#1d4ed8" : "#334155",
          fontWeight: !selectedProjectId ? 700 : 500,
          fontSize: "0.88rem",
          cursor: "pointer",
        }}
      >
        {t("allProjects")}
      </button>
      {loading ? (
        <p style={{ padding: "0.5rem 0.75rem", margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>{t("loading")}</p>
      ) : portfolio && portfolio.length === 0 ? (
        <p style={{ padding: "0.5rem 0.75rem", margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>{t("noProjects")}</p>
      ) : (
        portfolio?.map((p) => {
          const active = selectedProjectId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProject(p.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.55rem 0.75rem",
                marginBottom: 4,
                borderRadius: 8,
                border: "none",
                background: active ? "#eff6ff" : "transparent",
                color: active ? "#1d4ed8" : "#334155",
                fontWeight: active ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={p.name}
            >
              {p.name}
            </button>
          );
        })
      )}
    </>
  );

  return (
    <DashboardShell user={user} fullBleed>
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          minHeight: "100%",
          width: "100%",
        }}
      >
        {isMobile ? (
          <div
            style={{
              borderBottom: "1px solid #e2e8f0",
              background: "#fafbfc",
              padding: "0.85rem 0.85rem 1rem",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.1em", color: "#64748b" }}>
              {t("filterByProject")}
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) => selectProject(e.target.value || null)}
                style={{
                  padding: "0.55rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#0f172a",
                  background: "#fff",
                  width: "100%",
                }}
              >
                <option value="">{t("allProjects")}</option>
                {(portfolio ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <aside
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: "1px solid #e2e8f0",
              background: "#fafbfc",
              padding: "1.25rem 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "0 1rem 0.85rem", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.1em", color: "#64748b" }}>
                {t("filterByProject")}
              </div>
            </div>
            <nav style={{ flex: 1, overflow: "auto", padding: "0.65rem 0.5rem" }}>{filterNav}</nav>
          </aside>
        )}

        <div style={{ flex: 1, minWidth: 0, padding: `1.15rem ${pagePad} 2rem` }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", color: "#64748b" }}>
              {t("eyebrow")}
            </div>
            <h1 style={{ margin: "0.35rem 0 0", fontSize: isMobile ? "1.4rem" : "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {t("title")}
            </h1>
            <p style={{ margin: "0.45rem 0 0", color: "#64748b", fontSize: "0.9rem", maxWidth: 640, lineHeight: 1.5 }}>
              {isMobile ? t("subtitleMobile") : t("subtitleSidebar")}
            </p>
            {selectedProjectId && portfolio ? (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#475569" }}>
                {t("showingFor")}{" "}
                <Link href={`/projects/${selectedProjectId}`} style={{ color: "#2563eb", fontWeight: 700 }}>
                  {portfolio.find((p) => p.id === selectedProjectId)?.name ?? selectedProjectId}
                </Link>
              </p>
            ) : null}
          </div>

          <TechnicalPlansSection
            projectId={selectedProjectId}
            projects={portfolio ?? []}
            showProjectColumn={!selectedProjectId}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

export default function DocumentsPage() {
  const t = useTranslations("Documents");
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#64748b" }}>{t("loadingPage")}</div>}>
      <DocumentsPageContent />
    </Suspense>
  );
}
