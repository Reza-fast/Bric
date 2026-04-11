import { hashPassword, verifyPassword } from "../auth/password.js";
import { config } from "../config.js";
import type { User, UserUpdateInput } from "../domain/index.js";
import { UsersRepository } from "../repositories/users.repository.js";

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USER_NOT_FOUND"
      | "NO_PASSWORD_SET"
      | "INVALID_CURRENT_PASSWORD"
      | "WEAK_PASSWORD"
      | "CURRENT_PASSWORD_REQUIRED",
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

export class ProfileService {
  constructor(private readonly users: UsersRepository) {}

  /**
   * Updates profile fields and/or password. Password change runs first (all-or-nothing semantics for password).
   */
  async updateMe(
    userId: string,
    input: {
      displayName?: string;
      avatarUrl?: string | null;
      currentPassword?: string;
      newPassword?: string;
    },
  ): Promise<User | null> {
    const wantsPassword = Boolean(input.newPassword || input.currentPassword);
    if (wantsPassword) {
      if (!input.newPassword || !input.currentPassword) {
        throw new ProfileError(
          "Both currentPassword and newPassword are required to change password",
          "CURRENT_PASSWORD_REQUIRED",
        );
      }
      if (input.newPassword.length < 10) {
        throw new ProfileError("Password must be at least 10 characters", "WEAK_PASSWORD");
      }
      const row = await this.users.findCredentialsById(userId);
      if (!row) {
        throw new ProfileError("User not found", "USER_NOT_FOUND");
      }
      if (!row.passwordHash) {
        throw new ProfileError("Password login is not set for this account", "NO_PASSWORD_SET");
      }
      const ok = await verifyPassword(input.currentPassword, row.passwordHash);
      if (!ok) {
        throw new ProfileError("Current password is incorrect", "INVALID_CURRENT_PASSWORD");
      }
      const nextHash = await hashPassword(input.newPassword, config.bcryptRounds);
      await this.users.updatePasswordHash(userId, nextHash);
    }

    const patch: UserUpdateInput = {};
    if (input.displayName !== undefined) {
      patch.displayName = input.displayName;
    }
    if (input.avatarUrl !== undefined) {
      patch.avatarUrl = input.avatarUrl;
    }
    if (Object.keys(patch).length > 0) {
      return this.users.update(userId, patch);
    }
    return this.users.findById(userId);
  }
}
