import type { CSSProperties } from "react";
import type { ProjectStatus } from "@/lib/api/projects";

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

export const statusOptions: { value: ProjectStatus; label: string; hint: string }[] = [
  { value: "planning", label: "Planning", hint: "Design and permits in progress" },
  { value: "active", label: "Active", hint: "Work underway on site" },
  { value: "critical", label: "Critical", hint: "Escalated risk or budget pressure" },
  { value: "inactive", label: "Inactive", hint: "Paused or on hold" },
  { value: "completed", label: "Completed", hint: "Handover or closed out" },
];

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
