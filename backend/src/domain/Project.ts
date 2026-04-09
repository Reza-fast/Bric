import type { ProjectStatus } from "./enums.js";

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  budgetedHours: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectCreateInput = Pick<
  Project,
  "name" | "slug" | "status" | "budgetedHours"
> & {
  description?: string | null;
};

export type ProjectUpdateInput = Partial<
  Pick<Project, "name" | "status" | "budgetedHours" | "description">
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
