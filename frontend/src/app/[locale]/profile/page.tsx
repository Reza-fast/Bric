"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Link, useRouter } from "@/i18n/navigation";
import type { AuthUser } from "@/lib/api/auth";
import { meRequest, patchMeRequest } from "@/lib/api/auth";

export default function ProfilePage() {
  const t = useTranslations("Profile");
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
        setError(t("weakNew"));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t("mismatch"));
        return;
      }
      if (!currentPassword) {
        setError(t("needCurrent"));
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
      setError(t("noChanges"));
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
      setSuccess(t("saved"));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("saveFailed");
      if (msg === "INVALID_CURRENT_PASSWORD") {
        setError(t("invalidCurrent"));
      } else if (msg === "NO_PASSWORD_SET") {
        setError(t("noPasswordSet"));
      } else if (msg === "WEAK_PASSWORD") {
        setError(t("weakPassword"));
      } else if (msg === "CURRENT_PASSWORD_REQUIRED") {
        setError(t("bothPasswords"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (boot || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>{t("loading")}</div>
    );
  }

  return (
    <DashboardShell user={user}>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/dashboard" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem" }}>
          {t("backDashboard")}
        </Link>
      </p>
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.35rem" }}>{t("title")}</h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--muted)", maxWidth: 520, fontSize: "0.9rem" }}>
        {t("subtitle")}
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
          {t("email")}
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
          {t("displayName")}
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
          {t("avatarUrl")}
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
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{t("avatarHint")}</span>
        </label>

        <fieldset
          style={{
            margin: 0,
            padding: "1rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <legend style={{ fontSize: "0.85rem", padding: "0 0.35rem" }}>{t("changePassword")}</legend>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>
            {t("passwordHint")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.85rem" }}>
              {t("currentPassword")}
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
              {t("newPassword")}
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
              {t("confirmPassword")}
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
          {loading ? t("saving") : t("saveChanges")}
        </button>
      </form>
    </DashboardShell>
  );
}
