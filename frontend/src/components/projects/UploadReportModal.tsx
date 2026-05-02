"use client";

import { useEffect, useState } from "react";
import { uploadReportFile } from "@/lib/api/reports";

type Props = {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onUploaded: () => void;
};

export function UploadReportModal({ open, projectId, onClose, onUploaded }: Props) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setFile(null);
    setError(null);
    setSaving(false);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await uploadReportFile(projectId, file, title.trim() || undefined);
    setSaving(false);
    if (!res.ok) {
      if (res.status === 400) {
        setError("Missing or unsupported file. Use PDF, Office, images, or other allowed types.");
      } else if (res.status === 404) {
        setError("Project not found or you no longer have access.");
      } else {
        setError("Upload failed. Try again.");
      }
      return;
    }
    onUploaded();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-report-title"
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
          maxWidth: 440,
          marginTop: "2rem",
          marginBottom: "2rem",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "1.35rem 1.45rem",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--muted)",
                textTransform: "uppercase",
                marginBottom: "0.35rem",
              }}
            >
              Library
            </div>
            <h2 id="upload-report-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Upload document
            </h2>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.45 }}>
              Adds a file-backed report for this project (same as Reporting file upload).
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

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem", fontWeight: 600 }}>
            Title <span style={{ fontWeight: 400, color: "var(--muted)" }}>Optional — defaults to the file name.</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              placeholder="e.g. Structural submittal"
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: 10,
                border: "1px solid var(--border)",
                fontSize: "0.92rem",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem", fontWeight: 600 }}>
            File <span style={{ color: "#b91c1c" }}>*</span>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: "0.88rem" }}
            />
          </label>
        </div>

        {error ? (
          <p
            style={{
              margin: "1rem 0 0",
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
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
            {saving ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
