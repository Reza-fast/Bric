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
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async create(input: UserCreateInput): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, display_name, role, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        input.email,
        input.displayName,
        input.role,
        input.avatarUrl ?? null,
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
       RETURNING *`,
      [id, displayName, role, avatarUrl],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }
}

