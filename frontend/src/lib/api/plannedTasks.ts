import { apiFetch } from "./client";

export type PlannedTaskStatus =
  | "planned"
  | "in_progress"
  | "pending_approval"
  | "scheduled"
  | "completed";

export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface PlanningTask {
  id: string;
  projectId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  phaseLabel: string | null;
  taskStatus: PlannedTaskStatus;
  priority: TaskPriority;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningListResponse {
  tasks: PlanningTask[];
  range: { start: string; end: string };
}

/** All milestones/tasks for a project (no date filter). Backend: `?scope=all`. */
export async function fetchPlanningTasksAll(projectId: string): Promise<PlanningTask[] | null> {
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/planned-tasks?scope=all`,
    { cache: "no-store" },
  );
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json()) as { tasks: PlanningTask[] };
  return json.tasks;
}

export async function fetchPlanningTasks(
  projectId: string,
  start: Date,
  end: Date,
): Promise<PlanningListResponse | null> {
  const sp = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/planned-tasks?${sp}`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as PlanningListResponse;
}

export interface CreatePlanningTaskPayload {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  phaseLabel?: string | null;
  taskStatus?: PlannedTaskStatus;
  priority?: TaskPriority;
  sortOrder?: number;
}

export async function createPlanningTask(
  projectId: string,
  payload: CreatePlanningTaskPayload,
): Promise<{ ok: true; task: PlanningTask } | { ok: false; status: number }> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/planned-tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, task: json as PlanningTask };
}

export type UpdatePlanningTaskPayload = {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string | null;
  phaseLabel?: string | null;
  taskStatus?: PlannedTaskStatus;
  priority?: TaskPriority;
  sortOrder?: number;
};

export async function updatePlanningTask(
  projectId: string,
  taskId: string,
  payload: UpdatePlanningTaskPayload,
): Promise<{ ok: true; task: PlanningTask } | { ok: false; status: number }> {
  const res = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}/planned-tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, task: json as PlanningTask };
}
