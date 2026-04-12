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
