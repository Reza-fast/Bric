"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import { createProject } from "@/lib/api/projects";
import type { ProjectStatus } from "@/lib/api/projects";
import {
  hintStyle,
  inputStyle,
  labelStyle,
  sectionHeading,
  sectionStyle,
  sectionTitle,
  slugifyName,
  statusOptions,
} from "../projectFormShared";

export default function NewProjectPage() {
  const router = useRouter();
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
      setError("Enter a valid budgeted hours total (0 or greater).");
      return;
    }
    const completion = Number(completionPercent);
    if (!Number.isFinite(completion) || completion < 0 || completion > 100) {
      setError("Completion must be between 0 and 100.");
      return;
    }
    if (!slug.trim()) {
      setError("URL slug is required.");
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
          setError(msg || "That URL slug is already in use.");
        } else if (result.status === 400 && result.body?.error === "VALIDATION_ERROR") {
          setError("Please check the form fields and try again.");
        } else {
          setError("Could not create the project. Try again.");
        }
        return;
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
          Projects
        </Link>
        <span style={{ margin: "0 0.5rem", color: "var(--border)" }}>/</span>
        <span>New project</span>
      </nav>

      <div style={{ maxWidth: 880 }}>
        <header style={{ marginBottom: "1.75rem" }}>
          <div style={sectionTitle}>PROJECT SETUP</div>
          <h1 style={{ margin: "0.25rem 0 0", fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            Create a new project
          </h1>
          <p style={{ margin: "0.65rem 0 0", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.55, maxWidth: 640 }}>
            Register a construction asset in BRIC: define scope, budget hours, site context, and ownership so teams and
            reporting stay aligned from day one.
          </p>
        </header>

        <form onSubmit={(e) => void onSubmit(e)}>
          <div style={sectionStyle}>
            <div style={sectionTitle}>OVERVIEW</div>
            <h2 style={sectionHeading}>Identity & narrative</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
              <label style={labelStyle}>
                Project name <span style={{ color: "#b91c1c" }}>*</span>
                <span style={hintStyle}>Official name as it should appear across dashboards and exports.</span>
                <input
                  required
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="e.g. Meridian Transit Hub"
                  maxLength={200}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                URL slug <span style={{ color: "#b91c1c" }}>*</span>
                <span style={hintStyle}>
                  Unique identifier in URLs and APIs. Lowercase letters, numbers, and hyphens only. Generated from the
                  name unless you edit it.
                </span>
                <input
                  required
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="meridian-transit-hub"
                  maxLength={120}
                  pattern="[a-z0-9-]+"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Description
                <span style={hintStyle}>Scope summary, stakeholders, or delivery notes (optional).</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief narrative for people joining the project…"
                  rows={4}
                  maxLength={8000}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 100, lineHeight: 1.5 }}
                />
              </label>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitle}>SITE & LIFECYCLE</div>
            <h2 style={sectionHeading}>Location and status</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "1.15rem 1.5rem",
              }}
            >
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Site / region
                <span style={hintStyle}>Address, district, or site label shown on registry cards.</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. District 4, Metropolitan Area"
                  maxLength={500}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
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

          <div style={sectionStyle}>
            <div style={sectionTitle}>PLAN & CONTROLS</div>
            <h2 style={sectionHeading}>Budget hours and progress baseline</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "1.15rem 1.5rem",
              }}
            >
              <label style={labelStyle}>
                Budgeted hours <span style={{ color: "#b91c1c" }}>*</span>
                <span style={hintStyle}>Total planned labor hours for time tracking and burn‑rate views.</span>
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  inputMode="decimal"
                  value={budgetedHours}
                  onChange={(e) => setBudgetedHours(e.target.value)}
                  placeholder="e.g. 5200"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Initial completion %
                <span style={hintStyle}>0–100. Optional baseline for portfolio completion bars (defaults to 0).</span>
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
            <div style={sectionTitle}>ACCOUNTABILITY</div>
            <h2 style={sectionHeading}>Primary contact on record</h2>
            <label style={labelStyle}>
              Lead / architect display name
              <span style={hintStyle}>
                Shown as “Primary architect” on project cards. Does not grant permissions by itself.
              </span>
              <input
                value={portfolioLeadName}
                onChange={(e) => setPortfolioLeadName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
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
              Cancel
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
              {loading ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
