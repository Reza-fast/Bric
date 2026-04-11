import type { Pool } from "pg";
import type { User, UserCreateInput, UserUpdateInput } from "../domain/index.js";
import { UserRole } from "../domain/index.js";

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  password_hash?: string | null;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UsersRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, role, avatar_url, created_at, updated_at FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findByEmailWithHash(
    email: string,
  ): Promise<{ user: User; passwordHash: string | null } | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, role, avatar_url, created_at, updated_at, password_hash
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()],
    );
    const row = rows[0];
    if (!row) return null;
    const user = mapUser({
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: row.role,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    return { user, passwordHash: row.password_hash ?? null };
  }

  async create(input: UserCreateInput): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, display_name, role, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, avatar_url, created_at, updated_at`,
      [
        input.email,
        input.displayName,
        input.role,
        input.avatarUrl ?? null,
      ],
    );
    return mapUser(rows[0]!);
  }

  async createWithPasswordHash(input: {
    email: string;
    displayName: string;
    role: UserRole;
    passwordHash: string;
    avatarUrl?: string | null;
  }): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, display_name, role, avatar_url, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, display_name, role, avatar_url, created_at, updated_at`,
      [
        input.email.trim().toLowerCase(),
        input.displayName,
        input.role,
        input.avatarUrl ?? null,
        input.passwordHash,
      ],
    );
    return mapUser(rows[0]!);
  }

  async update(id: string, input: UserUpdateInput): Promise<User | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const displayName = input.displayName ?? existing.displayName;
    const role = input.role ?? existing.role;
    const avatarUrl =
      input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl;
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users SET display_name = $2, role = $3, avatar_url = $4, updated_at = now()
       WHERE id = $1
       RETURNING id, email, display_name, role, avatar_url, created_at, updated_at`,
      [id, displayName, role, avatarUrl],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  /** For password change: returns user + hash (hash may be null for legacy rows). */
  async findCredentialsById(id: string): Promise<{ user: User; passwordHash: string | null } | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, role, avatar_url, created_at, updated_at, password_hash
       FROM users WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const user = mapUser({
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: row.role,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    return { user, passwordHash: row.password_hash ?? null };
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `UPDATE users SET password_hash = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, email, display_name, role, avatar_url, created_at, updated_at`,
      [id, passwordHash],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }
}
