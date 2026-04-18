/** App + project roles. HR is for directory, invites, and org-wide time oversight. */
export enum UserRole {
  Hr = "hr",
  Architect = "architect",
  Contractor = "contractor",
  Subcontractor = "subcontractor",
  Client = "client",
}

export enum ProjectStatus {
  Active = "active",
  Inactive = "inactive",
  Completed = "completed",
  Planning = "planning",
  Critical = "critical",
}

export enum ActivityType {
  BlueprintApproval = "blueprint_approval",
  PhotoUpload = "photo_upload",
  ReportSubmitted = "report_submitted",
  Milestone = "milestone",
  Comment = "comment",
}

export enum ReportStatus {
  ActionRequired = "action_required",
  InReview = "in_review",
  Approved = "approved",
}

/** Row on the technical planning timeline. */
export enum PlannedTaskStatus {
  Planned = "planned",
  InProgress = "in_progress",
  PendingApproval = "pending_approval",
  Scheduled = "scheduled",
  Completed = "completed",
}

export enum TaskPriority {
  Low = "low",
  Normal = "normal",
  High = "high",
  Critical = "critical",
}
