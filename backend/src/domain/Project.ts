import type { ProjectStatus } from "./enums.js";

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  budgetedHours: number;
  /** Hourly labor rate; null when not set. */
  hourlyWage: number | null;
  description: string | null;
  /** Set after portfolio migration; null/0 when absent. */
  location: string | null;
  completionPercent: number;
  portfolioLeadName: string | null;
  logoOriginalName: string | null;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectCreateInput = Pick<
  Project,
  "name" | "slug" | "status" | "budgetedHours"
> & {
  description?: string | null;
  location?: string | null;
  completionPercent?: number;
  portfolioLeadName?: string | null;
  hourlyWage?: number | null;
};

export type ProjectUpdateInput = Partial<
  Pick<
    Project,
    | "name"
    | "status"
    | "budgetedHours"
    | "description"
    | "location"
    | "completionPercent"
    | "portfolioLeadName"
    | "hourlyWage"
    | "logoOriginalName"
    | "logoStorageKey"
    | "logoMimeType"
  >
>;

/** Hours used vs budget for dashboard bars. */
export interface ProjectHoursSummary {
  projectId: string;
  name: string;
  budgetedHours: number;
  actualHours: number;
  percentUsed: number;
  isOverBudget: boolean;
}

/** Project + hours rollup for portfolio / registry UI. */
export type ProjectPortfolioCard = Project & {
  actualHours: number;
  hoursPercentUsed: number;
  isOverBudget: boolean;
};
