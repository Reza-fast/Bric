import type { ReportStatus } from "./enums.js";

export interface Report {
  id: string;
  projectId: string;
  title: string;
  status: ReportStatus;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportCreateInput = Pick<Report, "projectId" | "title" | "status"> & {
  dueAt?: Date | null;
};
