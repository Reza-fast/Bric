import type { ActivityType } from "./enums.js";

export interface Activity {
  id: string;
  projectId: string;
  type: ActivityType;
  title: string;
  body: string | null;
  /** Optional image URLs for photo-style feed items.!! */
  mediaUrls: string[];
  actorUserId: string | null;
  createdAt: Date;
}

export type ActivityCreateInput = Pick<
  Activity,
  "projectId" | "type" | "title"
> & {
  body?: string | null;
  mediaUrls?: string[];
  actorUserId?: string | null;
};
