export interface TimeLog {
  id: string;
  projectId: string;
  userId: string;
  durationHours: number;
  loggedAt: Date;
  note: string | null;
  createdAt: Date;
}

export type TimeLogCreateInput = Pick<
  TimeLog,
  "projectId" | "userId" | "durationHours"
> & {
  loggedAt?: Date;
  note?: string | null;
};
