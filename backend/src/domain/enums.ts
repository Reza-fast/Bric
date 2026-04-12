/** Roles that can participate in a construction project. */
export enum UserRole {
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
