"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Link, useRouter } from "@/i18n/navigation";
import { intlLocaleTags, type AppLocale } from "@/i18n/routing";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest } from "@/lib/api/auth";
import {
  createDigitalReport,
  deleteReportPhoto,
  fetchProjectReports,
  replaceReportAttachment,
  type ProjectReport,
  type ReportStatus,
  reportFileUrl,
  reportPhotoUrl,
  updateReport,
  uploadReportFile,
  uploadReportPhotos,
} from "@/lib/api/reports";
import { fetchProjectPortfolio, type ProjectPortfolioCard } from "@/lib/api/projects";
import { htmlToPlainPreview, isEffectivelyEmptyHtml, RichTextEditor } from "@/components/reporting/RichTextEditor";
import { ActionIconButton, ActionIconLink, IconDownload, IconEye, IconTrash } from "@/components/ui/ActionIcons";
import { useIsMobile } from "@/lib/useMediaQuery";

const FILE_INPUT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif,.txt,.csv,.zip,.rar,.7z,.dwg,.dxf";

/** Images allowed for report attachments (subset of backend ALLOWED_EXT). */
const PICTURE_INPUT_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff,image/svg+xml,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif";

function statusStyle(s: ReportStatus): { bg: string; fg: string; statusKey: "statusActionRequired" | "statusApproved" | "statusInReview" } {
  switch (s) {
    case "action_required":
      return { bg: "#fef2f2", fg: "#b91c1c", statusKey: "statusActionRequired" };
    case "approved":
      return { bg: "#ecfdf5", fg: "#047857", statusKey: "statusApproved" };
    case "in_review":
    default:
      return { bg: "#eff6ff", fg: "#1d4ed8", statusKey: "statusInReview" };
  }
}

