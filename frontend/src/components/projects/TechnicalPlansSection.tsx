"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectPortfolioCard } from "@/lib/api/projects";
import {
  canOpenInline,
  deleteTechnicalPlan,
  fetchTechnicalPlans,
  TECHNICAL_PLAN_INPUT_ACCEPT,
  technicalPlanFileUrl,
  uploadTechnicalPlan,
  type TechnicalPlan,
} from "@/lib/api/technicalPlans";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type Props = {
  /** When set, list and uploads are scoped to this project. */
  projectId?: string;
  projects?: ProjectPortfolioCard[];
  /** Show project column (e.g. when viewing all projects). */
  showProjectColumn?: boolean;
  hideUpload?: boolean;
  /** Nested inside another card — skip outer border/padding. */
  embedded?: boolean;
};

export function TechnicalPlansSection({
  projectId: scopeProjectId,
  projects = [],
  showProjectColumn = false,
  hideUpload = false,
  embedded = false,
}: Props) {
  const [plans, setPlans] = useState<TechnicalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState(scopeProjectId ?? "");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const list = await fetchTechnicalPlans(scopeProjectId);
    if (list === null) {
      setError("Could not load technical plans.");
      setPlans([]);
    } else {
      setPlans(list);
    }
    setLoading(false);
  }, [scopeProjectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (scopeProjectId) setUploadProjectId(scopeProjectId);
    else if (!uploadProjectId && projects.length > 0) {
      setUploadProjectId(projects[0]!.id);
    }
  }, [scopeProjectId, projects, uploadProjectId]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadMsg(null);
    const pid = scopeProjectId ?? uploadProjectId;
    if (!pid) {
      setUploadMsg("Choose a project first.");
      return;
    }
    if (!uploadFile) {
      setUploadMsg("Choose a file to upload.");
      return;
    }
    setUploading(true);
    const res = await uploadTechnicalPlan(pid, uploadFile, uploadTitle.trim() || undefined);
    setUploading(false);
    if (!res.ok) {
      if (res.status === 413) setUploadMsg("File is too large (max 25 MB).");
      else if (res.status === 400) setUploadMsg("This file type is not allowed.");
      else setUploadMsg("Upload failed. Try again.");
      return;
    }
    setUploadFile(null);
    setUploadTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadMsg("Plan uploaded.");
    await reload();
  }

  async function onDelete(plan: TechnicalPlan) {
    if (!window.confirm(`Delete “${plan.title}”? This cannot be undone.`)) return;
    setBusyId(plan.id);
    const ok = await deleteTechnicalPlan(plan.projectId, plan.id);
    setBusyId(null);
    if (!ok) {
      setError("Could not delete this plan.");
      return;
    }
    await reload();
  }

  const cardStyle: React.CSSProperties = embedded
    ? { marginTop: "0.85rem" }
    : {
        border: hideUpload ? "none" : "1px solid #e2e8f0",
        borderRadius: hideUpload ? 0 : 14,
        background: hideUpload ? "transparent" : "#fff",
        padding: hideUpload ? 0 : "1.15rem 1.25rem",
        marginTop: hideUpload ? 0 : "0.75rem",
      };

  return (
    <div style={cardStyle}>
      {!hideUpload ? (
        <form
          onSubmit={(e) => void onUpload(e)}
          style={{
            marginBottom: "1.15rem",
            padding: "1rem",
            borderRadius: 12,
            border: "1px dashed #cbd5e1",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", color: "#64748b" }}>
            UPLOAD TECHNICAL PLAN
          </div>
          {!scopeProjectId ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", fontWeight: 600 }}>
              Project
              <select
                value={uploadProjectId}
                onChange={(e) => setUploadProjectId(e.target.value)}
                required
                style={{ padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
              >
                {projects.length === 0 ? (
                  <option value="">No projects</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", fontWeight: 600 }}>
            Title (optional)
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Structural drawings — Rev B"
              maxLength={500}
              style={{ padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={TECHNICAL_PLAN_INPUT_ACCEPT}
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: "0.85rem", flex: "1 1 200px" }}
            />
            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 8,
                border: "none",
                background: "#0f172a",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: uploading ? "wait" : "pointer",
              }}
            >
              {uploading ? "Uploading…" : "Upload plan"}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
            PDF, CAD (.dwg, .dxf), Office, images, archives — max 25 MB.
          </p>
          {uploadMsg ? (
            <p
              style={{
                margin: 0,
                fontSize: "0.82rem",
                color: uploadMsg.includes("failed") || uploadMsg.includes("too large") || uploadMsg.includes("not allowed") || uploadMsg.includes("Choose") ? "#b91c1c" : "#047857",
              }}
            >
              {uploadMsg}
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? <p style={{ margin: "0 0 0.75rem", color: "#b91c1c", fontSize: "0.88rem" }}>{error}</p> : null}

      {loading ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Loading plans…</p>
      ) : plans.length === 0 ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
          No technical plans yet.{hideUpload ? " Upload from the Documents workspace." : " Use the form above to add drawings or specifications."}
        </p>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: showProjectColumn ? 640 : 480 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {showProjectColumn ? (
                    <th style={{ padding: "0.65rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.06em" }}>
                      PROJECT
                    </th>
                  ) : null}
                  <th style={{ padding: "0.65rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.06em" }}>
                    PLAN
                  </th>
                  <th style={{ padding: "0.65rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.06em" }}>
                    UPLOADED
                  </th>
                  <th style={{ padding: "0.65rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.06em" }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, i) => {
                  const fileUrl = technicalPlanFileUrl(plan.projectId, plan.id);
                  const openable = canOpenInline(plan.fileMimeType, plan.fileOriginalName);
                  return (
                    <tr key={plan.id} style={{ borderBottom: i < plans.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                      {showProjectColumn ? (
                        <td style={{ padding: "0.65rem 0.85rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {plan.projectName ? (
                            <Link href={`/projects/${plan.projectId}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                              {plan.projectName}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                      <td style={{ padding: "0.65rem 0.85rem" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{plan.title}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{plan.fileOriginalName}</div>
                      </td>
                      <td style={{ padding: "0.65rem 0.85rem", color: "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {formatWhen(plan.createdAt)}
                      </td>
                      <td style={{ padding: "0.65rem 0.85rem", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                          {openable ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontWeight: 700, color: "#2563eb", fontSize: "0.82rem" }}
                            >
                              Open
                            </a>
                          ) : null}
                          <a
                            href={fileUrl}
                            download={plan.fileOriginalName}
                            style={{ fontWeight: 700, color: "#2563eb", fontSize: "0.82rem" }}
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void onDelete(plan)}
                            style={{
                              padding: "0.2rem 0.5rem",
                              borderRadius: 6,
                              border: "1px solid #fecaca",
                              background: "#fff",
                              color: "#b91c1c",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              cursor: busyId !== null ? "wait" : "pointer",
                            }}
                          >
                            {busyId === plan.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
