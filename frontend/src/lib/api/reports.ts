import { apiFetch } from "./client";

export type ReportStatus = "action_required" | "in_review" | "approved";

export interface ReportPhotoEntry {
  id: string;
  fileOriginalName: string;
  fileMimeType: string | null;
  createdAt: string;
}

export interface ProjectReport {
  id: string;
  projectId: string;
  title: string;
  status: ReportStatus;
  dueAt: string | null;
  body: string | null;
  fileOriginalName: string | null;
  fileStorageKey: string | null;
  fileMimeType: string | null;
  /** Gallery images attached to this report (separate from the single legacy file slot). */
  photos?: ReportPhotoEntry[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchProjectReports(projectId: string): Promise<ProjectReport[] | null> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/reports`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { reports: ProjectReport[] };
  return data.reports;
}

export async function createDigitalReport(
  projectId: string,
  payload: { title: string; body: string; status?: ReportStatus; dueAt?: string | null },
): Promise<{ ok: true; report: ProjectReport } | { ok: false; status: number }> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/reports`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, report: json as ProjectReport };
}

export async function updateReport(
  projectId: string,
  reportId: string,
  patch: {
    title?: string;
    body?: string | null;
    status?: ReportStatus;
    dueAt?: string | null;
  },
): Promise<{ ok: true; report: ProjectReport } | { ok: false; status: number }> {
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, report: json as ProjectReport };
}

/** Upload a new report that is a single file (PDF, Word, images, etc.). */
export async function uploadReportFile(
  projectId: string,
  file: File,
  title?: string,
): Promise<{ ok: true; report: ProjectReport } | { ok: false; status: number }> {
  const fd = new FormData();
  fd.append("file", file);
  if (title?.trim()) fd.append("title", title.trim());
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/reports/upload`, {
    method: "POST",
    body: fd,
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, report: json as ProjectReport };
}

/** Upload one or more images to a report’s photo gallery (max 30 files, 25 MB each). */
export async function uploadReportPhotos(
  projectId: string,
  reportId: string,
  files: File[],
): Promise<{ ok: true; report: ProjectReport } | { ok: false; status: number }> {
  if (files.length === 0) return { ok: false, status: 400 };
  const fd = new FormData();
  for (const f of files) {
    fd.append("files", f);
  }
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/photos`,
    {
      method: "POST",
      body: fd,
    },
  );
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  const body = json as { report?: ProjectReport };
  if (!body.report) return { ok: false, status: 500 };
  return { ok: true, report: body.report };
}

/** Add or replace the file attachment on an existing report. */
export async function replaceReportAttachment(
  projectId: string,
  reportId: string,
  file: File,
): Promise<{ ok: true; report: ProjectReport } | { ok: false; status: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/attachment`,
    {
      method: "PATCH",
      body: fd,
    },
  );
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, report: json as ProjectReport };
}

export function reportFileUrl(projectId: string, reportId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/file`;
}

export function reportPhotoUrl(projectId: string, reportId: string, photoId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(photoId)}/file`;
}

export async function deleteReportPhoto(
  projectId: string,
  reportId: string,
  photoId: string,
): Promise<{ ok: true; report: ProjectReport } | { ok: false; status: number }> {
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  );
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  const body = json as { report?: ProjectReport };
  if (!body.report) return { ok: false, status: 500 };
  return { ok: true, report: body.report };
}
