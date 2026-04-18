export interface TimeLog {
  id: string;
  /** `null` = day-level clock (timer); otherwise hours allocated to a project. */
  projectId: string | null;
  userId: string;
  durationHours: number;
  loggedAt: Date;
  note: string | null;
  createdAt: Date;
}

export type TimeLogCreateInput = Pick<TimeLog, "userId" | "durationHours"> & {
  projectId: string | null;
  loggedAt?: Date;
  note?: string | null;
};
