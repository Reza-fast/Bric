export interface PlannedTask {
  id: string;
  projectId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PlannedTaskCreateInput = Pick<
  PlannedTask,
  "projectId" | "title" | "startsAt" | "endsAt"
> & {
  location?: string | null;
};
