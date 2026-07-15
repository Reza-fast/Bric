import { apiFetch } from "./client";

export interface TechnicalPlan {
  id: string;
  projectId: string;
  title: string;
  fileOriginalName: string;
  fileStorageKey: string;
  fileMimeType: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  projectName?: string;
}

export const TECHNICAL_PLAN_INPUT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.svg,.heic,.heif,.txt,.csv,.zip,.rar,.7z,.dwg,.dxf";

export function technicalPlanFileUrl(projectId: string, planId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/technical-plans/${encodeURIComponent(planId)}/file`;
}

export async function fetchTechnicalPlans(projectId?: string): Promise<TechnicalPlan[] | null> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const res = await apiFetch(`/api/technical-plans${qs}`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { plans: TechnicalPlan[] };
  return data.plans;
}

export async function fetchProjectTechnicalPlans(projectId: string): Promise<TechnicalPlan[] | null> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/technical-plans`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { plans: TechnicalPlan[] };
  return data.plans;
}

export async function uploadTechnicalPlan(
  projectId: string,
  file: File,
  title?: string,
): Promise<{ ok: true; plan: TechnicalPlan } | { ok: false; status: number }> {
  const fd = new FormData();
  fd.append("file", file);
  if (title?.trim()) fd.append("title", title.trim());
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/technical-plans/upload`, {
    method: "POST",
    body: fd,
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, plan: json as TechnicalPlan };
}

export async function deleteTechnicalPlan(
  projectId: string,
  planId: string,
): Promise<boolean> {
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/technical-plans/${encodeURIComponent(planId)}`,
    { method: "DELETE" },
  );
  return res.status === 204;
}

export function canOpenInline(mime: string | null, fileName: string): boolean {
  const m = mime?.toLowerCase() ?? "";
  if (m.startsWith("image/") || m === "application/pdf") return true;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext === "pdf" || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
}
