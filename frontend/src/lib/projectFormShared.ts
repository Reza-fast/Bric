import type { CSSProperties } from "react";
import type { ProjectStatus } from "@/lib/api/projects";

export function formatLaborBudget(
  hours: number,
  hourlyWage: number | null | undefined,
  locale = "nl-BE",
): string | null {
  if (hourlyWage == null || !Number.isFinite(hourlyWage) || hourlyWage < 0) return null;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    hours * hourlyWage,
  );
}

export function computeLaborBudget(hours: number, hourlyWage: number | null | undefined): number | null {
  if (hourlyWage == null || !Number.isFinite(hourlyWage) || hourlyWage < 0) return null;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return hours * hourlyWage;
}

export function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return s.length > 0 ? s : "project";
}

/** Status option order for create/edit forms. Pass `useTranslations("Status")`. */
export function getStatusOptions(t: (key: string) => string): { value: ProjectStatus; label: string; hint: string }[] {
  return [
    { value: "planning", label: t("planning"), hint: t("planningHint") },
    { value: "active", label: t("active"), hint: t("activeHint") },
    { value: "critical", label: t("critical"), hint: t("criticalHint") },
    { value: "inactive", label: t("inactive"), hint: t("inactiveHint") },
    { value: "completed", label: t("completed"), hint: t("completedHint") },
  ];
}

export const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text)",
};

export const hintStyle: CSSProperties = {
  fontWeight: 400,
  color: "var(--muted)",
  fontSize: "0.78rem",
  lineHeight: 1.4,
};

export const inputStyle: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  fontSize: "1rem",
  background: "var(--surface)",
  color: "var(--text)",
};

export const sectionStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "1.35rem 1.5rem",
  background: "var(--surface)",
  marginBottom: "1.25rem",
};

export const sectionTitle: CSSProperties = {
  margin: "0 0 0.15rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--muted)",
};

export const sectionHeading: CSSProperties = {
  margin: "0 0 1.1rem",
  fontSize: "1.1rem",
  fontWeight: 700,
};
