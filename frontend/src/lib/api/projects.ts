import { apiFetch } from "./client";

export type ProjectStatus =
  | "active"
  | "inactive"
  | "completed"
  | "planning"
  | "critical";

export interface ProjectPortfolioCard {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  budgetedHours: number;
  hourlyWage: number | null;
  description: string | null;
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
  logoOriginalName: string | null;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  createdAt: string;
  updatedAt: string;
  actualHours: number;
  hoursPercentUsed: number;
  isOverBudget: boolean;
}

export function projectHasLogo(project: { logoStorageKey?: string | null }): boolean {
  return Boolean(project.logoStorageKey);
}

/** Authenticated same-origin URL for project cover/logo (append updatedAt for cache busting). */
export function projectLogoUrl(projectId: string, cacheKey?: string | null): string {
  const base = `/api/projects/${encodeURIComponent(projectId)}/logo/file`;
  if (!cacheKey) return base;
  return `${base}?v=${encodeURIComponent(cacheKey)}`;
}

export async function fetchProjectPortfolio(): Promise<ProjectPortfolioCard[] | null> {
  try {
    const res = await apiFetch("/api/projects", { cache: "no-store" });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as ProjectPortfolioCard[];
  } catch {
    return null;
  }
}

/** Response from POST /api/projects (same shape as portfolio row without hours rollup). */
export interface CreatedProject {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  budgetedHours: number;
  hourlyWage: number | null;
  description: string | null;
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
  logoOriginalName: string | null;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  slug: string;
  status?: ProjectStatus;
  budgetedHours: number;
  hourlyWage?: number | null;
  description?: string | null;
  location?: string | null;
  completionPercent?: number;
  portfolioLeadName?: string | null;
}

export type CreateProjectError =
  | { error: "VALIDATION_ERROR"; details: unknown }
  | { error: "SLUG_IN_USE"; message?: string }
  | { error: string; message?: string };

export async function createProject(
  payload: CreateProjectPayload,
): Promise<{ ok: true; project: CreatedProject } | { ok: false; status: number; body: CreateProjectError }> {
  const res = await apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, body: json as CreateProjectError };
  }
  return { ok: true, project: json as CreatedProject };
}

/** GET /api/projects/:id — same JSON shape as create response (no hours rollup). */
export type ProjectDetail = CreatedProject;

export async function fetchProject(id: string): Promise<{ ok: true; project: ProjectDetail } | { ok: false; status: number }> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true, project: json as ProjectDetail };
}

export type UpdateProjectPayload = {
  name: string;
  status: ProjectStatus;
  budgetedHours: number;
  hourlyWage: number | null;
  description: string | null;
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
};

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<{ ok: true; project: ProjectDetail } | { ok: false; status: number; body: CreateProjectError }> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, body: json as CreateProjectError };
  }
  return { ok: true, project: json as ProjectDetail };
}

export const LOGO_INPUT_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff,image/svg+xml,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif";

export async function uploadProjectLogo(
  projectId: string,
  file: File,
): Promise<{ ok: true; project: ProjectDetail } | { ok: false; status: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/logo`, {
    method: "POST",
    body: fd,
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, project: json as ProjectDetail };
}

export async function deleteProjectLogo(
  projectId: string,
): Promise<{ ok: true; project: ProjectDetail } | { ok: false; status: number }> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/logo`, {
    method: "DELETE",
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, project: json as ProjectDetail };
}
