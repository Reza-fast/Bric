import type { UserRole } from "./enums.js";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserCreateInput = Pick<User, "email" | "displayName" | "role"> & {
  avatarUrl?: string | null;
};

export type UserUpdateInput = Partial<
  Pick<User, "displayName" | "role" | "avatarUrl">
>;
