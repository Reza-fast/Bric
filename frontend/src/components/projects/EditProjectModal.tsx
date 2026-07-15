"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail, ProjectStatus } from "@/lib/api/projects";
import {
  deleteProjectLogo,
  LOGO_INPUT_ACCEPT,
  projectHasLogo,
  projectLogoUrl,
  updateProject,
  uploadProjectLogo,
} from "@/lib/api/projects";
import { ProjectLogoThumb } from "@/components/projects/ProjectLogoThumb";
import {
  computeLaborBudget,
  formatLaborBudget,
  hintStyle,
  inputStyle,
  labelStyle,
  sectionHeading,
  sectionStyle,
  sectionTitle,
  statusOptions,
} from "@/app/projects/projectFormShared";
import { useIsMobile } from "@/lib/useMediaQuery";

type Props = {
  open: boolean;
  projectId: string;
  project: ProjectDetail | null;
  onClose: () => void;
  onSaved: (project: ProjectDetail) => void;
};

const budgetMetricLabel: React.CSSProperties = {
  display: "block",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: "0.35rem",
};

const budgetMetricValue: React.CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 700,
  color: "var(--text)",
  lineHeight: 1.2,
};

export function EditProjectModal({ open, projectId, project, onClose, onSaved }: Props) {
  const isMobile = useIsMobile(640);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [budgetedHours, setBudgetedHours] = useState("");
  const [hourlyWage, setHourlyWage] = useState("");
  const [completionPercent, setCompletionPercent] = useState("0");
  const [portfolioLeadName, setPortfolioLeadName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const fieldGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
    gap: "1rem",
  };

  const budgetSummaryStyle: React.CSSProperties = {
    marginTop: "1rem",
    padding: isMobile ? "0.85rem 0.95rem" : "1rem 1.1rem",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg, #f8fafc)",
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
    gap: isMobile ? "0.85rem" : "0.75rem 1rem",
    alignItems: "end",
  };

  useEffect(() => {
    if (!open || !project) return;
    setSlug(project.slug);
    setName(project.name);
    setDescription(project.description ?? "");
    setLocation(project.location ?? "");
    setStatus(project.status);
    setBudgetedHours(String(project.budgetedHours));
    setHourlyWage(project.hourlyWage != null ? String(project.hourlyWage) : "");
    setCompletionPercent(String(project.completionPercent ?? 0));
    setPortfolioLeadName(project.portfolioLeadName ?? "");
    setError(null);
    setSaving(false);
    setLogoFile(null);
    setRemoveLogo(false);
  }, [open, project]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const parsedHours = Number(budgetedHours);
  const parsedWage = hourlyWage.trim() === "" ? null : Number(hourlyWage);
  const laborBudgetLabel = useMemo(() => {
    if (hourlyWage.trim() === "") return "—";
    if (!Number.isFinite(parsedWage) || parsedWage! < 0) return "—";
    if (!Number.isFinite(parsedHours) || parsedHours < 0) return "—";
    return formatLaborBudget(parsedHours, parsedWage) ?? "—";
  }, [hourlyWage, parsedHours, parsedWage]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const hours = Number(budgetedHours);
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Enter a valid total planned hours value (0 or greater).");
      return;
    }
    const wageRaw = hourlyWage.trim();
    let wage: number | null = null;
    if (wageRaw !== "") {
      wage = Number(wageRaw);
      if (!Number.isFinite(wage) || wage < 0) {
        setError("Enter a valid hourly wage (0 or greater), or leave it empty.");
        return;
      }
    }
    const completion = Number(completionPercent);
    if (!Number.isFinite(completion) || completion < 0 || completion > 100) {
      setError("Completion must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateProject(projectId, {
        name: name.trim(),
        status,
        budgetedHours: hours,
        hourlyWage: wage,
        description: description.trim() || null,
        location: location.trim() || null,
        completionPercent: completion,
        portfolioLeadName: portfolioLeadName.trim() || null,
      });
      if (!result.ok) {
        if (result.status === 400 && result.body?.error === "VALIDATION_ERROR") {
          setError("Please check the form fields and try again.");
        } else if (result.status === 404) {
          setError("This project was not found or you no longer have access.");
        } else {
          setError("Could not save changes. Try again.");
        }
        return;
      }

      let saved = result.project;

      if (logoFile) {
        const up = await uploadProjectLogo(projectId, logoFile);
        if (!up.ok) {
          setError(
            up.status === 413
              ? "Project saved, but the logo exceeds 10 MB."
              : up.status === 400
                ? "Project saved, but that image type is not allowed."
                : "Project saved, but the logo could not be uploaded.",
          );
          onSaved(saved);
          return;
        }
        saved = up.project;
      } else if (removeLogo && project && projectHasLogo(project)) {
        const del = await deleteProjectLogo(projectId);
        if (!del.ok) {
          setError("Project saved, but the logo could not be removed.");
          onSaved(saved);
          return;
        }
        saved = del.project;
      }

      onSaved(saved);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-project-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: isMobile ? "0.75rem" : "1.5rem",
        overflow: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={(e) => void onSubmit(e)}
        style={{
          width: "100%",
          maxWidth: 640,
          marginTop: isMobile ? "0.5rem" : "1.5rem",
          marginBottom: isMobile ? "1rem" : "2rem",
          borderRadius: isMobile ? 12 : 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: isMobile ? "1.1rem 1rem" : "1.35rem 1.5rem",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          maxHeight: isMobile ? "calc(100vh - 1.5rem)" : "calc(100vh - 3rem)",
          overflow: "auto",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ ...sectionTitle, marginBottom: "0.35rem" }}>PROJECT SETTINGS</div>
            <h2 id="edit-project-modal-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Edit project
            </h2>
            <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.45 }}>
              The URL slug stays fixed so existing links remain valid.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose()}
            style={{
              flexShrink: 0,
              padding: "0.35rem 0.65rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: saving ? "wait" : "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ ...sectionStyle, marginBottom: "1rem" }}>
          <div style={sectionTitle}>OVERVIEW</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Identity & narrative</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={labelStyle}>
              Project name <span style={{ color: "#b91c1c" }}>*</span>
              <span style={hintStyle}>Official name across dashboards and exports.</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              URL slug
              <span style={hintStyle}>Immutable identifier.</span>
              <input value={slug} readOnly style={{ ...inputStyle, opacity: 0.85, cursor: "default" }} />
            </label>
            <label style={labelStyle}>
              Description
              <span style={hintStyle}>Optional scope summary or notes.</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={8000}
                style={{ ...inputStyle, resize: "vertical", minHeight: 88, lineHeight: 1.5 }}
              />
            </label>
          </div>
        </div>

        <div style={{ ...sectionStyle, marginBottom: "1rem" }}>
          <div style={sectionTitle}>BRANDING</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Project logo / cover</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start" }}>
            {logoPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreviewUrl}
                alt=""
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 14,
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                  flexShrink: 0,
                }}
              />
            ) : removeLogo || !project || !projectHasLogo(project) ? (
              <ProjectLogoThumb projectId={projectId} name={name || "Project"} size={88} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={projectLogoUrl(projectId, project.updatedAt)}
                alt=""
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 14,
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={hintStyle}>PNG, JPEG, WebP, or other common image formats. Max 10 MB.</span>
              <input
                type="file"
                accept={LOGO_INPUT_ACCEPT}
                disabled={saving}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setLogoFile(f);
                  if (f) setRemoveLogo(false);
                  e.target.value = "";
                }}
                style={{ fontSize: "0.85rem" }}
              />
              {(project && projectHasLogo(project) && !removeLogo && !logoFile) || logoFile ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setLogoFile(null);
                    setRemoveLogo(true);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    padding: "0.35rem 0.65rem",
                    borderRadius: 8,
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#b91c1c",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    cursor: saving ? "wait" : "pointer",
                  }}
                >
                  Remove logo
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ ...sectionStyle, marginBottom: "1rem" }}>
          <div style={sectionTitle}>SITE & LIFECYCLE</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Location and status</h3>
          <div style={fieldGrid}>
            <label style={labelStyle}>
              Site / region
              <span style={hintStyle}>Address or site label.</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={500} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Project status <span style={{ color: "#b91c1c" }}>*</span>
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

        <div style={{ ...sectionStyle, marginBottom: "1rem" }}>
          <div style={sectionTitle}>LABOR BUDGET</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Planned hours, rate & total</h3>
          <div style={fieldGrid}>
            <label style={labelStyle}>
              Total planned hours <span style={{ color: "#b91c1c" }}>*</span>
              <span style={hintStyle}>All labor hours planned for this project.</span>
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
              Hourly wage
              <span style={hintStyle}>Blended labor rate (optional).</span>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 0.65rem",
                    borderRadius: "10px 0 0 10px",
                    border: "1px solid var(--border)",
                    borderRight: "none",
                    background: "var(--bg, #f8fafc)",
                    color: "var(--muted)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}
                >
                  €
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(e.target.value)}
                  style={{ ...inputStyle, borderRadius: "0 10px 10px 0", flex: 1 }}
                />
              </div>
            </label>
          </div>
          <div style={budgetSummaryStyle} aria-live="polite">
            <div>
              <span style={budgetMetricLabel}>Planned hours</span>
              <span style={budgetMetricValue}>
                {Number.isFinite(parsedHours) && parsedHours >= 0 ? `${parsedHours.toLocaleString()} h` : "—"}
              </span>
            </div>
            <div>
              <span style={budgetMetricLabel}>Hourly rate</span>
              <span style={budgetMetricValue}>
                {parsedWage != null && Number.isFinite(parsedWage) && parsedWage >= 0
                  ? new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(parsedWage)
                  : "—"}
              </span>
            </div>
            <div>
              <span style={budgetMetricLabel}>Total labor budget</span>
              <span style={{ ...budgetMetricValue, fontSize: "1.2rem", color: computeLaborBudget(parsedHours, parsedWage) != null ? "var(--text)" : "var(--muted)" }}>
                {laborBudgetLabel}
              </span>
            </div>
          </div>
          <div style={{ ...fieldGrid, marginTop: "1rem" }}>
            <label style={labelStyle}>
              Completion %
              <span style={hintStyle}>0–100 progress estimate.</span>
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
            <label style={labelStyle}>
              Lead / architect display name
              <span style={hintStyle}>Shown on project cards.</span>
              <input
                value={portfolioLeadName}
                onChange={(e) => setPortfolioLeadName(e.target.value)}
                maxLength={200}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {error ? (
          <p
            style={{
              margin: "0 0 1rem",
              padding: "0.65rem 0.85rem",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.88rem",
            }}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: isMobile ? "stretch" : "flex-end" }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose()}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: saving ? "wait" : "pointer",
              flex: isMobile ? "1 1 auto" : undefined,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.55rem 1.15rem",
              borderRadius: 10,
              border: "none",
              background: "var(--text)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: saving ? "wait" : "pointer",
              flex: isMobile ? "1 1 auto" : undefined,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
