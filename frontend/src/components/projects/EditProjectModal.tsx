"use client";

import { useEffect, useState } from "react";
import type { ProjectDetail, ProjectStatus } from "@/lib/api/projects";
import { updateProject } from "@/lib/api/projects";
import {
  hintStyle,
  inputStyle,
  labelStyle,
  sectionHeading,
  sectionStyle,
  sectionTitle,
  statusOptions,
} from "@/app/projects/projectFormShared";

type Props = {
  open: boolean;
  projectId: string;
  project: ProjectDetail | null;
  onClose: () => void;
  onSaved: (project: ProjectDetail) => void;
};

export function EditProjectModal({ open, projectId, project, onClose, onSaved }: Props) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [budgetedHours, setBudgetedHours] = useState("");
  const [completionPercent, setCompletionPercent] = useState("0");
  const [portfolioLeadName, setPortfolioLeadName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setSlug(project.slug);
    setName(project.name);
    setDescription(project.description ?? "");
    setLocation(project.location ?? "");
    setStatus(project.status);
    setBudgetedHours(String(project.budgetedHours));
    setCompletionPercent(String(project.completionPercent ?? 0));
    setPortfolioLeadName(project.portfolioLeadName ?? "");
    setError(null);
    setSaving(false);
  }, [open, project]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const hours = Number(budgetedHours);
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Enter a valid budgeted hours total (0 or greater).");
      return;
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
      onSaved(result.project);
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
        padding: "1.5rem",
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
          maxWidth: 560,
          marginTop: "1.5rem",
          marginBottom: "2rem",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "1.35rem 1.5rem",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          maxHeight: "calc(100vh - 3rem)",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
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
          <div style={sectionTitle}>SITE & LIFECYCLE</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Location and status</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
          <div style={sectionTitle}>PLAN & CONTROLS</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Budget hours and completion</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <label style={labelStyle}>
              Budgeted hours <span style={{ color: "#b91c1c" }}>*</span>
              <span style={hintStyle}>Total planned labor hours.</span>
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
              Completion %
              <span style={hintStyle}>0–100.</span>
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

        <div style={{ ...sectionStyle, marginBottom: "1rem" }}>
          <div style={sectionTitle}>ACCOUNTABILITY</div>
          <h3 style={{ ...sectionHeading, fontSize: "1rem" }}>Primary contact on record</h3>
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "flex-end" }}>
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
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
