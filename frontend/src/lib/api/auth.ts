import type { UserRole } from "./roles";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function loginRequest(email: string, password: string): Promise<{ user: AuthUser }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "LOGIN_FAILED");
  }
  return (await res.json()) as { user: AuthUser };
}

export async function registerRequest(input: {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}): Promise<{ user: AuthUser }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (body.error === "EMAIL_IN_USE") {
      throw new Error("That email is already registered.");
    }
    throw new Error(body.message ?? body.error ?? "REGISTER_FAILED");
  }
  return (await res.json()) as { user: AuthUser };
}

export async function logoutRequest(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function meRequest(): Promise<{ user: AuthUser } | null> {
  const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as { user: AuthUser };
}

export type PatchMeInput = {
  displayName?: string;
  avatarUrl?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

export async function patchMeRequest(input: PatchMeInput): Promise<{ user: AuthUser }> {
  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message ?? body.error ?? "UPDATE_FAILED");
  }
  return (await res.json()) as { user: AuthUser };
}
