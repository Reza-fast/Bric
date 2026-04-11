"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest, patchMeRequest } from "@/lib/api/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await meRequest();
      if (cancelled) return;
      if (!me) {
        router.replace("/login?from=/profile");
        return;
      }
      setUser(me.user);
      setDisplayName(me.user.displayName);
      setAvatarUrl(me.user.avatarUrl ?? "");
      setBoot(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const wantsPassword = newPassword.length > 0 || currentPassword.length > 0;
    if (wantsPassword) {
      if (newPassword.length < 10) {
        setError("New password must be at least 10 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
      if (!currentPassword) {
        setError("Enter your current password to set a new one.");
        return;
      }
    }

    const payload: Parameters<typeof patchMeRequest>[0] = {};
    if (displayName.trim() !== user?.displayName) {
      payload.displayName = displayName.trim();
    }
    const trimmedAvatar = avatarUrl.trim();
    const prevAvatar = user?.avatarUrl ?? "";
    if (trimmedAvatar !== prevAvatar) {
      payload.avatarUrl = trimmedAvatar === "" ? null : trimmedAvatar;
    }
    if (wantsPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      setError("No changes to save.");
      return;
    }

    setLoading(true);
    try {
      const { user: next } = await patchMeRequest(payload);
      setUser(next);
      setDisplayName(next.displayName);
      setAvatarUrl(next.avatarUrl ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Profile saved.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      if (msg === "INVALID_CURRENT_PASSWORD") {
        setError("Current password is incorrect.");
      } else if (msg === "NO_PASSWORD_SET") {
        setError("This account has no password set; contact support.");
      } else if (msg === "WEAK_PASSWORD") {
        setError("Password must be at least 10 characters.");
      } else if (msg === "CURRENT_PASSWORD_REQUIRED") {
        setError("Enter both current and new password to change password.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (boot || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading…</div>
    );
  }

  return (
    <DashboardShell user={user}>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/dashboard" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to dashboard
        </Link>
      </p>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.35rem" }}>Your profile</h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--muted)", maxWidth: 520, fontSize: "0.9rem" }}>
        Update how you appear in BRIC. Email cannot be changed here. After saving, your session cookie is refreshed
        automatically.
      </p>

      <form
        onSubmit={onSubmit}
        style={{
          maxWidth: 520,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.25rem",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
          Email
          <input
            readOnly
            value={user.email}
            style={{
              padding: "0.55rem 0.65rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "1rem",
              background: "var(--bg)",
              color: "var(--muted)",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
          Display name
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{
              padding: "0.55rem 0.65rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "1rem",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
          Avatar URL
          <input
            type="text"
            inputMode="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            style={{
              padding: "0.55rem 0.65rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "1rem",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Leave empty to clear. Must be a valid https URL.</span>
        </label>

        <fieldset
          style={{
            margin: 0,
            padding: "1rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <legend style={{ fontSize: "0.85rem", padding: "0 0.35rem" }}>Change password</legend>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>
            Optional. Minimum 10 characters for the new password.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  padding: "0.55rem 0.65rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: "1rem",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  padding: "0.55rem 0.65rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: "1rem",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  padding: "0.55rem 0.65rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: "1rem",
                }}
              />
            </label>
          </div>
        </fieldset>

        {error ? (
          <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }} role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p style={{ margin: 0, color: "#15803d", fontSize: "0.85rem" }} role="status">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            alignSelf: "flex-start",
            padding: "0.65rem 1.25rem",
            borderRadius: 10,
            border: "none",
            background: "var(--text)",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </form>
    </DashboardShell>
  );
}
