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
  description: string | null;
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
  createdAt: string;
  updatedAt: string;
  actualHours: number;
  hoursPercentUsed: number;
  isOverBudget: boolean;
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
  description: string | null;
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  slug: string;
  status?: ProjectStatus;
  budgetedHours: number;
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
