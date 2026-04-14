import type { ReportStatus } from "./enums.js";

export interface Report {
  id: string;
  projectId: string;
  title: string;
  status: ReportStatus;
  dueAt: Date | null;
  /** Plain text or markdown-style content for reports created in the app. */
  body: string | null;
  /** Original filename for uploaded file attachments. */
  fileOriginalName: string | null;
  /** Path relative to `uploadDir`, e.g. `reports/<id>.pdf`. */
  fileStorageKey: string | null;
  /** Stored MIME type for serving (optional; falls back to extension guess). */
  fileMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportCreateInput = {
  /** When set, used as the row id (required for files named after the report). */
  id?: string;
  projectId: string;
  title: string;
  status: ReportStatus;
  dueAt?: Date | null;
  body: string | null;
  fileOriginalName: string | null;
  fileStorageKey: string | null;
  fileMimeType: string | null;
};

export type ReportPatchInput = {
  title?: string;
  body?: string | null;
  status?: ReportStatus;
  dueAt?: Date | null;
  fileOriginalName?: string | null;
  fileStorageKey?: string | null;
  fileMimeType?: string | null;
};
