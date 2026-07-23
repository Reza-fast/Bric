import { signAccessToken } from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { isStrongPassword, STRONG_PASSWORD_HINT } from "../auth/passwordPolicy.js";
import { config } from "../config.js";
import type { User } from "../domain/index.js";
import { UserRole } from "../domain/index.js";
import { ProjectMembersRepository } from "../repositories/projectMembers.repository.js";
import { UsersRepository } from "../repositories/users.repository.js";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "EMAIL_IN_USE" | "INVALID_CREDENTIALS" | "WEAK_PASSWORD",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthTokens {
  accessToken: string;
  user: User;
}

export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly members: ProjectMembersRepository,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
  }): Promise<AuthTokens> {
    if (!isStrongPassword(input.password)) {
      throw new AuthError(STRONG_PASSWORD_HINT, "WEAK_PASSWORD");
    }
    const existing = await this.users.findByEmailWithHash(input.email);
    if (existing) {
      throw new AuthError("Email already registered", "EMAIL_IN_USE");
    }
    const passwordHash = await hashPassword(input.password, config.bcryptRounds);
    const user = await this.users.createWithPasswordHash({
      email: input.email,
      displayName: input.displayName,
      role: input.role ?? UserRole.Contractor,
      passwordHash,
      avatarUrl: null,
    });
    await this.members.addUserToPortfolioSeedProjects(user.id);
    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user };
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const row = await this.users.findByEmailWithHash(email);
    if (!row?.passwordHash) {
      throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
    }
    const ok = await verifyPassword(password, row.passwordHash);
    if (!ok) {
      throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
    }
    const accessToken = await signAccessToken({
      sub: row.user.id,
      email: row.user.email,
      role: row.user.role,
    });
    await this.members.addUserToPortfolioSeedProjects(row.user.id);
    return { accessToken, user: row.user };
  }

  async me(userId: string): Promise<User | null> {
    return this.users.findById(userId);
  }
}
