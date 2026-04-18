import { apiFetch } from "./client";

export interface TimeLogRow {
  id: string;
  projectId: string | null;
  projectName?: string;
  userId: string;
  /** Present when the viewer is HR (org-wide list). */
  ownerEmail?: string;
  ownerDisplayName?: string;
  durationHours: number;
  loggedAt: string;
  note: string | null;
  createdAt: string;
}

export async function fetchTimeLogs(from: Date, to: Date): Promise<TimeLogRow[] | null> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await apiFetch(`/api/time-logs?${params}`, { cache: "no-store" });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { logs: TimeLogRow[] };
  return data.logs;
}

export async function createTimeLog(payload: {
  projectId: string | null;
  durationHours: number;
  loggedAt?: string;
  note?: string | null;
}): Promise<
  | { ok: true; log: TimeLogRow }
  | { ok: false; status: number; error?: string }
> {
  const res = await apiFetch("/api/time-logs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, status: res.status, error: json.error };
  return { ok: true, log: json as TimeLogRow };
}

export async function deleteTimeLog(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/time-logs/${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.status === 204;
}
