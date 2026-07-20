import { apiFetch } from "./client";

export type PersonnelProjectBreakdown = {
  projectId: string;
  name: string;
  hours: number;
};

export type PersonnelMonthBreakdown = {
  /** UTC calendar month as `YYYY-MM`. */
  monthKey: string;
  hours: number;
};

export type PersonnelAnalysisPerson = {
  userId: string;
  name: string;
  email: string;
  clockHours: number;
  projectHours: number;
  totalHours: number;
  projects: PersonnelProjectBreakdown[];
  months: PersonnelMonthBreakdown[];
};

export type PersonnelAnalysisPayload = {
  from: string;
  to: string;
  people: PersonnelAnalysisPerson[];
};

/** HR-only aggregated hours overview (last 6 months by default on the server). */
export async function fetchPersonnelAnalysis(
  from?: Date,
  to?: Date,
): Promise<PersonnelAnalysisPayload | null> {
  const params = new URLSearchParams();
  if (from) params.set("from", from.toISOString());
  if (to) params.set("to", to.toISOString());
  const qs = params.toString();
  const res = await apiFetch(`/api/time-logs/personnel-analysis${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  return (await res.json()) as PersonnelAnalysisPayload;
}

export function personnelAnalysisToCsv(people: PersonnelAnalysisPerson[]): string {
  const header = ["name", "email", "totalHours", "project", "projectHours", "month", "monthHours"];
  const lines = [header.join(",")];
  for (const person of people) {
    const name = `"${person.name.replaceAll('"', '""')}"`;
    const email = `"${person.email.replaceAll('"', '""')}"`;
    if (person.projects.length === 0 && person.months.length === 0) {
      lines.push([name, email, String(person.totalHours), "", "", "", ""].join(","));
      continue;
    }
    const max = Math.max(person.projects.length, person.months.length, 1);
    for (let i = 0; i < max; i++) {
      const proj = person.projects[i];
      const month = person.months[i];
      lines.push(
        [
          name,
          email,
          i === 0 ? String(person.totalHours) : "",
          proj ? `"${proj.name.replaceAll('"', '""')}"` : "",
          proj ? String(proj.hours) : "",
          month ? month.monthKey : "",
          month ? String(month.hours) : "",
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

export function formatMonthKey(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
