"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { createProject, LOGO_INPUT_ACCEPT, uploadProjectLogo } from "@/lib/api/projects";
import type { ProjectStatus } from "@/lib/api/projects";
import {
  getStatusOptions,
  hintStyle,
  inputStyle,
  labelStyle,
  sectionHeading,
  sectionStyle,
  sectionTitle,
  slugifyName,
} from "@/lib/projectFormShared";
import { useIsMobile } from "@/lib/useMediaQuery";

export default function NewProjectPage() {
  const router = useRouter();
  const t = useTranslations("ProjectForm");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Common");
  const tProjects = useTranslations("Projects");
  const isMobile = useIsMobile(640);
  const statusOptions = useMemo(() => getStatusOptions(tStatus), [tStatus]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [budgetedHours, setBudgetedHours] = useState<string>("");
  const [completionPercent, setCompletionPercent] = useState<string>("0");
  const [portfolioLeadName, setPortfolioLeadName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    void meRequest().then((me) => {
      if (!cancelled) setUser(me?.user ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onNameChange = useCallback(
    (v: string) => {
      setName(v);
      if (!slugManual) setSlug(slugifyName(v));
    },
    [slugManual],
  );

  const onSlugChange = useCallback((v: string) => {
    setSlugManual(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const hours = Number(budgetedHours);
    if (!Number.isFinite(hours) || hours < 0) {
      setError(t("invalidHours"));
      return;
    }
    const completion = Number(completionPercent);
    if (!Number.isFinite(completion) || completion < 0 || completion > 100) {
      setError(t("invalidCompletion"));
      return;
    }
    if (!slug.trim()) {
      setError(t("slugRequired"));
      return;
    }

    setLoading(true);
    try {
      const result = await createProject({
        name: name.trim(),
        slug: slug.trim(),
        status,
        budgetedHours: hours,
        description: description.trim() || null,
        location: location.trim() || null,
        completionPercent: completion,
        portfolioLeadName: portfolioLeadName.trim() || null,
      });
      if (!result.ok) {
        if (result.status === 409) {
          const msg =
            result.body && typeof result.body === "object" && "message" in result.body
              ? String((result.body as { message?: string }).message)
              : null;
          setError(msg || t("slugInUse"));
        } else if (result.status === 400 && result.body?.error === "VALIDATION_ERROR") {
          setError(t("validationError"));
        } else {
          setError(t("createFailed"));
        }
        return;
      }
      if (logoFile) {
        const up = await uploadProjectLogo(result.project.id, logoFile);
        if (!up.ok) {
          setError(
            up.status === 413
              ? t("logoAfterCreateLarge")
              : up.status === 400
                ? t("logoAfterCreateType")
                : t("logoAfterCreateFail"),
          );
          return;
        }
      }
      try {
        sessionStorage.setItem("bric_project_created", result.project.name);
      } catch {
        /* ignore */
      }
      router.replace("/projects");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell user={user}>
      <nav style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
        <Link href="/projects" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          {tProjects("breadcrumbsProjects")}
        </Link>
        <span style={{ margin: "0 0.5rem", color: "var(--border)" }}>/</span>
        <span>{t("newTitle")}</span>
      </nav>

      <div style={{ maxWidth: 880 }}>
        <header style={{ marginBottom: "1.75rem" }}>
          <div style={sectionTitle}>{t("newEyebrow")}</div>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            {t("newTitle")}
          </h1>
          <p style={{ margin: "0.65rem 0 0", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.55, maxWidth: 640 }}>
            {t("newSubtitle")}
          </p>
        </header>

        <form onSubmit={(e) => void onSubmit(e)}>
          <div style={sectionStyle}>
            <div style={sectionTitle}>{t("overview")}</div>
            <h2 style={sectionHeading}>{t("identityNarrative")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
              <label style={labelStyle}>
                {t("projectName")} <span style={{ color: "#b91c1c" }}>*</span>
                <span style={hintStyle}>{t("projectNameHint")}</span>
                <input
                  required
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  maxLength={200}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                {t("urlSlug")} <span style={{ color: "#b91c1c" }}>*</span>
                <span style={hintStyle}>{t("slugHint")}</span>
                <input
                  required
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  maxLength={120}
                  pattern="[a-z0-9-]+"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                {t("description")}
                <span style={hintStyle}>{t("descriptionHint")}</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={8000}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.5 }}
                />
              </label>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitle}>{t("branding")}</div>
            <h2 style={sectionHeading}>{t("logoCoverOptional")}</h2>
            <label style={labelStyle}>
              {t("logoFile")}
              <span style={hintStyle}>{t("logoHint")}</span>
              <input
                type="file"
                accept={LOGO_INPUT_ACCEPT}
                disabled={loading}
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: "0.9rem" }}
              />
              {logoFile ? (
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{logoFile.name}</span>
              ) : null}
            </label>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitle}>{t("siteLifecycle")}</div>
            <h2 style={sectionHeading}>{t("locationStatus")}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "1.15rem 1.5rem",
              }}
            >
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                {t("siteRegion")}
                <span style={hintStyle}>{t("siteRegionHint")}</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={500}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                {t("projectStatus")} <span style={{ color: "#b91c1c" }}>*</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} — {o.hint}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitle}>{t("planControls")}</div>
            <h2 style={sectionHeading}>{t("budgetHoursProgress")}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "1.15rem 1.5rem",
              }}
            >
              <label style={labelStyle}>
                {t("budgetedHours")} <span style={{ color: "#b91c1c" }}>*</span>
                <span style={hintStyle}>{t("budgetedHoursHint")}</span>
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  inputMode="decimal"
                  value={budgetedHours}
                  onChange={(e) => setBudgetedHours(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                {t("initialCompletion")}
                <span style={hintStyle}>{t("initialCompletionHint")}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={completionPercent}
                  onChange={(e) => setCompletionPercent(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitle}>{t("accountability")}</div>
            <h2 style={sectionHeading}>{t("primaryContact")}</h2>
            <label style={labelStyle}>
              {t("leadName")}
              <span style={hintStyle}>{t("leadHintCreate")}</span>
              <input
                value={portfolioLeadName}
                onChange={(e) => setPortfolioLeadName(e.target.value)}
                maxLength={200}
                style={inputStyle}
              />
            </label>
          </div>

          {error ? (
            <p
              style={{
                margin: "0 0 1rem",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.9rem",
              }}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingTop: "0.25rem",
            }}
          >
            <Link
              href="/projects"
              style={{
                padding: "0.65rem 1.15rem",
                borderRadius: 10,
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: "0.92rem",
                textDecoration: "none",
              }}
            >
              {tCommon("cancel")}
            </Link>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.65rem 1.35rem",
                borderRadius: 10,
                border: "none",
                background: "var(--text)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.92rem",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? t("creating") : t("createProject")}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
