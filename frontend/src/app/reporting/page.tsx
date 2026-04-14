"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import {
  createDigitalReport,
  fetchProjectReports,
  replaceReportAttachment,
  type ProjectReport,
  type ReportStatus,
  reportFileUrl,
  updateReport,
  uploadReportFile,
} from "@/lib/api/reports";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";

const FILE_INPUT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif,.txt,.csv,.zip,.rar,.7z,.dwg,.dxf";

function statusStyle(s: ReportStatus): { bg: string; fg: string; label: string } {
  switch (s) {
    case "action_required":
      return { bg: "#fef2f2", fg: "#b91c1c", label: "Action required" };
    case "approved":
      return { bg: "#ecfdf5", fg: "#047857", label: "Approved" };
    case "in_review":
    default:
      return { bg: "#eff6ff", fg: "#1d4ed8", label: "In review" };
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ReportingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("project");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [portfolio, setPortfolio] = useState<ProjectPortfolioCard[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(projectIdFromUrl);
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titleDigital, setTitleDigital] = useState("");
  const [bodyDigital, setBodyDigital] = useState("");
  const [statusDigital, setStatusDigital] = useState<ReportStatus>("in_review");
  const [dueDigital, setDueDigital] = useState("");
  const [savingDigital, setSavingDigital] = useState(false);
  const [digitalMsg, setDigitalMsg] = useState<string | null>(null);

  const [titleFile, setTitleFile] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [fileMsg, setFileMsg] = useState<string | null>(null);

  const [editing, setEditing] = useState<ProjectReport | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editStatus, setEditStatus] = useState<ReportStatus>("in_review");
  const [editDue, setEditDue] = useState("");
  const [editNewFile, setEditNewFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const assetFileInputRef = useRef<HTMLInputElement>(null);
  const [assetDragActive, setAssetDragActive] = useState(false);

  useEffect(() => {
    void meRequest().then((m) => setUser(m?.user ?? null));
  }, []);

  useEffect(() => {
    void fetchProjectPortfolio().then((list) => {
      setPortfolio(list ?? []);
    });
  }, []);

  useEffect(() => {
    setProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!portfolio || portfolio.length === 0) return;
    if (projectIdFromUrl) return;
    const first = portfolio[0]!.id;
    router.replace(`/reporting?project=${encodeURIComponent(first)}`, { scroll: false });
  }, [portfolio, projectIdFromUrl, router]);

  const loadReports = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const list = await fetchProjectReports(projectId);
    if (list === null) {
      setError("Could not load reports for this project.");
      setReports([]);
    } else {
      setReports(list);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const selectedProject = useMemo(
    () => portfolio?.find((p) => p.id === projectId) ?? null,
    [portfolio, projectId],
  );

  function onSelectProject(id: string) {
    router.push(`/reporting?project=${encodeURIComponent(id)}`);
  }

  function openEdit(r: ProjectReport) {
    setEditing(r);
    setEditTitle(r.title);
    setEditBody(r.body ?? "");
    setEditStatus(r.status);
    setEditDue(r.dueAt ? toDatetimeLocalValue(r.dueAt) : "");
    setEditNewFile(null);
    setEditError(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditSaving(false);
    setEditError(null);
    setEditNewFile(null);
  }

  async function onSubmitDigital(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setDigitalMsg(null);
    setSavingDigital(true);
    const dueAt =
      dueDigital.trim().length > 0 ? new Date(dueDigital).toISOString() : undefined;
    const res = await createDigitalReport(projectId, {
      title: titleDigital.trim(),
      body: bodyDigital.trim(),
      status: statusDigital,
      dueAt: dueAt ?? null,
    });
    setSavingDigital(false);
    if (!res.ok) {
      setDigitalMsg(res.status === 400 ? "Check the fields and try again." : "Could not save the report.");
      return;
    }
    setTitleDigital("");
    setBodyDigital("");
    setDueDigital("");
    setStatusDigital("in_review");
    setDigitalMsg("Report saved.");
    setReports((prev) => [res.report, ...prev]);
  }

  async function onSubmitFileUpload(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !uploadFile) {
      setFileMsg("Choose a file.");
      return;
    }
    setFileMsg(null);
    setSavingFile(true);
    const res = await uploadReportFile(projectId, uploadFile, titleFile.trim() || undefined);
    setSavingFile(false);
    if (!res.ok) {
      if (res.status === 413) setFileMsg("File is too large (max 25 MB).");
      else if (res.status === 400) setFileMsg("This file type is not allowed.");
      else setFileMsg("Upload failed. Try again.");
      return;
    }
    setTitleFile("");
    setUploadFile(null);
    setFileMsg("File uploaded.");
    setReports((prev) => [res.report, ...prev]);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !projectId) return;
    setEditError(null);
    setEditSaving(true);

    const jsonRes = await updateReport(projectId, editing.id, {
      title: editTitle.trim(),
      body: editBody.trim().length > 0 ? editBody.trim() : null,
      status: editStatus,
      dueAt: editDue.trim().length > 0 ? new Date(editDue).toISOString() : null,
    });

    if (!jsonRes.ok) {
      setEditSaving(false);
      setEditError(jsonRes.status === 400 ? "Check the fields and try again." : "Could not update the report.");
      return;
    }

    if (editNewFile) {
      const fileRes = await replaceReportAttachment(projectId, editing.id, editNewFile);
      if (!fileRes.ok) {
        setEditSaving(false);
        setEditError(
          fileRes.status === 413
            ? "Replacement file is too large (max 25 MB)."
            : fileRes.status === 400
              ? "This file type is not allowed."
              : "Could not upload the new file.",
        );
        return;
      }
    }

    setEditSaving(false);
    closeEdit();
    void loadReports();
  }

  const pagePad = "clamp(1rem, 3vw, 2rem)";

  return (
    <DashboardShell user={user} fullBleed>
      <div
        style={{
          width: "100%",
          flex: 1,
          minHeight: "100%",
          minWidth: 0,
          background: "linear-gradient(180deg, #e8f1f9 0%, #eef2f7 45%, #f4f4f5 100%)",
          boxSizing: "border-box",
        }}
      >
        {/* Workspace chrome */}
        <div
          style={{
            padding: `${pagePad} ${pagePad} 0`,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
            borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
            paddingBottom: "1rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Technical reporting
            </div>
            <h1
              style={{
                margin: "0.35rem 0 0",
                fontSize: "clamp(1.35rem, 2.5vw, 1.85rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0f172a",
              }}
            >
              {"Specifications & site reports"}
            </h1>
            <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.92rem", maxWidth: "52ch" }}>
              Werf verslag, technical specs, and attachments — aligned to your project portfolio.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <nav
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                gap: "0.25rem",
                padding: "0.2rem",
                borderRadius: 10,
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(148, 163, 184, 0.35)",
              }}
              aria-label="Area navigation"
            >
              <Link
                href="/projects"
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "#334155",
                  background: "transparent",
                }}
              >
                Projects
              </Link>
              <Link
                href="/dashboard"
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "#334155",
                }}
              >
                Analytics
              </Link>
              <span
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: "#0f172a",
                }}
              >
                Specifications
              </span>
            </nav>
            <label
              style={{
                fontSize: "0.8rem",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
              }}
            >
              Project
              <select
                value={projectId ?? ""}
                onChange={(e) => onSelectProject(e.target.value)}
                style={{
                  padding: "0.45rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                  minWidth: 200,
                  background: "#fff",
                  color: "#0f172a",
                }}
              >
                {(portfolio ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* In-page quick nav */}
        <div
          style={{
            padding: `0.75rem ${pagePad} 0`,
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            alignItems: "center",
          }}
        >
          {(
            [
              ["hero-ai", "AI studio"],
              ["drafting-section", "Drafting"],
              ["asset-section", "Attachments"],
              ["history-section", "Report history"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
          <Link
            href="/projects/new"
            style={{
              marginLeft: "auto",
              padding: "0.45rem 1rem",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            + New project
          </Link>
        </div>

        {/* Hero cards */}
        <div
          id="hero-ai"
          style={{
            padding: `1.25rem ${pagePad} 0`,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "1rem",
          }}
        >
          <div
            style={{
              borderRadius: 16,
              padding: "1.35rem 1.25rem",
              background: "linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.25)",
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", opacity: 0.75 }}>
              ASSISTED AUTHORING
            </div>
            <h2 style={{ margin: "0.5rem 0 0.5rem", fontSize: "1.15rem", fontWeight: 800 }}>Write with AI assistant</h2>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55, opacity: 0.88, maxWidth: "42ch" }}>
              Generate structured site notes from prompts, then refine them in the drafting terminal. (Coming soon — use
              manual drafting below today.)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => scrollToSection("drafting-section")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 10,
                  border: "none",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Open drafting
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("asset-section")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: 10,
                  border: "1px solid rgba(248,250,252,0.35)",
                  background: "transparent",
                  color: "#f8fafc",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Attach files
              </button>
            </div>
          </div>
          <div
            style={{
              borderRadius: 16,
              padding: "1.35rem 1.25rem",
              background: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", color: "#64748b" }}>
              MANUAL
            </div>
            <h2 style={{ margin: "0.5rem 0 0.5rem", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
              Manual report
            </h2>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55, color: "#64748b", maxWidth: "42ch" }}>
              Start from scratch with full control — ideal for inspections, checklists, and compliance narratives.
            </p>
            <button
              type="button"
              onClick={() => scrollToSection("drafting-section")}
              style={{
                marginTop: "1rem",
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "0.5rem 0",
                border: "none",
                background: "none",
                color: "#2563eb",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Create draft
              <span aria-hidden style={{ fontSize: "1.1rem" }}>
                →
              </span>
            </button>
          </div>
        </div>

        {!projectId ? (
          <p style={{ padding: `1rem ${pagePad}`, color: "#64748b" }}>Loading projects…</p>
        ) : (
          <>
            <div style={{ padding: `1.5rem ${pagePad} 0`, width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                  alignItems: "stretch",
                }}
              >
                <form
                  id="drafting-section"
                  onSubmit={(e) => void onSubmitDigital(e)}
                  style={{
                    flex: "2 1 520px",
                    minWidth: 0,
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: "1.35rem 1.25rem",
                    background: "#fff",
                    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "#64748b" }}>
                      DRAFTING TERMINAL
                    </div>
                    <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                      New narrative report
                    </h2>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.84rem", color: "#64748b" }}>
                      {selectedProject?.name}
                      {selectedProject?.location ? (
                        <span style={{ color: "#94a3b8" }}> · {selectedProject.location}</span>
                      ) : null}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                      Report title
                      <input
                        value={titleDigital}
                        onChange={(e) => setTitleDigital(e.target.value)}
                        required
                        maxLength={500}
                        style={{
                          padding: "0.55rem 0.75rem",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                          background: "#f8fafc",
                        }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                      Executive content
                      <textarea
                        value={bodyDigital}
                        onChange={(e) => setBodyDigital(e.target.value)}
                        required
                        rows={9}
                        placeholder="Weather, crew, progress, safety, next steps…"
                        style={{
                          padding: "0.65rem 0.75rem",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                          resize: "vertical",
                          fontFamily: "inherit",
                          lineHeight: 1.5,
                          minHeight: 200,
                          background: "#f8fafc",
                        }}
                      />
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155", flex: "1 1 160px" }}>
                        Status
                        <select
                          value={statusDigital}
                          onChange={(e) => setStatusDigital(e.target.value as ReportStatus)}
                          style={{
                            padding: "0.5rem 0.65rem",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            fontSize: "0.88rem",
                            background: "#fff",
                          }}
                        >
                          <option value="in_review">In review</option>
                          <option value="action_required">Action required</option>
                          <option value="approved">Approved</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155", flex: "1 1 200px" }}>
                        Due date (optional)
                        <input
                          type="datetime-local"
                          value={dueDigital}
                          onChange={(e) => setDueDigital(e.target.value)}
                          style={{
                            padding: "0.5rem 0.65rem",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            fontSize: "0.88rem",
                            background: "#fff",
                          }}
                        />
                      </label>
                    </div>
                    {digitalMsg ? (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>{digitalMsg}</p>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTitleDigital("");
                          setBodyDigital("");
                          setDueDigital("");
                          setStatusDigital("in_review");
                          setDigitalMsg(null);
                        }}
                        style={{
                          padding: "0.6rem 1.1rem",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          cursor: "pointer",
                          color: "#475569",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingDigital}
                        style={{
                          padding: "0.6rem 1.25rem",
                          borderRadius: 10,
                          border: "none",
                          background: "#0f172a",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          cursor: savingDigital ? "wait" : "pointer",
                        }}
                      >
                        {savingDigital ? "Submitting…" : "Finalize & submit"}
                      </button>
                    </div>
                  </div>
                </form>

                <form
                  id="asset-section"
                  onSubmit={(e) => void onSubmitFileUpload(e)}
                  style={{
                    flex: "1 1 300px",
                    minWidth: "min(100%, 280px)",
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: "1.35rem 1.25rem",
                    background: "#fff",
                    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "#64748b" }}>
                      ASSET REPOSITORY
                    </div>
                    <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                      Upload technical specs
                    </h2>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>
                      PDF, Office, CAD, images, archives — max 25 MB per file.
                    </p>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                    Title (optional)
                    <input
                      value={titleFile}
                      onChange={(e) => setTitleFile(e.target.value)}
                      maxLength={500}
                      placeholder="Defaults to file name"
                      style={{
                        padding: "0.55rem 0.75rem",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        background: "#f8fafc",
                      }}
                    />
                  </label>
                  <div style={{ marginTop: "0.85rem" }}>
                    <input
                      ref={assetFileInputRef}
                      type="file"
                      accept={FILE_INPUT_ACCEPT}
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      style={{ display: "none" }}
                      id="reporting-asset-file"
                    />
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAssetDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAssetDragActive(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAssetDragActive(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) setUploadFile(f);
                      }}
                      style={{
                        borderRadius: 12,
                        border: `2px dashed ${assetDragActive ? "#2563eb" : "#cbd5e1"}`,
                        background: assetDragActive ? "rgba(37, 99, 235, 0.06)" : "#f8fafc",
                        padding: "1.35rem 1rem",
                        textAlign: "center",
                      }}
                    >
                      <p style={{ margin: "0 0 0.65rem", fontSize: "0.88rem", color: "#475569", fontWeight: 600 }}>
                        Drop files here or select from disk
                      </p>
                      <button
                        type="button"
                        onClick={() => assetFileInputRef.current?.click()}
                        style={{
                          padding: "0.45rem 1rem",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          color: "#0f172a",
                        }}
                      >
                        Select files
                      </button>
                    </div>
                  </div>
                  {uploadFile ? (
                    <div
                      style={{
                        marginTop: "0.85rem",
                        padding: "0.65rem 0.75rem",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>Queued for attachment</div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {uploadFile.name}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{formatFileSize(uploadFile.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadFile(null)}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#64748b",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  {fileMsg ? (
                    <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem", color: "#64748b" }}>{fileMsg}</p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={savingFile}
                    style={{
                      marginTop: "auto",
                      padding: "0.6rem 1rem",
                      borderRadius: 10,
                      border: "1px solid #0f172a",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: savingFile ? "wait" : "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    {savingFile ? "Uploading…" : "Upload to project"}
                  </button>
                </form>
              </div>
            </div>

            <section id="history-section" style={{ padding: `0 ${pagePad} 2.5rem`, width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "#64748b" }}>SUBMISSION LOG</div>
                  <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                    Project submission history
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToSection("drafting-section")}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#2563eb",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  View all in drafting ↑
                </button>
              </div>

              <div
                style={{
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)",
                  overflow: "auto",
                }}
              >
                {loading ? (
                  <p style={{ margin: 0, padding: "1.25rem", color: "#64748b" }}>Loading…</p>
                ) : error ? (
                  <p style={{ margin: 0, padding: "1.25rem", color: "#b91c1c" }}>{error}</p>
                ) : reports.length === 0 ? (
                  <p style={{ margin: 0, padding: "1.25rem", color: "#64748b" }}>
                    No submissions yet. Create a draft or upload a file above.
                  </p>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      minWidth: 720,
                      borderCollapse: "collapse",
                      fontSize: "0.875rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>Reference</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#64748b" }}>Document title</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>Status</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>Submitted</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r, i) => {
                        const st = statusStyle(r.status);
                        return (
                          <tr
                            key={r.id}
                            style={{
                              borderBottom: i < reports.length - 1 ? "1px solid #f1f5f9" : undefined,
                              background: i % 2 === 0 ? "#fff" : "#fafbfc",
                            }}
                          >
                            <td style={{ padding: "0.75rem 1rem", fontFamily: "ui-monospace, monospace", color: "#475569", whiteSpace: "nowrap" }}>
                              {r.id.slice(0, 8)}…
                            </td>
                            <td style={{ padding: "0.75rem 1rem", maxWidth: 360 }}>
                              <div style={{ fontWeight: 600, color: "#0f172a" }} title={r.title}>
                                {r.title.length > 80 ? `${r.title.slice(0, 80)}…` : r.title}
                              </div>
                              {selectedProject?.location ? (
                                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{selectedProject.location}</div>
                              ) : null}
                              {r.body ? (
                                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>
                                  {r.body.length > 120 ? `${r.body.slice(0, 120)}…` : r.body}
                                </div>
                              ) : null}
                            </td>
                            <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  padding: "0.25rem 0.55rem",
                                  borderRadius: 999,
                                  background: st.bg,
                                  color: st.fg,
                                }}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatWhen(r.createdAt)}</td>
                            <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                                {r.fileStorageKey ? (
                                  <a
                                    href={reportFileUrl(projectId, r.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: "0.82rem", fontWeight: 600, color: "#2563eb" }}
                                  >
                                    Open
                                  </a>
                                ) : (
                                  <span style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>—</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEdit(r)}
                                  style={{
                                    fontSize: "0.82rem",
                                    fontWeight: 600,
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: 8,
                                    border: "1px solid #e2e8f0",
                                    background: "#fff",
                                    cursor: "pointer",
                                    color: "#334155",
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {editing && projectId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-report-title"
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
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <form
            onSubmit={(e) => void onSaveEdit(e)}
            style={{
              width: "100%",
              maxWidth: 520,
              marginTop: "2rem",
              marginBottom: "2rem",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              padding: "1.25rem",
              boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-report-title" style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>
              Edit report
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                Title
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={500}
                  style={{
                    padding: "0.5rem 0.65rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: "0.9rem",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                Content (optional)
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  placeholder="Leave empty if this report is file-only."
                  style={{
                    padding: "0.5rem 0.65rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: "0.9rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem", flex: "1 1 140px" }}>
                  Status
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ReportStatus)}
                    style={{
                      padding: "0.45rem 0.65rem",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="in_review">In review</option>
                    <option value="action_required">Action required</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem", flex: "1 1 180px" }}>
                  Due (optional)
                  <input
                    type="datetime-local"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    style={{
                      padding: "0.45rem 0.65rem",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: "0.9rem",
                    }}
                  />
                </label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                {editing.fileStorageKey ? "Replace attachment (optional)" : "Add attachment (optional)"}
                <input
                  type="file"
                  accept={FILE_INPUT_ACCEPT}
                  onChange={(e) => setEditNewFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: "0.9rem" }}
                />
              </label>
              {editError ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#b91c1c" }}>{editError}</p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="submit"
                  disabled={editSaving}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--text)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: editSaving ? "wait" : "pointer",
                  }}
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => closeEdit()}
                  disabled={editSaving}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    fontWeight: 600,
                    cursor: editSaving ? "wait" : "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardShell>
  );
}

export default function ReportingPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell user={null} fullBleed>
          <p style={{ padding: "1.5rem", color: "#64748b" }}>Loading…</p>
        </DashboardShell>
      }
    >
      <ReportingPageContent />
    </Suspense>
  );
}
