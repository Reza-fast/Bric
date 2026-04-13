import type { PlannedTaskStatus, TaskPriority } from "./enums.js";

export interface PlannedTask {
  id: string;
  projectId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  phaseLabel: string | null;
  taskStatus: PlannedTaskStatus;
  priority: TaskPriority;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PlannedTaskCreateInput = Pick<PlannedTask, "projectId" | "title" | "startsAt" | "endsAt"> & {
  location?: string | null;
  phaseLabel?: string | null;
  taskStatus?: PlannedTaskStatus;
  priority?: TaskPriority;
  sortOrder?: number;
};

export type PlannedTaskUpdateInput = Partial<
  Pick<
    PlannedTask,
    "title" | "startsAt" | "endsAt" | "location" | "phaseLabel" | "taskStatus" | "priority" | "sortOrder"
  >
>;