function formatWhen(iso: string, intlLocale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
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
  const t = useTranslations("Reporting");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as AppLocale;
  const intlLocale = intlLocaleTags[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("project");
  const isMobile = useIsMobile(768);

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
  const [digitalPictures, setDigitalPictures] = useState<File[]>([]);

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
  const [editNewPhotos, setEditNewPhotos] = useState<File[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const assetFileInputRef = useRef<HTMLInputElement>(null);
  const narrativePicInputRef = useRef<HTMLInputElement>(null);
  const [assetDragActive, setAssetDragActive] = useState(false);
  const [narrativePicDragActive, setNarrativePicDragActive] = useState(false);
  const [digitalPicPreviewUrls, setDigitalPicPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = digitalPictures.map((f) => URL.createObjectURL(f));
    setDigitalPicPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [digitalPictures]);

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
      setError(t("loadError"));
      setReports([]);
    } else {
      setReports(list);
    }
    setLoading(false);
  }, [projectId, t]);

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
    setEditNewPhotos([]);
    setEditError(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditSaving(false);
    setEditError(null);
    setEditNewFile(null);
    setEditNewPhotos([]);
  }

  async function onSubmitDigital(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setDigitalMsg(null);
    if (isEffectivelyEmptyHtml(bodyDigital)) {
      setDigitalMsg(t("bodyRequired"));
      return;
    }
    setSavingDigital(true);
    const dueAt =
      dueDigital.trim().length > 0 ? new Date(dueDigital).toISOString() : undefined;
    const res = await createDigitalReport(projectId, {
      title: titleDigital.trim(),
      body: bodyDigital.trim(),
      status: statusDigital,
      dueAt: dueAt ?? null,
    });
    if (!res.ok) {
      setSavingDigital(false);
      setDigitalMsg(res.status === 400 ? t("checkFields") : t("saveFailed"));
      return;
    }

    let reportRow: ProjectReport = res.report;
    const queuedPhotos = digitalPictures.length;
    if (queuedPhotos > 0) {
      const up = await uploadReportPhotos(projectId, res.report.id, digitalPictures);
      if (!up.ok) {
        setSavingDigital(false);
        setDigitalMsg(
          up.status === 413
            ? t("savedPhotoTooLarge")
            : up.status === 400
              ? t("savedPhotoType")
              : t("savedPhotoFail"),
        );
        setReports((prev) => [reportRow, ...prev]);
        return;
      }
      reportRow = up.report;
    }

    setSavingDigital(false);
    setTitleDigital("");
    setBodyDigital("");
    setDueDigital("");
    setStatusDigital("in_review");
    setDigitalPictures([]);
    setDigitalMsg(
      queuedPhotos > 0 ? t("savedWithPhotos", { count: queuedPhotos }) : t("saved"),
    );
    setReports((prev) => [reportRow, ...prev]);
  }

  async function onSubmitFileUpload(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !uploadFile) {
      setFileMsg(t("chooseFile"));
      return;
    }
    setFileMsg(null);
    setSavingFile(true);
    const res = await uploadReportFile(projectId, uploadFile, titleFile.trim() || undefined);
    setSavingFile(false);
    if (!res.ok) {
      if (res.status === 413) setFileMsg(t("fileTooLarge"));
      else if (res.status === 400) setFileMsg(t("fileTypeInvalid"));
      else setFileMsg(t("uploadFailed"));
      return;
    }
    setTitleFile("");
    setUploadFile(null);
    setFileMsg(t("fileUploaded"));
    setReports((prev) => [res.report, ...prev]);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !projectId) return;
    setEditError(null);
    setEditSaving(true);

    const jsonRes = await updateReport(projectId, editing.id, {
      title: editTitle.trim(),
      body: !isEffectivelyEmptyHtml(editBody) ? editBody.trim() : null,
      status: editStatus,
      dueAt: editDue.trim().length > 0 ? new Date(editDue).toISOString() : null,
    });

    if (!jsonRes.ok) {
      setEditSaving(false);
      setEditError(jsonRes.status === 400 ? t("checkFields") : t("updateFailed"));
      return;
    }

    if (editNewFile) {
      const fileRes = await replaceReportAttachment(projectId, editing.id, editNewFile);
      if (!fileRes.ok) {
        setEditSaving(false);
        setEditError(
          fileRes.status === 413
            ? t("replaceTooLarge")
            : fileRes.status === 400
              ? t("fileTypeInvalid")
              : t("replaceUploadFailed"),
        );
        return;
      }
    }

    if (editNewPhotos.length > 0) {
      const picRes = await uploadReportPhotos(projectId, editing.id, editNewPhotos);
      if (!picRes.ok) {
        setEditSaving(false);
        setEditError(
          picRes.status === 413
            ? t("newPhotoTooLarge")
            : picRes.status === 400
              ? t("newPhotoType")
              : t("newPhotoFail"),
        );
        return;
      }
    }

    setEditSaving(false);
    closeEdit();
    void loadReports();
  }

  async function removeExistingPhoto(photoId: string) {
    if (!projectId || !editing) return;
    setEditError(null);
    const res = await deleteReportPhoto(projectId, editing.id, photoId);
    if (!res.ok) {
      setEditError(t("photoRemoveFailed"));
      return;
    }
    setEditing(res.report);
    setReports((prev) => prev.map((x) => (x.id === res.report.id ? res.report : x)));
  }

  const pagePad = isMobile ? "0.85rem" : "clamp(1rem, 3vw, 2rem)";

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
                color: "var(--muted)",
                textTransform: "uppercase",
              }}
            >
              {t("eyebrow")}
            </div>
            <h1
              style={{
                margin: "0.35rem 0 0",
                fontSize: "clamp(1.35rem, 2.5vw, 1.85rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text)",
              }}
            >
              {t("title")}
            </h1>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.92rem", maxWidth: "52ch" }}>
{t("subtitle")}
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
              aria-label={t("areaNav")}
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
                {t("navProjects")}
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
                {t("navAnalytics")}
              </Link>
              <span
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: "var(--text)",
                }}
              >
                {t("navSpecs")}
              </span>
            </nav>
            <label
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                display: "flex",
                alignItems: isMobile ? "stretch" : "center",
                flexDirection: isMobile ? "column" : "row",
                gap: 8,
                fontWeight: 600,
                width: isMobile ? "100%" : undefined,
                minWidth: 0,
              }}
            >
              {t("project")}
              <select
                value={projectId ?? ""}
                onChange={(e) => onSelectProject(e.target.value)}
                style={{
                  padding: "0.45rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                  minWidth: isMobile ? 0 : 200,
                  width: isMobile ? "100%" : undefined,
                  background: "var(--surface)",
                  color: "var(--text)",
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
              ["hero-ai", "jumpAi"],
              ["drafting-section", "jumpDrafting"],
              ["asset-section", "jumpAttachments"],
              ["history-section", "jumpHistory"],
            ] as const
          ).map(([id, labelKey]) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSection(id)}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "var(--surface)",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              {t(labelKey)}
            </button>
          ))}
          <Link
            href="/projects/new"
            style={{
              marginLeft: "auto",
              padding: "0.45rem 1rem",
              borderRadius: 10,
              background: "var(--text)",
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
              background: "linear-gradient(145deg, var(--text) 0%, var(--text) 100%)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.25)",
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", opacity: 0.75 }}>
              {t("assistedAuthoring")}
            </div>
            <h2 style={{ margin: "0.5rem 0 0.5rem", fontSize: "1.15rem", fontWeight: 800 }}>{t("writeWithAi")}</h2>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55, opacity: 0.88, maxWidth: "42ch" }}>
              {t("writeWithAiDesc")}
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
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {t("openDrafting")}
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
              background: "var(--surface)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)" }}>
              MANUAL
            </div>
            <h2 style={{ margin: "0.5rem 0 0.5rem", fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>
              Manual report
            </h2>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55, color: "var(--muted)", maxWidth: "42ch" }}>
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
                color: "var(--text)",
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
          <p style={{ padding: `1rem ${pagePad}`, color: "var(--muted)" }}>{t("loadingProjects")}</p>
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
                    background: "var(--surface)",
                    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)" }}>
                      DRAFTING TERMINAL
                    </div>
                    <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>
                      New narrative report
                    </h2>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.84rem", color: "var(--muted)" }}>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>{t("executiveContent")}</span>
                      <RichTextEditor
                        id="reporting-narrative-body"
                        aria-label={t("narrativeAria")}
                        value={bodyDigital}
                        onChange={setBodyDigital}
                        disabled={savingDigital}
                        minHeight={220}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>{t("sitePhotosOptional")}</span>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.45 }}>
                        Add multiple images (up to 30, max 25 MB each). HEIC, PNG, JPEG, WebP, and other common formats.
                      </p>
                      <input
                        ref={narrativePicInputRef}
                        type="file"
                        accept={PICTURE_INPUT_ACCEPT}
                        multiple
                        onChange={(e) => {
                          const list = e.target.files;
                          if (!list?.length) return;
                          const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
                          setDigitalPictures((prev) => [...prev, ...imgs].slice(0, 30));
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                        id="reporting-narrative-picture"
                      />
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNarrativePicDragActive(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNarrativePicDragActive(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setNarrativePicDragActive(false);
                          const list = e.dataTransfer.files;
                          if (!list?.length) return;
                          const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
                          setDigitalPictures((prev) => [...prev, ...imgs].slice(0, 30));
                        }}
                        style={{
                          borderRadius: 12,
                          border: `2px dashed ${narrativePicDragActive ? "var(--text)" : "#cbd5e1"}`,
                          background: narrativePicDragActive ? "rgba(37, 99, 235, 0.06)" : "#f8fafc",
                          padding: "0.85rem 1rem",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => narrativePicInputRef.current?.click()}
                          style={{
                            padding: "0.45rem 0.9rem",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            background: "var(--surface)",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            color: "var(--text)",
                          }}
                        >
                          Choose photos
                        </button>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{t("orDropImages")}</span>
                      </div>
                      {digitalPictures.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            padding: "0.65rem 0.75rem",
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            background: "var(--surface)",
                          }}
                        >
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>
                            Selected ({digitalPictures.length}/30)
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {digitalPictures.map((file, idx) => (
                              <div
                                key={`${file.name}-${file.size}-${idx}`}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 6,
                                  padding: 6,
                                  borderRadius: 8,
                                  border: "1px solid #f1f5f9",
                                  background: "var(--soft)",
                                  maxWidth: "100%",
                                }}
                              >
                                {digitalPicPreviewUrls[idx] ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                                  <img
                                    src={digitalPicPreviewUrls[idx]}
                                    alt=""
                                    style={{
                                      width: 56,
                                      height: 56,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : null}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      color: "var(--text)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      maxWidth: 160,
                                    }}
                                  >
                                    {file.name}
                                  </div>
                                  <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{formatFileSize(file.size)}</div>
                                  <button
                                    type="button"
                                    onClick={() => setDigitalPictures((prev) => prev.filter((_, i) => i !== idx))}
                                    style={{
                                      marginTop: 4,
                                      border: "none",
                                      background: "none",
                                      color: "var(--muted)",
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      padding: 0,
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setDigitalPictures([])}
                            style={{
                              alignSelf: "flex-start",
                              border: "none",
                              background: "none",
                              color: "var(--muted)",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Clear all
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155", flex: "1 1 160px" }}>
                        {t("statusLabel")}
                        <select
                          value={statusDigital}
                          onChange={(e) => setStatusDigital(e.target.value as ReportStatus)}
                          style={{
                            padding: "0.5rem 0.65rem",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            fontSize: "0.88rem",
                            background: "var(--surface)",
                          }}
                        >
                          <option value="in_review">{t("statusInReview")}</option>
                          <option value="action_required">{t("statusActionRequired")}</option>
                          <option value="approved">{t("statusApproved")}</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155", flex: "1 1 200px" }}>
                        {t("dueOptional")}
                        <input
                          type="datetime-local"
                          value={dueDigital}
                          onChange={(e) => setDueDigital(e.target.value)}
                          style={{
                            padding: "0.5rem 0.65rem",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            fontSize: "0.88rem",
                            background: "var(--surface)",
                          }}
                        />
                      </label>
                    </div>
                    {digitalMsg ? (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{digitalMsg}</p>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTitleDigital("");
                          setBodyDigital("");
                          setDueDigital("");
                          setStatusDigital("in_review");
                          setDigitalPictures([]);
                          setDigitalMsg(null);
                        }}
                        style={{
                          padding: "0.6rem 1.1rem",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: "var(--surface)",
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          cursor: "pointer",
                          color: "#475569",
                        }}
                      >
                        {tCommon("cancel")}
                      </button>
                      <button
                        type="submit"
                        disabled={savingDigital}
                        style={{
                          padding: "0.6rem 1.25rem",
                          borderRadius: 10,
                          border: "none",
                          background: "var(--text)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          cursor: savingDigital ? "wait" : "pointer",
                        }}
                      >
                        {savingDigital ? t("submitting") : t("finalizeSubmit")}
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
                    background: "var(--surface)",
                    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)" }}>
                      ASSET REPOSITORY
                    </div>
                    <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>
                      Upload technical specs
                    </h2>
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.45 }}>
                      PDF, Office, CAD, images, archives — max 25 MB per file.
                    </p>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                    {t("titleOptionalLabel")}
                    <input
                      value={titleFile}
                      onChange={(e) => setTitleFile(e.target.value)}
                      maxLength={500}
                      placeholder={t("defaultsToFileName")}
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
                        border: `2px dashed ${assetDragActive ? "var(--text)" : "#cbd5e1"}`,
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
                          background: "var(--surface)",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          color: "var(--text)",
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
                        background: "var(--surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>{t("queuedAttachment")}</div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                          color: "var(--muted)",
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
                    <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>{fileMsg}</p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={savingFile}
                    style={{
                      marginTop: "auto",
                      padding: "0.6rem 1rem",
                      borderRadius: 10,
                      border: "1px solid var(--text)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: savingFile ? "wait" : "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    {savingFile ? t("uploading") : t("uploadToProject")}
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
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)" }}>{t("submissionLog")}</div>
                  <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>
                    Project submission history
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToSection("drafting-section")}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--text)",
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
                  background: "var(--surface)",
                  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)",
                  overflow: "auto",
                }}
              >
                {loading ? (
                  <p style={{ margin: 0, padding: "1.25rem", color: "var(--muted)" }}>{t("loading")}</p>
                ) : error ? (
                  <p style={{ margin: 0, padding: "1.25rem", color: "#b91c1c" }}>{error}</p>
                ) : reports.length === 0 ? (
                  <p style={{ margin: 0, padding: "1.25rem", color: "var(--muted)" }}>
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
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{t("colReference")}</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--muted)" }}>{t("colTitle")}</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{t("colStatus")}</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{t("colSubmitted")}</th>
                        <th style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{t("colActions")}</th>
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
                              background: i % 2 === 0 ? "var(--surface)" : "var(--soft)",
                            }}
                          >
                            <td style={{ padding: "0.75rem 1rem", fontFamily: "ui-monospace, monospace", color: "#475569", whiteSpace: "nowrap" }}>
                              {r.id.slice(0, 8)}…
                            </td>
                            <td style={{ padding: "0.75rem 1rem", maxWidth: 360 }}>
                              <div style={{ fontWeight: 600, color: "var(--text)" }} title={r.title}>
                                {r.title.length > 80 ? `${r.title.slice(0, 80)}…` : r.title}
                              </div>
                              {selectedProject?.location ? (
                                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{selectedProject.location}</div>
                              ) : null}
                              {r.body ? (
                                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>
                                  {htmlToPlainPreview(r.body, 120)}
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
                                {t(st.statusKey)}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem 1rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatWhen(r.createdAt, intlLocale)}</td>
                            <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                                {r.fileStorageKey ? (
                                  <>
                                    <ActionIconLink
                                      href={reportFileUrl(projectId, r.id)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      label={tCommon("open")}
                                    >
                                      <IconEye />
                                    </ActionIconLink>
                                    <ActionIconLink
                                      href={reportFileUrl(projectId, r.id)}
                                      download={r.fileOriginalName ?? undefined}
                                      label={tCommon("download")}
                                    >
                                      <IconDownload />
                                    </ActionIconLink>
                                  </>
                                ) : null}
                                {r.photos && r.photos.length > 0
                                  ? r.photos.map((p, idx) => (
                                      <ActionIconLink
                                        key={p.id}
                                        href={reportPhotoUrl(projectId, r.id, p.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        label={`${tCommon("open")}: ${p.fileOriginalName}`}
                                      >
                                        <IconEye />
                                      </ActionIconLink>
                                    ))
                                  : null}
                                {!r.fileStorageKey && (!r.photos || r.photos.length === 0) ? (
                                  <span style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>{tCommon("emDash")}</span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => openEdit(r)}
                                  style={{
                                    fontSize: "0.82rem",
                                    fontWeight: 600,
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: 999,
                                    border: "1px solid var(--border)",
                                    background: "var(--surface)",
                                    cursor: "pointer",
                                    color: "var(--text)",
                                  }}
                                >
                                  {tCommon("edit")}
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
              maxWidth: 620,
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
              {t("editReport")}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                {t("titleLabel")}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t("contentOptional")}</span>
                <RichTextEditor
                  aria-label={t("reportContentAria")}
                  value={editBody}
                  onChange={setEditBody}
                  disabled={editSaving}
                  minHeight={200}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--muted, var(--muted))" }}>
                  Leave empty if this report is file-only. Use bold, italic, and size after selecting text.
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem", flex: "1 1 140px" }}>
                  {t("statusLabel")}
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
                    <option value="in_review">{t("statusInReview")}</option>
                    <option value="action_required">{t("statusActionRequired")}</option>
                    <option value="approved">{t("statusApproved")}</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem", flex: "1 1 180px" }}>
                  {t("dueOptionalShort")}
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
                {editing.fileStorageKey ? t("replaceAttachment") : t("addAttachment")}
                <input
                  type="file"
                  accept={FILE_INPUT_ACCEPT}
                  onChange={(e) => setEditNewFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: "0.9rem" }}
                />
              </label>
              {editing.photos && editing.photos.length > 0 ? (
                <div style={{ fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("savedPhotos")}</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {editing.photos.map((p) => (
                      <li
                        key={p.id}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}
                      >
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.fileOriginalName}
                        </span>
                        <ActionIconLink
                          href={reportPhotoUrl(projectId, editing.id, p.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          label={tCommon("open")}
                        >
                          <IconEye />
                        </ActionIconLink>
                        <ActionIconButton
                          label={tCommon("delete")}
                          variant="danger"
                          disabled={editSaving}
                          onClick={() => void removeExistingPhoto(p.id)}
                        >
                          <IconTrash />
                        </ActionIconButton>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
                Add more photos (optional)
                <input
                  type="file"
                  accept={PICTURE_INPUT_ACCEPT}
                  multiple
                  onChange={(e) => {
                    const list = e.target.files;
                    if (!list?.length) return;
                    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
                    setEditNewPhotos((prev) => [...prev, ...imgs].slice(0, 30));
                    e.target.value = "";
                  }}
                  style={{ fontSize: "0.9rem" }}
                />
              </label>
              {editNewPhotos.length > 0 ? (
                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  {editNewPhotos.length} new photo{editNewPhotos.length === 1 ? "" : "s"} queued
                  {" · "}
                  <button
                    type="button"
                    onClick={() => setEditNewPhotos([])}
                    style={{
                      border: "none",
                      background: "none",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
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
                  {editSaving ? tCommon("saving") : t("saveChanges")}
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
                  {tCommon("cancel")}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function ReportingSuspenseFallback() {
  const t = useTranslations("Reporting");
  return (
    <DashboardShell user={null}>
      <p style={{ padding: "1.5rem", color: "var(--muted)" }}>{t("loadingPage")}</p>
    </DashboardShell>
  );
}

export default function ReportingPage() {
  return (
    <Suspense fallback={<ReportingSuspenseFallback />}>
      <ReportingPageContent />
    </Suspense>
  );
}

